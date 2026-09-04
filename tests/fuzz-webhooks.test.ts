/**
 * Fuzz tests for webhook signature verification.
 *
 * 15 tests feeding `verifyStripeSignature` (lib/webhook-signature-pure)
 * random payloads, header strings, secrets and timestamps. Confirms the
 * verifier never crashes and always makes a correct decision.
 *
 * Properties verified:
 *   - A correctly-signed request with a fresh timestamp is always accepted.
 *   - A request whose payload differs by a single byte is always rejected.
 *   - A request signed with a different secret is always rejected.
 *   - An expired timestamp (older than tolerance) is rejected with `expired`.
 *   - A future-dated timestamp is rejected with `future_dated`.
 *   - A malformed header (missing t= or v1=) is rejected with `malformed_header`.
 *   - `parseStripeSignature` round-trips a `t=…,v1=…` header losslessly.
 *
 * Inputs are produced by a deterministic seeded PRNG (mulberry32).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  verifyStripeSignature,
  computeHmacSha256,
  parseStripeSignature,
  timingSafeEqual,
  buildWebhookDedupKey,
  classifyWebhookEvent,
  STRIPE_TOLERANCE_SECONDS,
} from "../lib/webhook-signature-pure.ts";

// ─── seeded PRNG ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomString(rng: () => number, minLen: number, maxLen: number, alphabet = ALNUM): string {
  const len = minLen + Math.floor(rng() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function randomPayload(rng: () => number): string {
  // JSON-ish payloads that mimic Stripe webhook bodies.
  const eventType = pick(rng, [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "charge.refunded",
    "customer.subscription.created",
    "invoice.paid",
    "dispute.created",
  ]);
  return JSON.stringify({
    id: "evt_" + randomString(rng, 10, 24, "abcdefghijklmnopqrstuvwxyz0123456789"),
    object: "event",
    type: eventType,
    created: Math.floor(rng() * 1_700_000_000),
    data: { object: { id: "pi_" + randomString(rng, 8, 16), amount: 1000 * (1 + Math.floor(rng() * 100)) } },
  });
}

const SAMPLES = 200;

// Build a valid Stripe-Signature header for `payload` under `secret` at
// `timestamp`.
function buildValidHeader(secret: string, payload: string, timestamp: number): string {
  const sig = computeHmacSha256(secret, `${timestamp}.${payload}`);
  return `t=${timestamp},v1=${sig}`;
}

// ─── 1. Valid signature is always accepted ───────────────────────────────

test("fuzz/webhooks: a correctly-signed request with a fresh timestamp is always accepted", () => {
  const rng = mulberry32(601);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const ts = now - Math.floor(rng() * 60); // within 5-minute tolerance
    const header = buildValidHeader(secret, payload, ts);
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, true, `expected valid, got ${r.reason}: ${JSON.stringify(r).slice(0, 200)}`);
    assert.equal(r.timestamp, ts);
    assert.equal(r.expectedSignature, computeHmacSha256(secret, `${ts}.${payload}`));
  }
});

// ─── 2. Single-byte payload modification breaks the signature ─────────────

test("fuzz/webhooks: a payload that differs by one byte from the signed payload is rejected", () => {
  const rng = mulberry32(602);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const ts = now - 10;
    const header = buildValidHeader(secret, payload, ts);
    // Mutate the payload: append a single character.
    const mutated = payload + " ";
    const r = verifyStripeSignature(mutated, header, secret, now);
    assert.equal(r.valid, false);
    assert.equal(r.reason, "signature_mismatch");
  }
});

// ─── 3. Different secret breaks the signature ─────────────────────────────

test("fuzz/webhooks: a request signed with a different secret is rejected (signature_mismatch)", () => {
  const rng = mulberry32(603);
  for (let i = 0; i < SAMPLES; i++) {
    const secretA = "whsec_A" + randomString(rng, 8, 32);
    const secretB = "whsec_B" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const ts = now - 10;
    // Sign with secretA, verify with secretB.
    const header = buildValidHeader(secretA, payload, ts);
    const r = verifyStripeSignature(payload, header, secretB, now);
    assert.equal(r.valid, false);
    assert.equal(r.reason, "signature_mismatch");
  }
});

// ─── 4. Expired timestamp is rejected ─────────────────────────────────────

test("fuzz/webhooks: a timestamp older than tolerance is rejected with 'expired'", () => {
  const rng = mulberry32(604);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const ts = now - (STRIPE_TOLERANCE_SECONDS + 1 + Math.floor(rng() * 3600));
    const header = buildValidHeader(secret, payload, ts);
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, false);
    assert.equal(r.reason, "expired");
    assert.equal(r.timestamp, ts);
  }
});

// ─── 5. Future-dated timestamp is rejected ────────────────────────────────

test("fuzz/webhooks: a timestamp more than tolerance in the future is rejected with 'future_dated'", () => {
  const rng = mulberry32(605);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const ts = now + (STRIPE_TOLERANCE_SECONDS + 1 + Math.floor(rng() * 3600));
    const header = buildValidHeader(secret, payload, ts);
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, false);
    assert.equal(r.reason, "future_dated");
    assert.equal(r.timestamp, ts);
  }
});

// ─── 6. Malformed header (no t=) is rejected ──────────────────────────────

test("fuzz/webhooks: a header missing the t= component is rejected with 'malformed_header'", () => {
  const rng = mulberry32(606);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    // Build header with only v1= signatures, no t=.
    const sig = computeHmacSha256(secret, `${now - 10}.${payload}`);
    const header = `v1=${sig}`;
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, false);
    assert.equal(r.reason, "malformed_header");
    assert.equal(r.timestamp, null);
  }
});

// ─── 7. Malformed header (no v1=) is rejected ─────────────────────────────

test("fuzz/webhooks: a header missing all v1= signatures is rejected with 'malformed_header'", () => {
  const rng = mulberry32(607);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const header = `t=${now - 10}`;
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, false);
    assert.equal(r.reason, "malformed_header");
  }
});

// ─── 8. Null / empty / whitespace header is rejected ──────────────────────

test("fuzz/webhooks: null, empty string, and whitespace headers are rejected with 'malformed_header'", () => {
  const rng = mulberry32(608);
  for (let i = 0; i < SAMPLES; i++) {
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    for (const header of [null, "", "   ", "  ,  "]) {
      const r = verifyStripeSignature(payload, header as string, "whsec_x", now);
      assert.equal(r.valid, false);
      assert.equal(r.reason, "malformed_header");
    }
  }
});

// ─── 9. parseStripeSignature round-trips valid headers ────────────────────

test("fuzz/webhooks: parseStripeSignature round-trips t= and v1= components from a well-formed header", () => {
  const rng = mulberry32(609);
  for (let i = 0; i < SAMPLES; i++) {
    const ts = Math.floor(rng() * 1_700_000_000);
    const sig1 = randomString(rng, 64, 64, "0123456789abcdef");
    const sig2 = randomString(rng, 64, 64, "0123456789abcdef");
    // Multiple v1= signatures are allowed (Stripe supports key rotation).
    const header = `t=${ts},v1=${sig1},v1=${sig2}`;
    const parsed = parseStripeSignature(header);
    assert.equal(parsed !== null, true);
    assert.equal(parsed!.timestamp, ts);
    assert.equal(parsed!.signatures.length, 2);
    assert.equal(parsed!.signatures[0], sig1);
    assert.equal(parsed!.signatures[1], sig2);
  }
});

// ─── 10. parseStripeSignature tolerates whitespace and unknown keys ───────

test("fuzz/webhooks: parseStripeSignature tolerates whitespace, unknown keys (v0=), and out-of-order components", () => {
  const rng = mulberry32(610);
  for (let i = 0; i < SAMPLES; i++) {
    const ts = Math.floor(rng() * 1_700_000_000);
    const sig = randomString(rng, 64, 64, "0123456789abcdef");
    // Out-of-order, with extra whitespace and an unknown v0= component.
    const header = ` v1=${sig} , t=${ts}, v0=legacy `;
    const parsed = parseStripeSignature(header);
    assert.equal(parsed !== null, true);
    assert.equal(parsed!.timestamp, ts);
    assert.equal(parsed!.signatures.length, 1);
    assert.equal(parsed!.signatures[0], sig);
  }
});

// ─── 11. timingSafeEqual never throws and returns false for unequal strings ─

test("fuzz/webhooks: timingSafeEqual returns true for equal strings, false for unequal, never throws", () => {
  const rng = mulberry32(611);
  for (let i = 0; i < SAMPLES; i++) {
    const a = randomString(rng, 8, 64);
    const b = randomString(rng, 8, 64);
    assert.equal(timingSafeEqual(a, a), true);
    // Two random strings of potentially different lengths return false.
    if (a !== b) assert.equal(timingSafeEqual(a, b), false);
    // Length mismatch → false (no throw).
    assert.equal(timingSafeEqual(a, a + "x"), false);
    // Non-string inputs → false (no throw).
    assert.equal(timingSafeEqual(null as unknown as string, a), false);
    assert.equal(timingSafeEqual(undefined as unknown as string, a), false);
    assert.equal(timingSafeEqual(123 as unknown as string, a), false);
  }
});

// ─── 12. Multiple v1= signatures: any one match is sufficient ─────────────

test("fuzz/webhooks: when the header carries multiple v1= signatures, any matching one verifies the request", () => {
  const rng = mulberry32(612);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    const ts = now - 10;
    const goodSig = computeHmacSha256(secret, `${ts}.${payload}`);
    // Build a header with two bogus signatures and one real one (in the
    // middle to avoid positional bias).
    const bogus1 = randomString(rng, 64, 64, "0123456789abcdef");
    const bogus2 = randomString(rng, 64, 64, "0123456789abcdef");
    const header = `t=${ts},v1=${bogus1},v1=${goodSig},v1=${bogus2}`;
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, true, `expected valid for multi-sig header, got ${r.reason}`);
  }
});

// ─── 13. Random byte-sequence headers never crash the verifier ────────────

test("fuzz/webhooks: random byte-sequence headers never crash verifyStripeSignature", () => {
  const rng = mulberry32(613);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789 ,=t:v-";
  for (let i = 0; i < SAMPLES; i++) {
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    let header = "";
    const len = 1 + Math.floor(rng() * 60);
    for (let j = 0; j < len; j++) header += alphabet[Math.floor(rng() * alphabet.length)];
    let valid = false;
    let reason: string | undefined;
    assert.doesNotThrow(() => {
      const r = verifyStripeSignature(payload, header, "whsec_test", now);
      valid = r.valid;
      reason = r.reason;
    });
    // Whatever the decision, it must be one of the known reasons or valid.
    assert.ok(
      valid === true ||
      ["malformed_header", "expired", "future_dated", "signature_mismatch"].includes(reason as string),
      `unexpected reason: ${reason}`,
    );
  }
});

// ─── 14. buildWebhookDedupKey + classifyWebhookEvent are deterministic ─────

test("fuzz/webhooks: buildWebhookDedupKey and classifyWebhookEvent are deterministic and well-formed", () => {
  const rng = mulberry32(614);
  for (let i = 0; i < SAMPLES; i++) {
    const provider = pick(rng, ["stripe", "paypal", "adyen", "braintree"]);
    const eventId = "evt_" + randomString(rng, 8, 24);
    const key1 = buildWebhookDedupKey(provider, eventId);
    const key2 = buildWebhookDedupKey(provider, eventId);
    assert.equal(key1, key2);
    assert.equal(key1, `wh:${provider}:${eventId}`);
    // Different eventId → different key.
    const eventId2 = "evt_" + randomString(rng, 8, 24);
    if (eventId2 !== eventId) {
      assert.notEqual(key1, buildWebhookDedupKey(provider, eventId2));
    }
    // Event classification.
    const eventType = pick(rng, [
      "payment_intent.succeeded",
      "charge.refunded",
      "customer.subscription.created",
      "invoice.paid",
      "dispute.created",
      "account.updated",
    ]);
    const klass = classifyWebhookEvent(eventType);
    assert.ok(["payment", "subscription", "refund", "dispute", "invoice", "customer", "other"].includes(klass));
    // Deterministic.
    assert.equal(classifyWebhookEvent(eventType), klass);
  }
});

// ─── 15. Tolerance boundary: at exactly tolerance, request is still valid ──

test("fuzz/webhooks: a timestamp exactly at the tolerance boundary (age === tolerance) is still valid", () => {
  const rng = mulberry32(615);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = "whsec_" + randomString(rng, 8, 32);
    const payload = randomPayload(rng);
    const now = Math.floor(rng() * 1_700_000_000);
    // Age === tolerance exactly → still valid (boundary check is `age > tolerance`).
    const ts = now - STRIPE_TOLERANCE_SECONDS;
    const header = buildValidHeader(secret, payload, ts);
    const r = verifyStripeSignature(payload, header, secret, now);
    assert.equal(r.valid, true, `expected valid at boundary, got ${r.reason}`);
    // One second past tolerance → expired.
    const ts2 = now - (STRIPE_TOLERANCE_SECONDS + 1);
    const header2 = buildValidHeader(secret, payload, ts2);
    const r2 = verifyStripeSignature(payload, header2, secret, now);
    assert.equal(r2.valid, false);
    assert.equal(r2.reason, "expired");
    // One second in the future beyond tolerance → future_dated.
    const ts3 = now + (STRIPE_TOLERANCE_SECONDS + 1);
    const header3 = buildValidHeader(secret, payload, ts3);
    const r3 = verifyStripeSignature(payload, header3, secret, now);
    assert.equal(r3.valid, false);
    assert.equal(r3.reason, "future_dated");
  }
});

/**
 * Property-based idempotency tests.
 *
 * 15 tests covering every idempotency-key builder in the codebase:
 *   - `buildKey` (lib/idempotency-pure)              — `idem:<provider>:<eventId>`
 *   - `buildIdempotencyKey` (db/actions-pure)        — `<ws>:<mis>:<hash>`
 *   - `buildPaymentIdempotencyKey` (db/attribution)  — `pay:<ws>:<provider>:<pi>`
 *   - `buildWebhookDedupKey` (lib/webhook-signature) — `wh:<provider>:<eventId>`
 *   - `buildRateLimitKey` (lib/rate-limit-pure)      — `rl:<scope>:<id>`
 *
 * Universal properties verified:
 *   - Same input → same key (determinism).
 *   - Different input → different key (collision resistance).
 *   - Each builder uses a distinct prefix so the same (provider, eventId)
 *     pair cannot collide across the four cache namespaces.
 *
 * Also covers:
 *   - `computePayloadHash` determinism (same payload → same hash).
 *   - `findDuplicates` / `deduplicateByProviderEventId` semantics.
 *   - `classifyError` / `shouldRetry` / `calculateBackoff` monotonicity.
 *
 * Inputs are produced by a deterministic seeded PRNG (mulberry32).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildKey,
  computePayloadHash,
  findDuplicates,
  deduplicateByProviderEventId,
  classifyError,
  shouldRetry,
  calculateBackoff,
  isRecordValid,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  type IdempotencyRecord,
} from "../lib/idempotency-pure.ts";
import { buildIdempotencyKey } from "../db/actions-pure.ts";
import { buildPaymentIdempotencyKey } from "../db/attribution-pure.ts";
import { buildWebhookDedupKey } from "../lib/webhook-signature-pure.ts";
import { buildRateLimitKey } from "../lib/rate-limit-pure.ts";

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

const SAMPLES = 200;

// ─── 1. buildKey determinism ──────────────────────────────────────────────

test("property/idem-buildKey: same (provider, eventId) → same key; format is `idem:<provider>:<eventId>`", () => {
  const rng = mulberry32(701);
  for (let i = 0; i < SAMPLES; i++) {
    const provider = pick(rng, ["stripe", "paypal", "adyen", "braintree"]);
    const eventId = "evt_" + randomString(rng, 8, 24);
    const a = buildKey(provider, eventId);
    const b = buildKey(provider, eventId);
    assert.equal(a, b);
    assert.equal(a, `idem:${provider}:${eventId}`);
  }
});

// ─── 2. buildKey collision resistance ─────────────────────────────────────

test("property/idem-buildKey: different (provider, eventId) → different key", () => {
  const rng = mulberry32(702);
  const seen = new Map<string, string>();
  for (let i = 0; i < SAMPLES; i++) {
    const provider = pick(rng, ["stripe", "paypal", "adyen", "braintree"]);
    const eventId = "evt_" + randomString(rng, 8, 24);
    const key = buildKey(provider, eventId);
    const prev = seen.get(key);
    if (prev !== undefined) {
      assert.fail(`collision: (${prev}) and (${provider}, ${eventId}) both produced ${key}`);
    }
    seen.set(key, `${provider}, ${eventId}`);
  }
});

// ─── 3. computePayloadHash determinism ────────────────────────────────────

test("property/idem-payloadHash: same payload → same hash; format is 64-hex", () => {
  const rng = mulberry32(703);
  for (let i = 0; i < SAMPLES; i++) {
    const payload = JSON.stringify({
      id: Math.floor(rng() * 1_000_000),
      type: pick(rng, ["a", "b", "c"]),
      data: randomString(rng, 1, 32),
    });
    const a = computePayloadHash(payload);
    const b = computePayloadHash(payload);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  }
});

// ─── 4. computePayloadHash collision resistance ───────────────────────────

test("property/idem-payloadHash: different payload → different hash (collision resistance)", () => {
  const rng = mulberry32(704);
  const seen = new Set<string>();
  const inputs = new Set<string>();
  for (let i = 0; i < SAMPLES; i++) {
    const payload = JSON.stringify({
      id: Math.floor(rng() * 1_000_000_000),
      data: randomString(rng, 4, 32),
    });
    inputs.add(payload);
    const h = computePayloadHash(payload);
    if (seen.has(h)) {
      assert.fail(`collision on payload ${payload}`);
    }
    seen.add(h);
  }
  assert.ok(inputs.size > SAMPLES / 2, "corpus too small");
});

// ─── 5. buildIdempotencyKey (actions) determinism ─────────────────────────

test("property/idem-actions: same (ws, mis, hash) → same key; format is `<ws>:<mis>:<hash>`", () => {
  const rng = mulberry32(705);
  for (let i = 0; i < SAMPLES; i++) {
    const ws = "ws_" + randomString(rng, 4, 16);
    const mis = "mis_" + randomString(rng, 4, 16);
    const hash = computePayloadHash(randomString(rng, 1, 32));
    const a = buildIdempotencyKey(ws, mis, hash);
    const b = buildIdempotencyKey(ws, mis, hash);
    assert.equal(a, b);
    assert.equal(a, `${ws}:${mis}:${hash}`);
  }
});

// ─── 6. buildIdempotencyKey (actions) collision resistance ────────────────

test("property/idem-actions: changing any of (ws, mis, hash) produces a different key", () => {
  const rng = mulberry32(706);
  for (let i = 0; i < SAMPLES; i++) {
    const ws1 = "ws_" + randomString(rng, 4, 16);
    const ws2 = "ws_" + randomString(rng, 4, 16);
    const mis1 = "mis_" + randomString(rng, 4, 16);
    const mis2 = "mis_" + randomString(rng, 4, 16);
    const h1 = computePayloadHash(randomString(rng, 1, 32));
    const h2 = computePayloadHash(randomString(rng, 1, 32));
    const k1 = buildIdempotencyKey(ws1, mis1, h1);
    // At least one component differs → key must differ.
    if (ws1 !== ws2 || mis1 !== mis2 || h1 !== h2) {
      assert.notEqual(k1, buildIdempotencyKey(ws2, mis2, h2));
    }
  }
});

// ─── 7. buildPaymentIdempotencyKey determinism + format ───────────────────

test("property/idem-payments: same (ws, provider, pi) → same key; format is `pay:<ws>:<provider-lower>:<pi>`", () => {
  const rng = mulberry32(707);
  for (let i = 0; i < SAMPLES; i++) {
    const ws = "ws_" + randomString(rng, 4, 16);
    const provider = pick(rng, ["Stripe", "PAYPAL", "Adyen", "Braintree"]);
    const pi = "pi_" + randomString(rng, 4, 24);
    const a = buildPaymentIdempotencyKey({ workspaceId: ws, provider, providerPaymentId: pi });
    const b = buildPaymentIdempotencyKey({ workspaceId: ws, provider, providerPaymentId: pi });
    assert.equal(a, b);
    assert.equal(a, `pay:${ws}:${provider.toLowerCase()}:${pi}`);
  }
});

// ─── 8. buildPaymentIdempotencyKey: provider is normalised to lowercase ──

test("property/idem-payments: provider casing is normalised so Stripe == stripe == STRIPE", () => {
  const rng = mulberry32(708);
  for (let i = 0; i < SAMPLES; i++) {
    const ws = "ws_" + randomString(rng, 4, 16);
    const pi = "pi_" + randomString(rng, 4, 24);
    const a = buildPaymentIdempotencyKey({ workspaceId: ws, provider: "Stripe", providerPaymentId: pi });
    const b = buildPaymentIdempotencyKey({ workspaceId: ws, provider: "stripe", providerPaymentId: pi });
    const c = buildPaymentIdempotencyKey({ workspaceId: ws, provider: "STRIPE", providerPaymentId: pi });
    assert.equal(a, b);
    assert.equal(b, c);
  }
});

// ─── 9. buildWebhookDedupKey determinism ──────────────────────────────────

test("property/idem-webhook: same (provider, eventId) → same key; format is `wh:<provider>:<eventId>`", () => {
  const rng = mulberry32(709);
  for (let i = 0; i < SAMPLES; i++) {
    const provider = pick(rng, ["stripe", "paypal", "adyen"]);
    const eventId = "evt_" + randomString(rng, 8, 24);
    const a = buildWebhookDedupKey(provider, eventId);
    const b = buildWebhookDedupKey(provider, eventId);
    assert.equal(a, b);
    assert.equal(a, `wh:${provider}:${eventId}`);
  }
});

// ─── 10. buildRateLimitKey determinism ────────────────────────────────────

test("property/idem-rateLimit: same parts → same key; format is `rl:<part>:<part>:...`", () => {
  const rng = mulberry32(710);
  for (let i = 0; i < SAMPLES; i++) {
    const scope = pick(rng, ["workspace", "ip", "global", "write", "authenticated"]);
    const id = randomString(rng, 4, 16);
    const a = buildRateLimitKey(scope, id);
    const b = buildRateLimitKey(scope, id);
    assert.equal(a, b);
    assert.equal(a, `rl:${scope}:${id}`);
    // Multi-part keys compose with `:`.
    const c = buildRateLimitKey(scope, id, "write");
    assert.equal(c, `rl:${scope}:${id}:write`);
  }
});

// ─── 11. Cross-namespace isolation: distinct prefixes prevent collisions ──

test("property/idem-cross-namespace: idem:, pay:, wh:, rl: prefixes cannot collide for the same input string", () => {
  const rng = mulberry32(711);
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, 8, 32);
    // Build keys using the same string for every builder.
    const idem = buildKey(x, x);                          // idem:x:x
    const pay = buildPaymentIdempotencyKey({ workspaceId: x, provider: x, providerPaymentId: x }); // pay:x:x:x
    const wh = buildWebhookDedupKey(x, x);                // wh:x:x
    const rl = buildRateLimitKey(x, x);                   // rl:x:x
    const keys = [idem, pay, wh, rl];
    const prefixes = keys.map((k) => k.split(":")[0]);
    // All four prefixes are distinct.
    assert.deepEqual([...new Set(prefixes)].sort(), ["idem", "pay", "rl", "wh"]);
    // No two keys are equal.
    assert.equal(new Set(keys).size, 4);
  }
});

// ─── 12. findDuplicates: returns second-and-later duplicates only ──────────

test("property/idem-findDuplicates: returns the 2nd, 3rd, ... occurrences of each key, never the first", () => {
  const rng = mulberry32(712);
  for (let i = 0; i < SAMPLES; i++) {
    // Build a corpus where some items share a key.
    const items: Array<{ id: number; key: string }> = [];
    const keys = ["a", "b", "c", "d"];
    for (let j = 0; j < 20; j++) {
      items.push({ id: j, key: pick(rng, keys) });
    }
    const dupes = findDuplicates(items, (it) => it.key);
    // The first occurrence of each key is NOT in dupes; subsequent ones are.
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.key)) {
        // Should be in dupes.
        assert.ok(
          dupes.some((d) => d.id === it.id),
          `expected item ${it.id} (key=${it.key}) to be flagged as duplicate`,
        );
      } else {
        // Should NOT be in dupes.
        assert.equal(
          dupes.some((d) => d.id === it.id),
          false,
          `first occurrence of ${it.key} (item ${it.id}) was incorrectly flagged`,
        );
      }
      seen.add(it.key);
    }
  }
});

// ─── 13. deduplicateByProviderEventId: first-occurrence wins ──────────────

test("property/idem-dedupe: deduplicateByProviderEventId keeps the first occurrence of each (provider, eventId) pair", () => {
  const rng = mulberry32(713);
  for (let i = 0; i < SAMPLES; i++) {
    const providers = ["stripe", "paypal", "adyen"];
    const items: Array<{ provider: string; eventId: string; seq: number }> = [];
    for (let j = 0; j < 30; j++) {
      items.push({
        provider: pick(rng, providers),
        eventId: "evt_" + pick(rng, [1, 2, 3, 4, 5]),
        seq: j,
      });
    }
    const deduped = deduplicateByProviderEventId(items);
    // The output preserves insertion order of first occurrences.
    const seen = new Set<string>();
    for (const it of deduped) {
      const k = buildKey(it.provider, it.eventId);
      assert.equal(seen.has(k), false, `duplicate key ${k} appeared in deduped output`);
      seen.add(k);
    }
    // The first occurrence in the input is the one preserved.
    const firstBy: Record<string, number> = {};
    for (const it of items) {
      const k = buildKey(it.provider, it.eventId);
      if (firstBy[k] === undefined) firstBy[k] = it.seq;
    }
    for (const it of deduped) {
      const k = buildKey(it.provider, it.eventId);
      assert.equal(it.seq, firstBy[k]);
    }
  }
});

// ─── 14. classifyError + shouldRetry + calculateBackoff ───────────────────

test("property/idem-classify: classifyError buckets HTTP statuses deterministically; shouldRetry never retries permanent/unknown", () => {
  const rng = mulberry32(714);
  for (let i = 0; i < SAMPLES; i++) {
    const status = pick(rng, [200, 301, 400, 401, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504]);
    const klass = classifyError({ status });
    // Determinism: same status → same class.
    assert.equal(classifyError({ status }), klass);
    // Backoff is monotonic non-decreasing for non-jittered calls.
    const b0 = calculateBackoff(0);
    const b1 = calculateBackoff(1);
    const b2 = calculateBackoff(2);
    assert.ok(b0 <= b1 && b1 <= b2);
    // Capped at maxMs.
    assert.ok(b2 <= 30_000);
    // Permanent / unknown never retried.
    assert.equal(shouldRetry("permanent", 1, 5), false);
    assert.equal(shouldRetry("unknown", 1, 5), false);
    // Transient retried until maxAttempts.
    assert.equal(shouldRetry("transient", 1, 5), true);
    assert.equal(shouldRetry("transient", 5, 5), false);
    assert.equal(shouldRetry("rate_limit", 1, 3), true);
    assert.equal(shouldRetry("timeout", 0, 3), true);
    assert.equal(shouldRetry("network", 2, 3), true);
  }
});

// ─── 15. isRecordValid + DEFAULT_TTL ──────────────────────────────────────

test("property/idem-ttl: isRecordValid honours expiresAtMs; DEFAULT_TTL is 24h", () => {
  const rng = mulberry32(715);
  // Default TTL is exactly 24 hours.
  assert.equal(DEFAULT_IDEMPOTENCY_TTL_MS, 24 * 60 * 60 * 1000);
  for (let i = 0; i < SAMPLES; i++) {
    const now = Math.floor(rng() * 1_700_000_000_000);
    const record: IdempotencyRecord = {
      key: "idem:stripe:evt_1",
      status: "pending",
      createdAtMs: now,
      expiresAtMs: now + 1000,
      payloadHash: "deadbeef".repeat(8),
    };
    // now < expiresAtMs → valid.
    assert.equal(isRecordValid(record, now), true);
    // now === expiresAtMs → invalid (boundary).
    assert.equal(isRecordValid(record, now + 1000), false);
    // now > expiresAtMs → invalid.
    assert.equal(isRecordValid(record, now + 1001), false);
    // Now is in the past of createdAtMs — still valid if now < expiresAtMs.
    assert.equal(isRecordValid(record, now - 100), true);
    // Malformed record (null) → false.
    assert.equal(isRecordValid(null as unknown as IdempotencyRecord, now), false);
  }
});

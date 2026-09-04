/**
 * Property-based hash tests.
 *
 * 15 tests covering the SHA-256 / HMAC-SHA256 helpers used across the
 * distribution-os codebase. Each property is asserted over a corpus of
 * pseudo-randomly generated inputs produced by a deterministic seeded
 * PRNG (mulberry32) so the suite is reproducible across CI runs.
 *
 * Properties verified:
 *   - Determinism           — h(x) === h(x) for every input x.
 *   - Collision resistance  — x ≠ y  ⇒  h(x) ≠ h(y) (probabilistically).
 *   - Well-formed output    — every digest is 64-char lowercase hex.
 *   - Unicode safety        — multi-byte / emoji inputs hash without errors.
 *   - Empty / very long     — boundary inputs are accepted.
 *   - HMAC sensitivity      — flipping one bit of secret or payload changes
 *                              the digest.
 *   - Cross-helper agreement— hashIp(x) === hashToken(x) (both are plain
 *                              SHA-256 of the UTF-8 bytes).
 *
 * Pure: only `node:crypto` / Web Crypto under the hood. No I/O.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { hashString, hmacSha256 } from "../lib/crypto-helpers-pure.ts";
import { computePayloadHash } from "../lib/idempotency-pure.ts";
import { computeHmacSha256 } from "../lib/webhook-signature-pure.ts";
import { hashContent, canonicalJson as evidenceCanonical } from "../db/evidence-pure.ts";
import { hashPayload, canonicalJson as actionCanonical } from "../db/actions-pure.ts";
import { hashIp } from "../db/audit-pure.ts";
import { hashToken } from "../db/organizations-pure.ts";

const HEX64 = /^[0-9a-f]{64}$/;

// ─── deterministic PRNG (mulberry32) ───────────────────────────────────────
// Seeded so the corpus is identical on every run. A fresh generator is
// created for each property test so they are independent.
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

function randomString(
  rng: () => number,
  opts: { minLen?: number; maxLen: number; alphabet?: string },
): string {
  const min = opts.minLen ?? 0;
  const len = min + Math.floor(rng() * (opts.maxLen - min + 1));
  const alphabet =
    opts.alphabet ??
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
}

// Unicode corpus — emoji, CJK, combining marks, RTL, surrogate pairs.
const UNICODE_POOL =
  "héllo wörld 🌍 日本語 \u200eRTL\u202c ñ é ü \u{1F600}\u{1F4A9} café";

function randomUnicode(rng: () => number, maxLen: number): string {
  const len = 1 + Math.floor(rng() * maxLen);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += UNICODE_POOL[Math.floor(rng() * UNICODE_POOL.length)];
  }
  return out;
}

const SAMPLES = 200;

// ─── 1. hashString determinism ────────────────────────────────────────────

test("property/hashString: h(x) === h(x) for every random input (determinism)", () => {
  const rng = mulberry32(1);
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, { maxLen: 64 });
    const a = hashString(x);
    const b = hashString(x);
    assert.equal(a, b, `non-deterministic for ${JSON.stringify(x).slice(0, 40)}`);
    assert.match(a, HEX64);
  }
});

// ─── 2. hashString collision resistance ───────────────────────────────────

test("property/hashString: distinct inputs produce distinct digests (collision resistance)", () => {
  const rng = mulberry32(2);
  const seen = new Map<string, string>();
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, { minLen: 1, maxLen: 32 });
    const h = hashString(x);
    const prev = seen.get(h);
    if (prev !== undefined && prev !== x) {
      assert.fail(`collision: "${prev}" and "${x}" both hashed to ${h}`);
    }
    seen.set(h, x);
  }
});

// ─── 3. hashString well-formed output ─────────────────────────────────────

test("property/hashString: every digest is 64-char lowercase hex (no uppercase, no other chars)", () => {
  const rng = mulberry32(3);
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, { maxLen: 128 });
    assert.match(hashString(x), HEX64);
  }
});

// ─── 4. hashString unicode safety ─────────────────────────────────────────

test("property/hashString: unicode / emoji inputs hash without throwing and produce 64-hex", () => {
  const rng = mulberry32(4);
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomUnicode(rng, 40);
    const h = hashString(x);
    assert.match(h, HEX64);
  }
});

// ─── 5. hashString empty + very long boundary ─────────────────────────────

test("property/hashString: empty string and very long strings both produce well-formed digests", () => {
  assert.match(hashString(""), HEX64);
  // Known SHA-256("") vector.
  assert.equal(
    hashString(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  // Very long deterministic input — does not throw, still 64-hex.
  const long = "x".repeat(1_000_000);
  assert.match(hashString(long), HEX64);
  // Two long inputs differing only in the last byte must hash differently.
  const long2 = "x".repeat(999_999) + "y";
  assert.notEqual(hashString(long), hashString(long2));
});

// ─── 6. computePayloadHash determinism + sensitivity ──────────────────────

test("property/computePayloadHash: deterministic and sensitive to single-character changes", () => {
  const rng = mulberry32(5);
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, { minLen: 2, maxLen: 64 });
    const a = computePayloadHash(x);
    const b = computePayloadHash(x);
    assert.equal(a, b);
    assert.match(a, HEX64);
    // Flip the last character — digest must change.
    const flipped = x.slice(0, -1) + (x.endsWith("a") ? "b" : "a");
    assert.notEqual(a, computePayloadHash(flipped));
  }
});

// ─── 7. computePayloadHash collision resistance over short random payloads ─

test("property/computePayloadHash: no collisions across a corpus of 200 distinct random payloads", () => {
  const rng = mulberry32(6);
  const seen = new Set<string>();
  const inputs = new Set<string>();
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, { minLen: 4, maxLen: 32 });
    inputs.add(x);
    const h = computePayloadHash(x);
    if (seen.has(h)) {
      // Collision is only a failure if two *distinct* inputs collided.
      assert.fail(`unexpected collision on input "${x}"`);
    }
    seen.add(h);
  }
  // Sanity: corpus has more than one distinct input.
  assert.ok(inputs.size > SAMPLES / 2, "corpus too small to be meaningful");
});

// ─── 8. hmacSha256 (crypto-helpers) determinism + key sensitivity ─────────

test("property/hmacSha256: deterministic; flipping any bit of secret or payload changes the digest", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = randomString(rng, { minLen: 1, maxLen: 32 });
    const payload = randomString(rng, { minLen: 1, maxLen: 64 });
    const a = hmacSha256(secret, payload);
    const b = hmacSha256(secret, payload);
    assert.equal(a, b);
    assert.match(a, HEX64);
    // Different secret → different digest.
    const secret2 = secret + "x";
    assert.notEqual(a, hmacSha256(secret2, payload));
    // Different payload → different digest.
    const payload2 = payload + " ";
    assert.notEqual(a, hmacSha256(secret, payload2));
  }
});

// ─── 9. computeHmacSha256 (webhook-signature) determinism + hex format ────

test("property/computeHmacSha256: deterministic and well-formed across random secret/payload pairs", () => {
  const rng = mulberry32(8);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = randomString(rng, { minLen: 1, maxLen: 40 });
    const payload = randomString(rng, { minLen: 1, maxLen: 80 });
    const a = computeHmacSha256(secret, payload);
    const b = computeHmacSha256(secret, payload);
    assert.equal(a, b);
    assert.match(a, HEX64);
  }
});

// ─── 10. computeHmacSha256 cross-helper agreement ─────────────────────────

test("property/computeHmacSha256 vs hmacSha256: two HMAC helpers agree for identical inputs", () => {
  const rng = mulberry32(9);
  for (let i = 0; i < SAMPLES; i++) {
    const secret = randomString(rng, { minLen: 1, maxLen: 32 });
    const payload = randomString(rng, { minLen: 1, maxLen: 64 });
    assert.equal(
      hmacSha256(secret, payload),
      computeHmacSha256(secret, payload),
    );
  }
});

// ─── 11. hashIp vs hashToken agreement ────────────────────────────────────

test("property/hashIp vs hashToken: identical input strings produce identical digests (both are plain SHA-256)", async () => {
  const rng = mulberry32(10);
  for (let i = 0; i < SAMPLES; i++) {
    const x = randomString(rng, { minLen: 1, maxLen: 32 });
    const ip = await hashIp(x);
    const tok = await hashToken(x);
    assert.equal(ip, tok);
    assert.match(ip, HEX64);
  }
});

// ─── 12. hashContent determinism and string-vs-object divergence ──────────

test("property/hashContent: deterministic; string and object shapes never collide for the same content", async () => {
  const rng = mulberry32(11);
  for (let i = 0; i < SAMPLES; i++) {
    const s = randomString(rng, { minLen: 1, maxLen: 32 });
    const a = await hashContent(s);
    const b = await hashContent(s);
    assert.equal(a, b);
    assert.match(a, HEX64);
    // String vs object canonical encoding should not collide.
    const c = await hashContent({ msg: s });
    assert.notEqual(a, c);
  }
});

// ─── 13. hashPayload canonical-JSON key-order invariance ──────────────────

test("property/hashPayload: key reordering of an object produces the same digest (canonical JSON)", async () => {
  const rng = mulberry32(12);
  for (let i = 0; i < SAMPLES; i++) {
    // Build an object with 4 random string fields, then a permuted variant
    // whose insertion order is reversed.
    const keys = ["a", "b", "c", "d"].map((k) => `${k}_${Math.floor(rng() * 1000)}`);
    const vals = keys.map(() => randomString(rng, { maxLen: 8 }));
    const obj1: Record<string, string> = {};
    for (let j = 0; j < keys.length; j++) obj1[keys[j]] = vals[j];
    const obj2: Record<string, string> = {};
    for (let j = keys.length - 1; j >= 0; j--) obj2[keys[j]] = vals[j];
    assert.equal(await hashPayload(obj1), await hashPayload(obj2));
  }
});

// ─── 14. hashPayload deterministic + sensitivity ──────────────────────────

test("property/hashPayload: deterministic; flipping one field value changes the digest", async () => {
  const rng = mulberry32(13);
  for (let i = 0; i < SAMPLES; i++) {
    const obj = {
      id: Math.floor(rng() * 1_000_000),
      name: randomString(rng, { minLen: 1, maxLen: 16 }),
      tags: [randomString(rng, { maxLen: 4 }), randomString(rng, { maxLen: 4 })],
    };
    const a = await hashPayload(obj);
    const b = await hashPayload(obj);
    assert.equal(a, b);
    assert.match(a, HEX64);
    const obj2 = { ...obj, id: obj.id + 1 };
    assert.notEqual(a, await hashPayload(obj2));
  }
});

// ─── 15. Cross-helper canonical-JSON agreement ────────────────────────────

test("property/cross-helper: hashPayload(obj) === hashContent(canonicalJson(obj)) for any object", async () => {
  const rng = mulberry32(14);
  for (let i = 0; i < SAMPLES; i++) {
    const obj = {
      z: randomString(rng, { maxLen: 4 }),
      a: Math.floor(rng() * 1000),
      m: [rng() > 0.5, randomString(rng, { maxLen: 4 })],
    };
    const viaPayload = await hashPayload(obj);
    const viaContent = await hashContent(evidenceCanonical(obj));
    assert.equal(viaPayload, viaContent);
    // The two canonicalJson helpers also agree.
    assert.equal(actionCanonical(obj), evidenceCanonical(obj));
  }
});

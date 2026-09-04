/**
 * Hash-function consistency audit. Verifies that every SHA-256 helper in the
 * codebase is:
 *   - deterministic (same input → same digest),
 *   - sensitive to input changes (different inputs → different digests),
 *   - well-formed (64-char lowercase hex),
 *   - robust against edge cases (empty, null, unicode, very long inputs).
 *
 * Also verifies that the canonical-JSON normaliser used by `hashPayload`
 * produces identical digests regardless of object-key order.
 *
 * 15 tests, all pure (only `node:crypto` and Web Crypto under the hood).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { hashPayload, canonicalJson } from "../db/actions-pure.ts";
import { hashContent } from "../db/evidence-pure.ts";
import { computePayloadHash } from "../lib/idempotency-pure.ts";
import { hashIp } from "../db/audit-pure.ts";
import { hashToken } from "../db/organizations-pure.ts";
import { computeHmacSha256 } from "../lib/webhook-signature-pure.ts";

const HEX64 = /^[0-9a-f]{64}$/;

// ─── hashPayload (canonical JSON + Web Crypto SHA-256) ────────────────────

test("hash/hashPayload: is deterministic across repeated calls and produces 64-char lowercase hex", async () => {
  const a = await hashPayload({ a: 1, b: ["x", "y"] });
  const b = await hashPayload({ a: 1, b: ["x", "y"] });
  assert.equal(a, b);
  assert.match(a, HEX64);
});

test("hash/hashPayload: canonicalJson sorts object keys so key order does not affect the digest", async () => {
  assert.equal(
    canonicalJson({ a: 1, b: 2 }),
    canonicalJson({ b: 2, a: 1 }),
  );
  const a = await hashPayload({ a: 1, b: 2 });
  const b = await hashPayload({ b: 2, a: 1 });
  assert.equal(a, b);
});

test("hash/hashPayload: differs for different payload content (number, string, structure)", async () => {
  const a = await hashPayload({ id: 1 });
  const b = await hashPayload({ id: 2 });
  const c = await hashPayload({ id: "1" });
  const d = await hashPayload({ id: 1, extra: true });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

test("hash/hashPayload: handles edge cases — null, undefined, empty object, empty array", async () => {
  const nullHash = await hashPayload(null);
  const undefHash = await hashPayload(undefined);
  const emptyObjHash = await hashPayload({});
  const emptyArrHash = await hashPayload([]);
  for (const h of [nullHash, undefHash, emptyObjHash, emptyArrHash]) {
    assert.match(h, HEX64);
  }
  // null and undefined are JSON-encoded as the literals "null" and "undefined"
  // (normalize drops undefined properties of objects but passes primitives
  // through to JSON.stringify which emits "null" for null). They differ from
  // the empty object/array hashes.
  assert.notEqual(nullHash, emptyObjHash);
  assert.notEqual(emptyObjHash, emptyArrHash);
});

test("hash/hashPayload: handles unicode and very long strings without truncation", async () => {
  const unicode = await hashPayload({ msg: "héllo wörld 🌍 — 日本語" });
  assert.match(unicode, HEX64);
  const long = await hashPayload({ msg: "A".repeat(100_000) });
  assert.match(long, HEX64);
  assert.notEqual(long, await hashPayload({ msg: "A".repeat(99_999) }));
});

// ─── hashContent (evidence-pure) ──────────────────────────────────────────

test("hash/hashContent: is deterministic and differs for different content", async () => {
  const a = await hashContent("evidence body text");
  const b = await hashContent("evidence body text");
  assert.equal(a, b);
  assert.match(a, HEX64);
  assert.notEqual(await hashContent("hello"), await hashContent("world"));
});

test("hash/hashContent: differs for object vs string and for different content shapes", async () => {
  const asString = await hashContent("hello");
  const asObject = await hashContent({ msg: "hello" });
  assert.notEqual(asString, asObject);
  assert.match(asString, HEX64);
  assert.match(asObject, HEX64);
});

test("hash/hashContent: handles empty string and edge-case inputs (null, empty object)", async () => {
  const empty = await hashContent("");
  assert.match(empty, HEX64);
  assert.equal(empty, await hashContent("")); // deterministic
  // The well-known SHA-256 of an empty UTF-8 string.
  assert.equal(
    empty,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  // null becomes the string "null" (canonicalJson falls back to JSON.stringify
  // for non-object inputs).
  const nullHash = await hashContent(null);
  assert.match(nullHash, HEX64);
  assert.notEqual(nullHash, empty);
});

// ─── computePayloadHash (idempotency-pure, sync) ──────────────────────────

test("hash/computePayloadHash: matches the known SHA-256 vector for 'hello' and is deterministic", () => {
  const expected =
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
  assert.equal(computePayloadHash("hello"), expected);
  assert.equal(computePayloadHash("hello"), computePayloadHash("hello"));
  assert.match(computePayloadHash("any input"), HEX64);
});

test("hash/computePayloadHash: differs for whitespace and case differences", () => {
  const a = computePayloadHash('{"id":1}');
  const b = computePayloadHash('{"id": 1}');
  const c = computePayloadHash('{"id":2}');
  const d = computePayloadHash('{"ID":1}');
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

// ─── hashIp (audit-pure) + hashToken (organizations-pure) ─────────────────

test("hash/hashIp: produces 64-char hex, deterministic, differs per IP", async () => {
  const a = await hashIp("1.2.3.4");
  const b = await hashIp("1.2.3.4");
  const c = await hashIp("5.6.7.8");
  assert.match(a, HEX64);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("hash/hashToken: produces 64-char hex, deterministic, differs per token", async () => {
  const a = await hashToken("inv_abc");
  const b = await hashToken("inv_abc");
  const c = await hashToken("inv_xyz");
  assert.match(a, HEX64);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("hash/hashIp vs hashToken: same input string produces the same digest (both are plain SHA-256)", async () => {
  // Both helpers feed the UTF-8 bytes of their input to SHA-256, so identical
  // input strings must produce identical digests even though the helpers
  // serve different domains (audit IPs vs invitation tokens).
  const ip = await hashIp("sample-token-value");
  const tok = await hashToken("sample-token-value");
  assert.equal(ip, tok);
});

// ─── computeHmacSha256 (webhook-signature-pure) ───────────────────────────

test("hash/computeHmacSha256: matches RFC 4231 vector, deterministic, and differs when inputs change", () => {
  // RFC 4231 test case #2: key="Jefe", data="what do ya want for nothing?".
  assert.equal(
    computeHmacSha256("Jefe", "what do ya want for nothing?"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  );
  // Determinism.
  const a = computeHmacSha256("secret", "payload");
  assert.equal(a, computeHmacSha256("secret", "payload"));
  assert.match(a, HEX64);
  // Sensitive to input changes.
  assert.notEqual(a, computeHmacSha256("secret", "payload ")); // trailing space
  assert.notEqual(a, computeHmacSha256("secretx", "payload")); // different key
  assert.notEqual(a, computeHmacSha256("secret", "Payload")); // case difference
});

// ─── Cross-cutting invariants ─────────────────────────────────────────────

test("hash/cross-cutting: every SHA-256 helper returns 64-char lowercase hex and hashPayload(obj) == hashContent(canonicalJson(obj))", async () => {
  const samples = [
    await hashPayload({ x: 1 }),
    await hashContent("hello"),
    computePayloadHash("hello"),
    await hashIp("1.2.3.4"),
    await hashToken("inv_1"),
    computeHmacSha256("secret", "payload"),
  ];
  for (const s of samples) {
    assert.match(s, HEX64, `${s} is not a 64-char lowercase hex digest`);
  }
  // hashPayload normalises the object to canonical JSON then hashes the UTF-8
  // bytes. hashContent of a string hashes the UTF-8 bytes directly. So
  // hashPayload(obj) should equal hashContent(canonicalJson(obj)).
  const obj = { b: 2, a: 1, nested: { z: [1, 2, 3] } };
  const viaPayload = await hashPayload(obj);
  const viaContent = await hashContent(canonicalJson(obj));
  assert.equal(viaPayload, viaContent);
});

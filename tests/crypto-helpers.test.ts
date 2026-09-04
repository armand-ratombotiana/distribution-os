import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateRandomBytes,
  generateUuid,
  hashString,
  hmacSha256,
  base64Encode,
  base64Decode,
} from "../lib/crypto-helpers-pure";

test("generateRandomBytes returns the correct number of hex chars and produces unique output", () => {
  const hex = generateRandomBytes(16);
  assert.equal(hex.length, 32);
  assert.match(hex, /^[0-9a-f]+$/);
  const a = generateRandomBytes(32);
  const b = generateRandomBytes(32);
  assert.notEqual(a, b);
});

test("generateRandomBytes produces output of increasing length with the input", () => {
  assert.equal(generateRandomBytes(1).length, 2);
  assert.equal(generateRandomBytes(8).length, 16);
  assert.equal(generateRandomBytes(64).length, 128);
});

test("generateRandomBytes throws for invalid lengths", () => {
  assert.throws(() => generateRandomBytes(0));
  assert.throws(() => generateRandomBytes(-1));
  assert.throws(() => generateRandomBytes(1.5));
});

test("generateUuid returns a canonical UUID v4 string", () => {
  const id = generateUuid();
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("generateUuid produces unique values across many calls", () => {
  const set = new Set<string>();
  for (let i = 0; i < 500; i++) set.add(generateUuid());
  assert.equal(set.size, 500);
});

test("hashString returns a 64-char hex SHA-256 digest and is deterministic", () => {
  const hash = hashString("hello");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]+$/);
  // Known SHA-256 of "hello"
  assert.equal(
    hash,
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
  assert.equal(hashString("abc"), hashString("abc"));
  assert.notEqual(hashString("abc"), hashString("ABC"));
  assert.throws(() => hashString(123 as unknown as string));
});

test("hmacSha256 is deterministic and varies with input", () => {
  assert.equal(hmacSha256("k", "v"), hmacSha256("k", "v"));
  assert.notEqual(hmacSha256("k1", "v"), hmacSha256("k2", "v"));
  assert.notEqual(hmacSha256("k", "v1"), hmacSha256("k", "v2"));
  assert.throws(() => hmacSha256(null as unknown as string, "v"));
});

test("hmacSha256 returns the correct hex digest", () => {
  const mac = hmacSha256("secret", "payload");
  assert.equal(mac.length, 64);
  assert.match(mac, /^[0-9a-f]+$/);
  // Known HMAC-SHA256 of "payload" under "secret"
  assert.equal(
    mac,
    "b82fcb791acec57859b989b430a826488ce2e479fdf92326bd0a2e8375a42ba4",
  );
});

test("base64Encode and base64Decode are inverse operations", () => {
  const original = "Hello, World! 123 ±😊";
  const encoded = base64Encode(original);
  assert.equal(base64Decode(encoded), original);
});

test("base64Encode produces standard base64 output and base64Decode recovers it", () => {
  assert.equal(base64Encode("hello"), "aGVsbG8=");
  assert.equal(base64Encode("foobar"), "Zm9vYmFy");
  assert.equal(base64Decode("aGVsbG8="), "hello");
  assert.equal(base64Decode("Zm9vYmFy"), "foobar");
});

test("base64Encode handles empty strings and unicode correctly", () => {
  assert.equal(base64Encode(""), "");
  assert.equal(base64Decode(""), "");
  // The UTF-8 sequence for the plus-minus glyph (U+00B1) is 0xC2 0xB1.
  assert.equal(base64Encode("±"), "wrE=");
  assert.equal(base64Decode("wrE="), "±");
});

test("base64Decode/base64Encode throw for non-string inputs", () => {
  assert.throws(() => base64Encode(42 as unknown as string));
  assert.throws(() => base64Decode(null as unknown as string));
});

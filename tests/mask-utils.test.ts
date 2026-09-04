import { test } from "node:test";
import assert from "node:assert/strict";

import {
  maskEmail,
  maskPhone,
  maskCreditCard,
  maskApiKey,
  maskUuid,
} from "../lib/mask-utils-pure.ts";

test("maskEmail keeps the first character of the local part and the full domain", () => {
  // "alice" → first char + 4 stars (5 total).
  assert.equal(maskEmail("alice@example.com"), "a****@example.com");
  // "bob" → first char + 2 stars (3 total).
  assert.equal(maskEmail("bob@sub.example.co"), "b**@sub.example.co");
});

test("maskEmail handles single-character local parts gracefully", () => {
  assert.equal(maskEmail("x@example.com"), "*@example.com");
});

test("maskEmail returns empty string for empty/non-string input", () => {
  assert.equal(maskEmail(""), "");
  // @ts-expect-error runtime guard
  assert.equal(maskEmail(null), "");
});

test("maskEmail falls back to first-char masking when the input is not email-shaped", () => {
  // "not-an-email" has 12 chars → first char + 11 stars.
  assert.equal(maskEmail("not-an-email"), "n***********");
});

test("maskPhone keeps the last 4 digits and masks the rest", () => {
  assert.equal(maskPhone("+1 (555) 123-4567"), "+* (***) ***-4567");
  // 10-digit string → 6 stars + last 4 digits.
  assert.equal(maskPhone("5551234567"), "******4567");
});

test("maskPhone fully masks numbers with fewer than 4 digits", () => {
  assert.equal(maskPhone("12"), "**");
  assert.equal(maskPhone("abc"), "***");
});

test("maskCreditCard keeps only the last 4 digits, preserving separators", () => {
  assert.equal(maskCreditCard("4111 1111 1111 1111"), "**** **** **** 1111");
  assert.equal(maskCreditCard("4111-2222-3333-4444"), "****-****-****-4444");
  assert.equal(maskCreditCard("1234567890123456"), "************3456");
});

test("maskCreditCard fully masks short inputs", () => {
  assert.equal(maskCreditCard("123"), "***");
});

test("maskApiKey keeps the first 4 and last 4 characters and masks the middle", () => {
  // "sk_live_1234567890abcdef" has 24 chars: 4 + 16 (masked) + 4.
  assert.equal(maskApiKey("sk_live_1234567890abcdef"), "sk_l****************cdef");
  // 12-char key: 4 + 4 (masked) + 4.
  assert.equal(maskApiKey("abcdefghijkl"), "abcd****ijkl");
  assert.equal(maskApiKey("abcdefgh"), "abcdefgh");
  assert.equal(maskApiKey("short"), "*****");
});

test("maskUuid keeps the first segment and masks the remaining four", () => {
  assert.equal(
    maskUuid("550e8400-e29b-41d4-a716-446655440000"),
    "550e8400-****-****-****-************",
  );
  assert.equal(
    maskUuid("12345678-1234-1234-1234-1234567890ab"),
    "12345678-****-****-****-************",
  );
});

test("maskUuid falls back to first-4-char masking for non-UUID strings", () => {
  assert.equal(maskUuid("not-a-uuid-string"), "not-*************");
  assert.equal(maskUuid("ab"), "**");
});

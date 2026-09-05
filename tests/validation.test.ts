import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateString,
  validateNumber,
  validateInteger,
  validateEnum,
  validateUrl,
  validateEmail,
  validateUuid,
  validateDateRange,
  validateJsonString,
  sanitizeHtml,
  truncate,
  slugify,
  maskSensitive,
} from "../lib/validation-pure.js";

test("validateString accepts a valid string", () => {
  const result = validateString("hello");
  assert.equal(result.ok, true);
  assert.equal(result.value, "hello");
});

test("validateString rejects non-string values", () => {
  const result = validateString(42);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /string/);
});

test("validateString enforces maxLength", () => {
  const result = validateString("hello", { maxLength: 3 });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /at most 3/);
});

test("validateNumber accepts numeric strings and clamps via min/max", () => {
  const ok = validateNumber("42", { min: 0, max: 100 });
  assert.equal(ok.ok, true);
  assert.equal(ok.value, 42);
  const bad = validateNumber(200, { min: 0, max: 100 });
  assert.equal(bad.ok, false);
});

test("validateNumber rejects NaN inputs", () => {
  const result = validateNumber("not a number");
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /number/);
});

test("validateInteger rejects non-integer numbers", () => {
  const result = validateInteger(3.14);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /integer/);
});

test("validateEnum rejects values not present in the allowed set", () => {
  const result = validateEnum("banana", ["apple", "orange"]);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /apple, orange/);
});

test("validateUrl accepts a well-formed https URL", () => {
  const result = validateUrl("https://example.com/path");
  assert.equal(result.ok, true);
  assert.equal(result.value, "https://example.com/path");
});

test("validateUrl rejects non-http(s) protocols", () => {
  const result = validateUrl("javascript:alert(1)");
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /http/);
});

test("validateEmail accepts a valid address", () => {
  const result = validateEmail("user@example.com");
  assert.equal(result.ok, true);
  assert.equal(result.value, "user@example.com");
});

test("validateEmail rejects malformed addresses", () => {
  assert.equal(validateEmail("no-at-sign").ok, false);
  assert.equal(validateEmail("a@b").ok, false);
});

test("validateUuid accepts and normalizes a valid UUID", () => {
  const result = validateUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11");
  assert.equal(result.ok, true);
  assert.equal(result.value, "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
});

test("validateDateRange rejects when start is after end", () => {
  const result = validateDateRange("2024-02-01", "2024-01-01");
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /before/);
});

test("validateJsonString parses valid JSON and returns the parsed value", () => {
  const result = validateJsonString('{"a":1,"b":[2,3]}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { a: 1, b: [2, 3] });
});

test("sanitizeHtml escapes angle brackets, ampersands and quotes", () => {
  assert.equal(
    sanitizeHtml(`<a href="x">Tom & Jerry's</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
  );
});

test("slugify normalizes spaces, punctuation and diacritics", () => {
  assert.equal(slugify("Héllo, World! 2024"), "hello-world-2024");
  assert.equal(slugify("   ---foo---   "), "foo");
});

test("truncate appends the ellipsis suffix when text exceeds the limit", () => {
  assert.equal(truncate("Hello, world!", 6), "Hello…");
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("abc", 2), "a…");
  assert.equal(truncate("abc", 1), "…");
});

test("maskSensitive keeps the start and end visible and masks the middle", () => {
  assert.equal(maskSensitive("sk-1234567890abcdef"), "sk***************ef");
  assert.equal(maskSensitive("ab"), "****");
});

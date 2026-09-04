import { test } from "node:test";
import assert from "node:assert/strict";

import {
  escapeRegex,
  buildEmailRegex,
  buildUrlRegex,
  buildPhoneRegex,
  testPattern,
  extractMatches,
} from "../lib/regex-utils-pure.ts";

test("escapeRegex escapes characters that have regex meaning", () => {
  assert.equal(escapeRegex("a.b*c+d"), "a\\.b\\*c\\+d");
  assert.equal(escapeRegex("(group)"), "\\(group\\)");
  assert.equal(escapeRegex("[bracket]"), "\\[bracket\\]");
  assert.equal(escapeRegex("$50 + tax"), "\\$50 \\+ tax");
  assert.equal(escapeRegex("plain"), "plain");
});

test("escapeRegex'd strings can be used to find literal substrings", () => {
  const needle = "price: $5.00 (each)";
  const haystack = `The ${needle}, total`;
  const re = new RegExp(escapeRegex(needle));
  assert.equal(re.test(haystack), true);
});

test("buildEmailRegex accepts well-formed addresses", () => {
  const re = buildEmailRegex();
  for (const ok of [
    "user@example.com",
    "user.name+tag@sub.example.co.uk",
    "a_b-c%d@x.io",
    "x@y.ca",
  ]) {
    assert.equal(re.test(ok), true, `expected match: ${ok}`);
  }
});

test("buildEmailRegex rejects malformed addresses", () => {
  const re = buildEmailRegex();
  for (const bad of [
    "plainaddress",
    "@no-local.com",
    "user@.com",
    "user@example",
    "user@example.c",
    "user @example.com",
  ]) {
    assert.equal(re.test(bad), false, `expected no match: ${bad}`);
  }
});

test("buildUrlRegex accepts http and https URLs with optional port/path", () => {
  const re = buildUrlRegex();
  for (const ok of [
    "http://example.com",
    "https://example.com/",
    "https://sub.example.com:8080/path/to/page",
    "http://example.com?q=1&r=2#frag",
  ]) {
    assert.equal(re.test(ok), true, `expected match: ${ok}`);
  }
});

test("buildUrlRegex rejects non-http schemes and malformed hosts", () => {
  const re = buildUrlRegex();
  for (const bad of [
    "ftp://example.com",
    "example.com",
    "http://",
    "https://example",
  ]) {
    assert.equal(re.test(bad), false, `expected no match: ${bad}`);
  }
});

test("buildPhoneRegex accepts common phone formats with 7-15 digits", () => {
  const re = buildPhoneRegex();
  for (const ok of [
    "+1 (555) 123-4567",
    "555-1234",
    "+44 20 7946 0958",
    "(123) 456-7890",
    "+86 138 0000 0000",
  ]) {
    assert.equal(re.test(ok), true, `expected match: ${ok}`);
  }
});

test("testPattern supports RegExp and string literals and anchors them", () => {
  assert.equal(testPattern(/^\d+$/, "12345"), true);
  assert.equal(testPattern(/^\d+$/, "12a45"), false);
  // String patterns are escaped and anchored (literal match).
  assert.equal(testPattern("a.b", "a.b"), true);
  assert.equal(testPattern("a.b", "axb"), false);
  // Non-anchored regex still anchored by testPattern.
  assert.equal(testPattern(/\d+/, "12345"), true);
  assert.equal(testPattern(/\d+/, "abc"), false);
});

test("extractMatches returns every full match of a global regex", () => {
  assert.deepEqual(extractMatches(/\d+/g, "a1 b22 c333"), ["1", "22", "333"]);
  // Non-global regex is upgraded to global.
  assert.deepEqual(extractMatches(/\w+/i, "Hello World"), ["Hello", "World"]);
  assert.deepEqual(extractMatches(/xyz/g, "abc"), []);
});

test("extractMatches treats string patterns as literal needles", () => {
  // Literal: the dot should match a dot, not any character.
  assert.deepEqual(extractMatches("a.b", "a.b axb a.b"), ["a.b", "a.b"]);
});

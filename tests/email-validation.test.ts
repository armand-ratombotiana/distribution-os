import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateEmailFormat,
  normalizeEmail,
  isDisposableEmail,
  extractDomain,
  maskEmail,
} from "../lib/email-validation-pure";

test("validateEmailFormat accepts a standard address", () => {
  const r = validateEmailFormat("alice@example.com");
  assert.equal(r.ok, true);
  assert.equal(r.error, undefined);
});

test("validateEmailFormat rejects empty and non-string inputs", () => {
  assert.equal(validateEmailFormat("").ok, false);
  assert.equal(validateEmailFormat("   ").ok, false);
  assert.equal(validateEmailFormat(42).ok, false);
  assert.equal(validateEmailFormat(null).ok, false);
});

test("validateEmailFormat rejects addresses without a domain dot", () => {
  assert.equal(validateEmailFormat("a@b").ok, false);
  assert.equal(validateEmailFormat("no-at-sign").ok, false);
  assert.equal(validateEmailFormat("two@@at.com").ok, false);
});

test("validateEmailFormat rejects overly long addresses", () => {
  const long = "a".repeat(255) + "@x.com";
  assert.equal(validateEmailFormat(long).ok, false);
});

test("normalizeEmail lowercases the domain but preserves the local part", () => {
  assert.equal(normalizeEmail("  Alice@EXAMPLE.com "), "Alice@example.com");
  assert.equal(normalizeEmail("Bob+tag@Example.ORG"), "Bob+tag@example.org");
});

test("normalizeEmail returns null for invalid addresses", () => {
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail(123), null);
});

test("extractDomain returns the lowercased domain portion", () => {
  assert.equal(extractDomain("Alice@Example.COM"), "example.com");
  assert.equal(extractDomain("bob@sub.domain.org"), "sub.domain.org");
});

test("extractDomain returns null for invalid inputs", () => {
  assert.equal(extractDomain(""), null);
  assert.equal(extractDomain("no-at"), null);
});

test("isDisposableEmail returns true for known disposable providers", () => {
  assert.equal(isDisposableEmail("x@mailinator.com"), true);
  assert.equal(isDisposableEmail("y@10minutemail.com"), true);
  assert.equal(isDisposableEmail("z@guerrillamail.com"), true);
});

test("isDisposableEmail returns false for legitimate providers and invalid inputs", () => {
  assert.equal(isDisposableEmail("alice@example.com"), false);
  assert.equal(isDisposableEmail("bob@gmail.com"), false);
  assert.equal(isDisposableEmail("not-an-email"), false);
});

test("maskEmail masks the middle of a long local part", () => {
  assert.equal(maskEmail("alice@example.com"), "a***e@example.com");
  // "longusername" has 12 chars; 12 - 2 - 2 = 8 masked chars.
  assert.equal(
    maskEmail("longusername@example.com", { visibleStart: 2, visibleEnd: 2 }),
    "lo********me@example.com",
  );
});

test("maskEmail collapses short local parts to a fully masked form", () => {
  assert.equal(maskEmail("ab@example.com"), "***@example.com");
  assert.equal(maskEmail("a@example.com"), "***@example.com");
  assert.equal(maskEmail("not-an-email"), null);
});


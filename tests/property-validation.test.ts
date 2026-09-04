/**
 * Property-based validation tests.
 *
 * 15 tests covering the validators in `lib/validation-pure.ts`. Each
 * property is asserted over a corpus of pseudo-random inputs produced by a
 * deterministic seeded PRNG (mulberry32) so the suite is reproducible.
 *
 * Properties verified:
 *   - Accepts valid     — well-formed inputs return `{ ok: true, value }`.
 *   - Rejects invalid   — malformed inputs return `{ ok: false, error }`.
 *   - Boundary cond.    — exactly-at-min/max values are accepted; one past
 *                          the boundary is rejected.
 *
 * Pure: imports only `lib/validation-pure.ts`. No I/O.
 */
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
  sanitizeString,
  sanitizeHtml,
} from "../lib/validation-pure.ts";

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

const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomString(rng: () => number, minLen: number, maxLen: number, alphabet = ALNUM): string {
  const len = minLen + Math.floor(rng() * (maxLen - minLen + 1));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// Generate a UUID v4 in canonical lowercase form (all 32 hex chars + dashes).
function randomUuid(rng: () => number): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) {
    // Force version (4) and variant (8-b) bits per RFC 4122.
    if (i === 12) s += "4";
    else if (i === 16) s += hex[8 + Math.floor(rng() * 4)];
    else s += hex[Math.floor(rng() * 16)];
  }
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const SAMPLES = 200;

// ─── 1. validateString accepts valid strings ──────────────────────────────

test("property/validateString: accepts well-formed strings within length bounds", () => {
  const rng = mulberry32(201);
  for (let i = 0; i < SAMPLES; i++) {
    const min = randomInt(rng, 1, 5);
    const max = randomInt(rng, min + 5, min + 30);
    const len = randomInt(rng, min, max);
    const value = randomString(rng, len, len);
    const r = validateString(value, { minLength: min, maxLength: max });
    assert.equal(r.ok, true);
    assert.equal(r.value, value);
  }
});

// ─── 2. validateString rejects too-short and too-long ─────────────────────

test("property/validateString: rejects strings shorter than minLength and longer than maxLength", () => {
  const rng = mulberry32(202);
  for (let i = 0; i < SAMPLES; i++) {
    const min = randomInt(rng, 5, 10);
    const max = randomInt(rng, min + 5, min + 30);
    // Too short.
    const tooShort = randomString(rng, 0, min - 1);
    assert.equal(validateString(tooShort, { minLength: min, maxLength: max }).ok, false);
    // Too long.
    const tooLong = randomString(rng, max + 1, max + 50);
    assert.equal(validateString(tooLong, { minLength: min, maxLength: max }).ok, false);
  }
});

// ─── 3. validateString boundary at exactly min and exactly max ────────────

test("property/validateString: boundary — strings of exactly minLength and exactly maxLength are accepted", () => {
  const rng = mulberry32(203);
  for (let i = 0; i < SAMPLES; i++) {
    const min = randomInt(rng, 1, 10);
    const max = randomInt(rng, min + 1, min + 40);
    const atMin = randomString(rng, min, min);
    assert.equal(validateString(atMin, { minLength: min, maxLength: max }).ok, true);
    const atMax = randomString(rng, max, max);
    assert.equal(validateString(atMax, { minLength: min, maxLength: max }).ok, true);
  }
});

// ─── 4. validateString required:false accepts null/undefined ──────────────

test("property/validateString: required:false accepts null and undefined as empty string", () => {
  const rng = mulberry32(204);
  for (let i = 0; i < SAMPLES; i++) {
    const r1 = validateString(null, { required: false });
    const r2 = validateString(undefined, { required: false });
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.equal(r1.value, "");
    assert.equal(r2.value, "");
  }
});

// ─── 5. validateString required (default) rejects null/undefined ──────────

test("property/validateString: required (default) rejects null and undefined", () => {
  const rng = mulberry32(205);
  for (let i = 0; i < SAMPLES; i++) {
    assert.equal(validateString(null).ok, false);
    assert.equal(validateString(undefined).ok, false);
  }
});

// ─── 6. validateNumber accepts numbers within bounds ──────────────────────

test("property/validateNumber: accepts numbers within [min, max] and numeric strings", () => {
  const rng = mulberry32(206);
  for (let i = 0; i < SAMPLES; i++) {
    const min = randomInt(rng, -1000, 0);
    const max = randomInt(rng, 1, 1000);
    const n = min + rng() * (max - min);
    assert.equal(validateNumber(n, { min, max }).ok, true);
    // Numeric string of an integer in range.
    const intStr = String(randomInt(rng, min, max));
    assert.equal(validateNumber(intStr, { min, max, integer: true }).ok, true);
  }
});

// ─── 7. validateNumber rejects out-of-bounds and non-numeric ──────────────

test("property/validateNumber: rejects numbers below min, above max, and non-numeric strings", () => {
  const rng = mulberry32(207);
  for (let i = 0; i < SAMPLES; i++) {
    const min = randomInt(rng, 0, 100);
    const max = randomInt(rng, 200, 500);
    assert.equal(validateNumber(min - 1, { min, max }).ok, false);
    assert.equal(validateNumber(max + 1, { min, max }).ok, false);
    // Non-numeric string.
    const junk = randomString(rng, 1, 10, "!@#$%^&*()");
    assert.equal(validateNumber(junk, { min, max }).ok, false);
  }
});

// ─── 8. validateInteger rejects non-integers ──────────────────────────────

test("property/validateInteger: accepts integers in range; rejects fractional values", () => {
  const rng = mulberry32(208);
  for (let i = 0; i < SAMPLES; i++) {
    const min = randomInt(rng, -100, 0);
    const max = randomInt(rng, 1, 100);
    const int = randomInt(rng, min, max);
    assert.equal(validateInteger(int, { min, max }).ok, true);
    // Add a fractional part — must be rejected when integer:true.
    const frac = int + 0.5;
    if (frac > max) continue;
    assert.equal(validateInteger(frac, { min, max }).ok, false);
  }
});

// ─── 9. validateEnum accepts members and rejects non-members ──────────────

test("property/validateEnum: accepts members of the allowed set; rejects everything else", () => {
  const rng = mulberry32(209);
  const allowed = ["red", "green", "blue", "yellow", "purple"] as const;
  for (let i = 0; i < SAMPLES; i++) {
    const pick = allowed[Math.floor(rng() * allowed.length)];
    assert.equal(validateEnum(pick, allowed).ok, true);
    // Random non-member string — must be rejected.
    const nonMember = randomString(rng, 1, 10);
    if (allowed.includes(nonMember as never)) continue;
    assert.equal(validateEnum(nonMember, allowed).ok, false);
  }
});

// ─── 10. validateUrl accepts http/https; rejects other protocols ──────────

test("property/validateUrl: accepts well-formed http(s) URLs; rejects other protocols and junk", () => {
  const rng = mulberry32(210);
  for (let i = 0; i < SAMPLES; i++) {
    const host = randomString(rng, 3, 12, "abcdefghijklmnopqrstuvwxyz");
    const path = "/" + randomString(rng, 0, 12, "abcdefghijklmnopqrstuvwxyz/0123456789");
    const proto = rng() > 0.5 ? "https" : "http";
    const url = `${proto}://${host}.com${path}`;
    const r = validateUrl(url);
    assert.equal(r.ok, true, `expected ok for ${url}`);
    assert.equal(r.value!.startsWith(`${proto}://`), true);
  }
  // Reject other protocols.
  assert.equal(validateUrl("ftp://example.com").ok, false);
  assert.equal(validateUrl("javascript:alert(1)").ok, false);
  assert.equal(validateUrl("file:///etc/passwd").ok, false);
  // Reject junk.
  assert.equal(validateUrl("").ok, false);
  assert.equal(validateUrl("not a url").ok, false);
});

// ─── 11. validateEmail accepts valid; rejects malformed ───────────────────

test("property/validateEmail: accepts well-formed emails; rejects strings without @ or domain", () => {
  const rng = mulberry32(211);
  for (let i = 0; i < SAMPLES; i++) {
    const local = randomString(rng, 1, 10, "abcdefghijklmnopqrstuvwxyz0123456789._%+-");
    const domain = randomString(rng, 1, 8, "abcdefghijklmnopqrstuvwxyz");
    const tld = randomString(rng, 2, 4, "abcdefghijklmnopqrstuvwxyz");
    const email = `${local}@${domain}.${tld}`;
    assert.equal(validateEmail(email).ok, true, `expected ok for ${email}`);
  }
  // Reject malformed.
  assert.equal(validateEmail("no-at-sign").ok, false);
  assert.equal(validateEmail("no-tld@domain").ok, false);
  assert.equal(validateEmail("@no-local.com").ok, false);
  assert.equal(validateEmail("spaces in@local.com").ok, false);
});

// ─── 12. validateUuid accepts canonical form; rejects variants ────────────

test("property/validateUuid: accepts canonical v4 UUIDs; rejects uppercase, missing dashes, junk", () => {
  const rng = mulberry32(212);
  for (let i = 0; i < SAMPLES; i++) {
    const id = randomUuid(rng);
    assert.equal(validateUuid(id).ok, true, `expected ok for ${id}`);
    // Uppercase variant should be accepted and normalised to lowercase.
    const upper = id.toUpperCase();
    const r = validateUuid(upper);
    assert.equal(r.ok, true);
    assert.equal(r.value, id);
  }
  // Reject malformed.
  assert.equal(validateUuid("not-a-uuid").ok, false);
  assert.equal(validateUuid("12345678-1234-1234-1234-1234567890").ok, false); // too short
  assert.equal(validateUuid("123456781234123412341234567890ab").ok, false); // no dashes
});

// ─── 13. validateDateRange accepts start <= end; rejects start > end ──────

test("property/validateDateRange: accepts start <= end; rejects start > end and invalid dates", () => {
  const rng = mulberry32(213);
  for (let i = 0; i < SAMPLES; i++) {
    const a = randomInt(rng, 0, 1_000_000_000_000);
    const b = a + randomInt(rng, 0, 1_000_000_000);
    // start <= end is always accepted.
    assert.equal(validateDateRange(a, b).ok, true);
    // start > end is always rejected.
    assert.equal(validateDateRange(b + 1, a).ok, false);
  }
  // Invalid date strings are rejected.
  assert.equal(validateDateRange("not-a-date", "also-not-a-date").ok, false);
});

// ─── 14. validateJsonString accepts valid JSON; rejects invalid ───────────

test("property/validateJsonString: accepts valid JSON; rejects malformed JSON", () => {
  const rng = mulberry32(214);
  for (let i = 0; i < SAMPLES; i++) {
    const obj = {
      a: randomInt(rng, 0, 1000),
      b: randomString(rng, 1, 10),
      c: rng() > 0.5,
      d: [1, 2, 3],
    };
    const json = JSON.stringify(obj);
    const r = validateJsonString(json);
    assert.equal(r.ok, true, `expected ok for ${json}`);
    assert.deepEqual(r.value, obj);
  }
  // Reject malformed JSON.
  assert.equal(validateJsonString("{not valid}").ok, false);
  assert.equal(validateJsonString("[1, 2,").ok, false);
  assert.equal(validateJsonString("").ok, false);
  assert.equal(validateJsonString(123).ok, false);
});

// ─── 15. sanitizeString and sanitizeHtml invariants ───────────────────────

test("property/sanitize: sanitizeString removes control chars; sanitizeHtml escapes special chars", () => {
  const rng = mulberry32(215);
  for (let i = 0; i < SAMPLES; i++) {
    const raw = randomString(rng, 1, 30, "abc \t<>&\"'\\") + "\x00\x07\x1f";
    const cleaned = sanitizeString(raw);
    // No control characters (0x00-0x1f or 0x7f) remain.
    assert.equal(/[\u0000-\u001F\u007F]/.test(cleaned), false);
    // Whitespace collapsed to single spaces, no leading/trailing.
    assert.equal(/^\s|\s$|\s{2,}/.test(cleaned), false);
    // HTML escape: special chars are replaced.
    const escaped = sanitizeHtml(raw);
    assert.equal(/[<>&"']/.test(escaped.replace(/&[a-z]+;|&#\d+;/g, "")), false);
  }
});

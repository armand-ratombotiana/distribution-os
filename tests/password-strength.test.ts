import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calculateStrength,
  getStrengthLabel,
  checkCommonPasswords,
  checkPasswordRequirements,
  DEFAULT_PASSWORD_REQUIREMENTS,
} from "../lib/password-strength-pure";

test("calculateStrength returns 0 for empty input", () => {
  assert.equal(calculateStrength(""), 0);
  assert.equal(calculateStrength(null as unknown as string), 0);
});

test("calculateStrength scores common passwords at 10 or below", () => {
  assert.equal(calculateStrength("password"), 10);
  assert.equal(calculateStrength("123456"), 10);
  assert.equal(calculateStrength("qwerty"), 10);
});

test("calculateStrength rewards length and character-class diversity", () => {
  const weak = calculateStrength("abcdefgh");
  const strong = calculateStrength("Abcdefg1!XYZ");
  assert.ok(strong > weak);
  assert.ok(strong >= 60);
});

test("calculateStrength caps the result at 100 and penalises patterns", () => {
  const very = calculateStrength("Correct$Horse42Battery!Staple");
  assert.ok(very <= 100);
  assert.ok(very >= 0);
  // Sequential and repeated-character patterns are penalised.
  const noSeq = calculateStrength("aB4!xY9z");
  assert.ok(calculateStrength("aB4!abcd") < noSeq);
  assert.ok(calculateStrength("aB4!aaaaz") < noSeq);
});

test("calculateStrength penalises short all-letters passwords", () => {
  const short = calculateStrength("abcdef");
  const diverse = calculateStrength("aB4!xY9z");
  assert.ok(short < diverse);
});

test("getStrengthLabel maps scores into ordered buckets", () => {
  assert.equal(getStrengthLabel(0), "very-weak");
  assert.equal(getStrengthLabel(19), "very-weak");
  assert.equal(getStrengthLabel(20), "weak");
  assert.equal(getStrengthLabel(39), "weak");
  assert.equal(getStrengthLabel(40), "fair");
  assert.equal(getStrengthLabel(59), "fair");
  assert.equal(getStrengthLabel(60), "strong");
  assert.equal(getStrengthLabel(79), "strong");
  assert.equal(getStrengthLabel(80), "very-strong");
  assert.equal(getStrengthLabel(100), "very-strong");
});

test("getStrengthLabel clamps out-of-range inputs", () => {
  assert.equal(getStrengthLabel(-10), "very-weak");
  assert.equal(getStrengthLabel(999), "very-strong");
  assert.equal(getStrengthLabel(NaN), "very-weak");
});

test("checkCommonPasswords detects known leaked passwords (case-insensitive)", () => {
  assert.equal(checkCommonPasswords("password"), true);
  assert.equal(checkCommonPasswords("PASSWORD"), true);
  assert.equal(checkCommonPasswords("PassWord"), true);
  assert.equal(checkCommonPasswords("qwerty123"), true);
  assert.equal(checkCommonPasswords("notcommonpass"), false);
  assert.equal(checkCommonPasswords(""), false);
});

test("checkPasswordRequirements passes a fully compliant password", () => {
  const r = checkPasswordRequirements("Abcdef1!");
  assert.equal(r.ok, true);
  assert.equal(r.checks.length, 5);
  assert.equal(r.checks.every((c) => c.passed), true);
});

test("checkPasswordRequirements reports each failing requirement", () => {
  const r = checkPasswordRequirements("abc");
  assert.equal(r.ok, false);
  const failed = r.checks.filter((c) => !c.passed).map((c) => c.requirement);
  assert.ok(failed.includes("minLength"));
  assert.ok(failed.includes("requireUppercase"));
  assert.ok(failed.includes("requireDigit"));
  assert.ok(failed.includes("requireSymbol"));
  assert.ok(!failed.includes("requireLowercase"));
});

test("checkPasswordRequirements respects a custom requirement set", () => {
  const r = checkPasswordRequirements("abcde", {
    minLength: 4,
    requireUppercase: false,
    requireLowercase: true,
    requireDigit: false,
    requireSymbol: false,
  });
  assert.equal(r.ok, true);
  // Only minLength + requireLowercase are enabled.
  assert.equal(r.checks.length, 2);
});

test("DEFAULT_PASSWORD_REQUIREMENTS exposes the standard 8+/A-Z/a-z/0-9/symbol policy", () => {
  assert.equal(DEFAULT_PASSWORD_REQUIREMENTS.minLength, 8);
  assert.equal(DEFAULT_PASSWORD_REQUIREMENTS.requireUppercase, true);
  assert.equal(DEFAULT_PASSWORD_REQUIREMENTS.requireLowercase, true);
  assert.equal(DEFAULT_PASSWORD_REQUIREMENTS.requireDigit, true);
  assert.equal(DEFAULT_PASSWORD_REQUIREMENTS.requireSymbol, true);
});

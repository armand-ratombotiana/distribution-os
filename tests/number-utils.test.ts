import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  round,
  random,
  range,
  sum,
  average,
  median,
  formatNumber,
} from "../lib/number-utils-pure";

test("clamp keeps values within the inclusive range and tolerates NaN/backwards bounds", () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(-1, 1, 10), 1);
  assert.equal(clamp(99, 1, 10), 10);
  // Backwards (min > max) bounds are swapped automatically.
  assert.equal(clamp(5, 10, 1), 5);
  assert.equal(clamp(99, 10, 1), 10);
  // NaN value falls back to the min bound.
  assert.equal(clamp(NaN, 1, 10), 1);
});

test("round rounds to the specified decimal places (round half away from zero)", () => {
  assert.equal(round(1.5), 2);
  assert.equal(round(1.005, 2), 1.01);
  assert.equal(round(2.345, 2), 2.35);
  assert.equal(round(-1.5), -2);
});

test("round returns NaN for invalid inputs", () => {
  assert.ok(Number.isNaN(round(NaN)));
  assert.ok(Number.isNaN(round(1.5, -1)));
  assert.ok(Number.isNaN(round(1.5, 1.5)));
});

test("random returns an integer within the inclusive range and throws for non-finite bounds", () => {
  let seed = 0.5;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 100; i++) {
    const n = random(1, 10, rng);
    assert.ok(n >= 1 && n <= 10);
    assert.equal(Math.floor(n), n);
  }
  assert.throws(() => random(NaN, 10));
  assert.throws(() => random(1, Infinity));
});

test("range generates ascending and descending sequences with a step", () => {
  assert.deepEqual(range(1, 5), [1, 2, 3, 4]);
  assert.deepEqual(range(0, 10, 2), [0, 2, 4, 6, 8]);
  assert.deepEqual(range(5, 1), [5, 4, 3, 2]);
  assert.deepEqual(range(10, 0, 2), [10, 8, 6, 4, 2]);
});

test("range returns [] for step === 0, empty windows, or non-finite inputs", () => {
  assert.deepEqual(range(1, 5, 0), []);
  assert.deepEqual(range(0, 0), []);
  assert.deepEqual(range(NaN, 5), []);
});

test("sum returns the total of numeric items and ignores NaN entries", () => {
  assert.equal(sum([1, 2, 3, 4]), 10);
  assert.equal(sum([]), 0);
  assert.equal(sum([-1, 1, 2]), 2);
  assert.equal(sum([1, NaN, 2]), 3);
});

test("average returns the arithmetic mean and NaN for empty input", () => {
  assert.equal(average([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(average([])));
});

test("median returns the middle value (odd) or averaged middle (even)", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.ok(Number.isNaN(median([])));
});

test("formatNumber groups thousands and respects decimals", () => {
  assert.equal(formatNumber(1234567.891, { decimals: 2 }), "1,234,567.89");
  assert.equal(formatNumber(1234567), "1,234,567");
  assert.equal(formatNumber(0.5, { decimals: 2 }), "0.50");
});

test("formatNumber honours custom separators", () => {
  assert.equal(
    formatNumber(1234567, { thousandsSeparator: " " }),
    "1 234 567",
  );
  assert.equal(
    formatNumber(1234.5, { decimals: 1, decimalSeparator: "," }),
    "1,234,5",
  );
  // Verify explicit European-style formatting.
  assert.equal(
    formatNumber(1234567.89, {
      decimals: 2,
      thousandsSeparator: ".",
      decimalSeparator: ",",
    }),
    "1.234.567,89",
  );
});

test("formatNumber renders NaN as the literal string 'NaN'", () => {
  assert.equal(formatNumber(NaN), "NaN");
  assert.equal(formatNumber(Infinity), "NaN");
});

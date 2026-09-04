import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSampleSize,
  calculateConfidenceInterval,
  isSignificant,
  calculateEffectSize,
  normalCdf,
  inverseNormalCdf,
  zCritical,
  Z_TABLE,
} from "../lib/experiment-statistics-pure.ts";

test("normalCdf and inverseNormalCdf are mutual inverses for common probabilities", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(normalCdf(-10) < 1e-9);
  assert.ok(normalCdf(10) > 1 - 1e-9);
  for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const z = inverseNormalCdf(p);
    assert.ok(Math.abs(normalCdf(z) - p) < 1e-4, `failed for p=${p}`);
  }
});

test("zCritical returns 1.96 for 0.95 and uses the lookup table for known levels", () => {
  assert.ok(Math.abs(zCritical(0.95) - Z_TABLE["0.95"]) < 1e-9);
  assert.ok(Math.abs(zCritical(0.95) - 1.959963984540054) < 1e-6);
});

test("calculateSampleSize returns a finite, positive integer for valid inputs", () => {
  const n = calculateSampleSize({
    baselineRate: 0.1,
    minimumDetectableEffect: 0.02,
  });
  assert.ok(Number.isFinite(n));
  assert.ok(n >= 30);
  assert.equal(n, Math.ceil(n));
});

test("calculateSampleSize scales inversely with the square of the MDE", () => {
  const small = calculateSampleSize({ baselineRate: 0.1, minimumDetectableEffect: 0.04 });
  const large = calculateSampleSize({ baselineRate: 0.1, minimumDetectableEffect: 0.02 });
  // Halving the MDE roughly quadruples the required sample size.
  assert.ok(large > small * 3);
});

test("calculateSampleSize returns Infinity for non-positive MDE", () => {
  assert.equal(
    calculateSampleSize({ baselineRate: 0.1, minimumDetectableEffect: 0 }),
    Infinity,
  );
});

test("calculateConfidenceInterval returns a [0,1] interval around the estimate", () => {
  const ci = calculateConfidenceInterval({ n: 1000, successes: 200 });
  assert.ok(ci.lower >= 0 && ci.upper <= 1);
  assert.ok(ci.lower < ci.estimate && ci.estimate < ci.upper);
  assert.ok(Math.abs(ci.estimate - 0.2) < 1e-9);
});

test("calculateConfidenceInterval widens for lower confidence levels", () => {
  const high = calculateConfidenceInterval({ n: 1000, successes: 200 }, 0.99);
  const low = calculateConfidenceInterval({ n: 1000, successes: 200 }, 0.8);
  assert.ok(high.upper - high.lower > low.upper - low.lower);
});

test("calculateConfidenceInterval returns zero interval for non-positive n", () => {
  const ci = calculateConfidenceInterval({ n: 0, successes: 0 });
  assert.equal(ci.lower, 0);
  assert.equal(ci.upper, 0);
  assert.equal(ci.estimate, 0);
});

test("isSignificant returns false when sample sizes are too small to detect a difference", () => {
  const res = isSignificant(
    { n: 10, successes: 5 },
    { n: 10, successes: 4 },
  );
  assert.equal(res.significant, false);
});

test("isSignificant returns true for a clear difference with enough samples", () => {
  const res = isSignificant(
    { n: 5000, successes: 1000 },
    { n: 5000, successes: 1250 },
  );
  assert.equal(res.significant, true);
  assert.ok(res.z > 1.96);
  assert.ok(res.pValue < 0.05);
});

test("isSignificant returns false for identical proportions", () => {
  const res = isSignificant(
    { n: 1000, successes: 200 },
    { n: 1000, successes: 200 },
  );
  assert.equal(res.significant, false);
  assert.equal(res.z, 0);
  assert.ok(res.pValue > 0.99);
});

test("calculateEffectSize (Cohen's h) is zero for identical proportions and grows with the gap", () => {
  assert.equal(
    calculateEffectSize({ n: 100, successes: 50 }, { n: 100, successes: 50 }),
    0,
  );
  const big = calculateEffectSize({ n: 100, successes: 90 }, { n: 100, successes: 10 });
  assert.ok(big > 0.8); // large effect
});

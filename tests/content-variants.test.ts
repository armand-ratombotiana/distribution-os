import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calculateCtr,
  calculateConversionRate,
  calculateVariantScore,
  getBestVariant,
  isStatisticallySignificant,
  shouldDeclareWinner,
  summarizeVariantForDisplay,
  type VariantStats,
} from "../lib/content-variants-pure.js";

function makeVariant(
  id: string,
  impressions: number,
  clicks: number,
  conversions = 0,
): VariantStats {
  return { id, impressions, clicks, conversions };
}

test("calculateCtr returns clicks divided by impressions", () => {
  assert.equal(calculateCtr(1000, 50), 0.05);
  assert.equal(calculateCtr(4, 2), 0.5);
});

test("calculateCtr returns 0 when impressions is 0 or negative", () => {
  assert.equal(calculateCtr(0, 5), 0);
  assert.equal(calculateCtr(-10, 5), 0);
});

test("calculateConversionRate returns conversions divided by clicks", () => {
  assert.equal(calculateConversionRate(50, 5), 0.1);
  assert.equal(calculateConversionRate(10, 3), 0.3);
});

test("calculateConversionRate returns 0 when clicks is 0 or negative", () => {
  assert.equal(calculateConversionRate(0, 5), 0);
  assert.equal(calculateConversionRate(-1, 5), 0);
});

test("calculateVariantScore combines CTR and conversion rate", () => {
  // CTR = 0.1, CVR = 0.2 → 0.1 * 0.2 * 100 = 2
  const score = calculateVariantScore(makeVariant("a", 100, 10, 2));
  assert.ok(Math.abs(score - 2) < 1e-9);
});

test("getBestVariant returns null for an empty list", () => {
  assert.equal(getBestVariant([]), null);
});

test("getBestVariant returns the single variant when only one is provided", () => {
  const v = makeVariant("a", 100, 10, 2);
  assert.equal(getBestVariant([v]), v);
});

test("getBestVariant returns the variant with the highest score", () => {
  const a = makeVariant("a", 100, 5, 1); // 0.05 * 0.2 * 100 = 1
  const b = makeVariant("b", 100, 20, 4); // 0.2 * 0.2 * 100 = 4
  const c = makeVariant("c", 100, 10, 1); // 0.1 * 0.1 * 100 = 1
  assert.equal(getBestVariant([a, b, c])?.id, "b");
});

test("isStatisticallySignificant returns false when sample size is too small", () => {
  const a = makeVariant("a", 30, 10, 0);
  const b = makeVariant("b", 30, 20, 0);
  assert.equal(isStatisticallySignificant(a, b), false);
});

test("isStatisticallySignificant returns true for a clear difference at scale", () => {
  const a = makeVariant("a", 5000, 100, 0); // CTR 2%
  const b = makeVariant("b", 5000, 300, 0); // CTR 6%
  assert.equal(isStatisticallySignificant(a, b), true);
});

test("isStatisticallySignificant returns false for very similar variants", () => {
  const a = makeVariant("a", 5000, 250, 0); // CTR 5%
  const b = makeVariant("b", 5000, 251, 0); // CTR ~5%
  assert.equal(isStatisticallySignificant(a, b), false);
});

test("shouldDeclareWinner returns null when fewer than two variants exist", () => {
  assert.equal(shouldDeclareWinner([makeVariant("a", 5000, 250)]), null);
});

test("shouldDeclareWinner returns the best variant when it is significant against all others", () => {
  const a = makeVariant("a", 5000, 100, 5); // CTR 2%, CVR 5%, score 0.1
  const b = makeVariant("b", 5000, 300, 30); // CTR 6%, CVR 10%, score 0.6
  const c = makeVariant("c", 5000, 50, 1); // CTR 1%, CVR 2%, score 0.02
  const winner = shouldDeclareWinner([a, b, c]);
  assert.equal(winner?.id, "b");
});

test("summarizeVariantForDisplay formats CTR and CVR as percentage strings", () => {
  const summary = summarizeVariantForDisplay(makeVariant("a", 1000, 50, 5));
  assert.equal(summary.ctr, "5.00%");
  assert.equal(summary.cvr, "10.00%");
  assert.match(summary.score, /^\d+\.\d{4}$/);
});

test("summarizeVariantForDisplay includes raw impression, click and conversion counts", () => {
  const summary = summarizeVariantForDisplay(makeVariant("a", 1000, 50, 5));
  assert.equal(summary.impressions, 1000);
  assert.equal(summary.clicks, 50);
  assert.equal(summary.conversions, 5);
  assert.equal(summary.id, "a");
});

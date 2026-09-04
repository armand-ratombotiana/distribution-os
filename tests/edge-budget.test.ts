/**
 * Edge-case tests for the budget pure logic (lib/budget-pure.ts).
 *
 * Each test exercises a boundary: zero budget, negative spent, over budget,
 * exactly at limit, daily reset boundary, monthly reset boundary, etc.
 *
 * Run:  npx tsx --test tests/edge-budget.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BUDGET,
  checkBudget,
  checkQuota,
  formatBudgetUsage,
  formatCents,
  isBudgetWarning,
  shouldResetDaily,
  shouldResetMonthly,
} from "../lib/budget-pure";

const cfg = (overrides: Partial<typeof DEFAULT_BUDGET> = {}): typeof DEFAULT_BUDGET => ({
  monthlyLimitCents: 100_00,
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
  ...overrides,
});

test("edge: checkBudget with zero budget reports 'exceeded' (0 >= 0 is true)", () => {
  // A zero-limit budget with zero spend still trips the `spent >= limit`
  // branch, so severity is "exceeded" and allowed is false. The usage ratio
  // is clamped to 0 by the `limit > 0 ? spent / limit : 0` guard.
  const result = checkBudget(0, cfg({ monthlyLimitCents: 0 }));
  assert.equal(result.limitCents, 0);
  assert.equal(result.usageRatio, 0);
  assert.equal(result.remainingCents, 0);
  assert.equal(result.severity, "exceeded");
  assert.equal(result.allowed, false); // 0 < 0 is false
});

test("edge: checkBudget with negative spent treats remaining as full limit (Math.max(0, limit - spent))", () => {
  // A negative spend (e.g. refund) makes `remaining = limit - (-|spent|)`,
  // which exceeds the limit. Math.max(0, ...) does NOT cap the upper bound,
  // so remaining can exceed the limit.
  const result = checkBudget(-50_00, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.spentCents, -50_00);
  assert.equal(result.remainingCents, 150_00); // 100 - (-50) = 150
  assert.equal(result.usageRatio, -0.5);
  assert.equal(result.severity, "ok");
  assert.equal(result.allowed, true); // -50 < 100
});

test("edge: checkBudget exactly at the limit is 'exceeded' (allowed=false)", () => {
  const result = checkBudget(100_00, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.spentCents, 100_00);
  assert.equal(result.remainingCents, 0);
  assert.equal(result.usageRatio, 1);
  assert.equal(result.severity, "exceeded");
  assert.equal(result.allowed, false);
});

test("edge: checkBudget one cent below the limit is 'critical' but still allowed", () => {
  const result = checkBudget(99_99, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.remainingCents, 1);
  assert.equal(result.usageRatio, 0.9999);
  assert.equal(result.severity, "critical");
  assert.equal(result.allowed, true);
});

test("edge: checkBudget far over the limit clamps remaining to 0 (no negative remaining leaks)", () => {
  const result = checkBudget(500_00, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.remainingCents, 0); // Math.max(0, 100 - 500) = 0
  assert.equal(result.usageRatio, 5);
  assert.equal(result.severity, "exceeded");
  assert.equal(result.allowed, false);
});

test("edge: checkBudget at exactly the warning threshold (80%) is 'warning'", () => {
  const result = checkBudget(80_00, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.usageRatio, 0.8);
  assert.equal(result.severity, "warning");
  assert.equal(result.allowed, true);
});

test("edge: checkBudget at exactly the critical threshold (95%) is 'critical'", () => {
  const result = checkBudget(95_00, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.usageRatio, 0.95);
  assert.equal(result.severity, "critical");
  assert.equal(result.allowed, true);
});

test("edge: checkBudget one cent below the warning threshold (79.99) is still 'ok'", () => {
  const result = checkBudget(79_99, cfg({ monthlyLimitCents: 100_00 }));
  assert.equal(result.usageRatio, 0.7999);
  assert.equal(result.severity, "ok");
});

test("edge: shouldResetMonthly is true at the first millisecond of the next month", () => {
  // 2024-01-31T23:59:59.999Z → 2024-02-01T00:00:00.000Z is the monthly reset
  // boundary in UTC.
  const endOfJan = Date.UTC(2024, 0, 31, 23, 59, 59, 999);
  const startOfFeb = Date.UTC(2024, 1, 1, 0, 0, 0, 0);
  assert.equal(shouldResetMonthly(endOfJan, startOfFeb), true);
  // Same month, different day → false.
  const midJan = Date.UTC(2024, 0, 15);
  assert.equal(shouldResetMonthly(endOfJan, midJan), false);
  // Identical timestamps → false.
  assert.equal(shouldResetMonthly(endOfJan, endOfJan), false);
});

test("edge: shouldResetMonthly is false when now is earlier than lastReset (clock skew)", () => {
  // A clock that went backward must not trigger a reset.
  const last = Date.UTC(2024, 0, 15);
  const earlier = Date.UTC(2024, 0, 1);
  assert.equal(shouldResetMonthly(last, earlier), false);
});

test("edge: shouldResetDaily boundary — same UTC day at 23:59:59.999 vs next day 00:00:00.000", () => {
  const endOfDay = Date.UTC(2024, 0, 15, 23, 59, 59, 999);
  const startOfNextDay = Date.UTC(2024, 0, 16, 0, 0, 0, 0);
  assert.equal(shouldResetDaily(endOfDay, startOfNextDay), true);
  // Same calendar day, different hour → false.
  const sameDayLater = Date.UTC(2024, 0, 15, 23, 0, 0, 0);
  assert.equal(shouldResetDaily(endOfDay, sameDayLater), false);
});

test("edge: shouldResetDaily boundary across month-end (Jan 31 → Feb 1)", () => {
  const jan31 = Date.UTC(2024, 0, 31, 12, 0, 0);
  const feb1 = Date.UTC(2024, 1, 1, 0, 0, 0);
  assert.equal(shouldResetDaily(jan31, feb1), true);
  assert.equal(shouldResetMonthly(jan31, feb1), true);
});

test("edge: checkQuota at exactly the limit returns allowed=false and remaining=0", () => {
  const at = checkQuota(100, 100);
  assert.equal(at.allowed, false);
  assert.equal(at.remaining, 0);
  // One below the limit is still allowed.
  const below = checkQuota(99, 100);
  assert.equal(below.allowed, true);
  assert.equal(below.remaining, 1);
  // Over the limit clamps remaining to 0 (no negative).
  const over = checkQuota(150, 100);
  assert.equal(over.allowed, false);
  assert.equal(over.remaining, 0);
});

test("edge: formatCents handles boundary values 0, -1, MAX_SAFE_INTEGER and NaN", () => {
  assert.equal(formatCents(0), "0.00");
  assert.equal(formatCents(-1), "-0.01");
  assert.equal(formatCents(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  // Non-finite values return "0.00" (defensive fallback).
  assert.equal(formatCents(Number.NaN), "0.00");
  assert.equal(formatCents(Number.POSITIVE_INFINITY), "0.00");
});

test("edge: isBudgetWarning and formatBudgetUsage at boundary ratios", () => {
  // isBudgetWarning uses strict >= (so 0.79 is false, 0.80 is true).
  assert.equal(isBudgetWarning(0.79), false);
  assert.equal(isBudgetWarning(0.80), true);
  assert.equal(isBudgetWarning(1.0), true);
  assert.equal(isBudgetWarning(2.5), true);
  // formatBudgetUsage clamps to "0%" for non-positive limits.
  assert.equal(formatBudgetUsage(50, 0), "0%");
  assert.equal(formatBudgetUsage(50, -10), "0%");
  // Boundary at 100% exactly.
  assert.equal(formatBudgetUsage(100_00, 100_00), "100.0%");
  // Over 100% is allowed (no clamping on the ratio).
  assert.equal(formatBudgetUsage(150_00, 100_00), "150.0%");
});

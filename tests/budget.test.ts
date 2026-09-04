import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkBudget,
  checkQuota,
  DEFAULT_BUDGET,
  DEFAULT_QUOTA,
  formatBudgetUsage,
  formatCents,
  isBudgetWarning,
  shouldResetDaily,
  shouldResetMonthly,
} from "../lib/budget-pure.ts";

test("DEFAULT_BUDGET exposes a $10,000 monthly cap with 80/95 thresholds", () => {
  assert.equal(DEFAULT_BUDGET.monthlyLimitCents, 1_000_00);
  assert.equal(DEFAULT_BUDGET.warningThreshold, 0.8);
  assert.equal(DEFAULT_BUDGET.criticalThreshold, 0.95);
});

test("DEFAULT_QUOTA exposes monthly, daily, and per-request caps", () => {
  assert.equal(DEFAULT_QUOTA.monthlyLimit, 10_000);
  assert.equal(DEFAULT_QUOTA.dailyLimit, 500);
  assert.equal(DEFAULT_QUOTA.perRequestLimit, 100);
});

test("checkBudget allows spend that stays under the limit", () => {
  const result = checkBudget(50_000, DEFAULT_BUDGET);
  assert.equal(result.allowed, true);
  assert.equal(result.severity, "ok");
  assert.equal(result.limitCents, DEFAULT_BUDGET.monthlyLimitCents);
});

test("checkBudget denies spend at or over the limit", () => {
  const at = checkBudget(DEFAULT_BUDGET.monthlyLimitCents, DEFAULT_BUDGET);
  assert.equal(at.allowed, false);
  assert.equal(at.severity, "exceeded");
  assert.equal(at.remainingCents, 0);

  const over = checkBudget(DEFAULT_BUDGET.monthlyLimitCents + 5_00, DEFAULT_BUDGET);
  assert.equal(over.allowed, false);
  assert.equal(over.severity, "exceeded");
  assert.equal(over.remainingCents, 0);
});

test("checkBudget reports remaining cents and usage ratio", () => {
  const result = checkBudget(25_00, { monthlyLimitCents: 100_00, warningThreshold: 0.8, criticalThreshold: 0.95 });
  assert.equal(result.spentCents, 25_00);
  assert.equal(result.limitCents, 100_00);
  assert.equal(result.remainingCents, 75_00);
  assert.ok(Math.abs(result.usageRatio - 0.25) < 1e-9);
});

test("checkBudget severity stays 'ok' below the warning threshold", () => {
  const result = checkBudget(79_00, { monthlyLimitCents: 100_00, warningThreshold: 0.8, criticalThreshold: 0.95 });
  assert.equal(result.severity, "ok");
});

test("checkBudget severity becomes 'warning' at >= 80%", () => {
  const cfg = { monthlyLimitCents: 100_00, warningThreshold: 0.8, criticalThreshold: 0.95 };
  assert.equal(checkBudget(80_00, cfg).severity, "warning");
  assert.equal(checkBudget(94_99, cfg).severity, "warning");
});

test("checkBudget severity becomes 'critical' at >= 95% but below 100%", () => {
  const cfg = { monthlyLimitCents: 100_00, warningThreshold: 0.8, criticalThreshold: 0.95 };
  assert.equal(checkBudget(95_00, cfg).severity, "critical");
  assert.equal(checkBudget(99_99, cfg).severity, "critical");
  assert.equal(checkBudget(95_00, cfg).allowed, true);
});

test("checkBudget severity is 'exceeded' once spend reaches the limit", () => {
  const cfg = { monthlyLimitCents: 100_00, warningThreshold: 0.8, criticalThreshold: 0.95 };
  assert.equal(checkBudget(100_00, cfg).severity, "exceeded");
  assert.equal(checkBudget(150_00, cfg).severity, "exceeded");
});

test("checkQuota allows usage under the limit and denies at/over", () => {
  assert.equal(checkQuota(5, 10).allowed, true);
  assert.equal(checkQuota(5, 10).remaining, 5);
  assert.equal(checkQuota(10, 10).allowed, false);
  assert.equal(checkQuota(10, 10).remaining, 0);
  assert.equal(checkQuota(15, 10).allowed, false);
  assert.equal(checkQuota(15, 10).remaining, 0);
});

test("shouldResetMonthly is true across month and year boundaries", () => {
  const jan1 = Date.UTC(2024, 0, 1);
  const feb1 = Date.UTC(2024, 1, 1);
  const jan1Next = Date.UTC(2025, 0, 1);
  const midJan = Date.UTC(2024, 0, 15);
  assert.equal(shouldResetMonthly(jan1, feb1), true);
  assert.equal(shouldResetMonthly(jan1, jan1Next), true);
  assert.equal(shouldResetMonthly(jan1, midJan), false);
  assert.equal(shouldResetMonthly(jan1, jan1), false);
});

test("shouldResetDaily is true across day, month, and year boundaries", () => {
  const jan1 = Date.UTC(2024, 0, 1);
  const jan2 = Date.UTC(2024, 0, 2);
  const feb1 = Date.UTC(2024, 1, 1);
  const jan1Next = Date.UTC(2025, 0, 1);
  const sameDay = Date.UTC(2024, 0, 1, 23, 59, 59);
  assert.equal(shouldResetDaily(jan1, jan2), true);
  assert.equal(shouldResetDaily(jan1, feb1), true);
  assert.equal(shouldResetDaily(jan1, jan1Next), true);
  assert.equal(shouldResetDaily(jan1, sameDay), false);
  assert.equal(shouldResetDaily(jan1, jan1), false);
});

test("formatCents formats positive, zero, and large amounts with two decimals", () => {
  assert.equal(formatCents(1099), "10.99");
  assert.equal(formatCents(0), "0.00");
  assert.equal(formatCents(5), "0.05");
  assert.equal(formatCents(100000), "1000.00");
  assert.equal(formatCents(99), "0.99");
});

test("formatCents formats negative amounts and rounds half-away-from-zero", () => {
  assert.equal(formatCents(-5), "-0.05");
  assert.equal(formatCents(-1099), "-10.99");
  assert.equal(formatCents(-100), "-1.00");
  // Rounding: 10.995 cents → 11 cents (Math.round rounds half up).
  assert.equal(formatCents(1099.5), "11.00");
});

test("formatBudgetUsage and isBudgetWarning behave at thresholds", () => {
  assert.equal(formatBudgetUsage(50_00, 100_00), "50.0%");
  assert.equal(formatBudgetUsage(0, 100_00), "0.0%");
  assert.equal(formatBudgetUsage(80_00, 100_00), "80.0%");
  assert.equal(formatBudgetUsage(0, 0), "0%");

  assert.equal(isBudgetWarning(0.7), false);
  assert.equal(isBudgetWarning(0.8), true);
  assert.equal(isBudgetWarning(0.95), true);
  assert.equal(isBudgetWarning(1.0), true);

  const custom = { monthlyLimitCents: 100_00, warningThreshold: 0.5, criticalThreshold: 0.9 };
  assert.equal(isBudgetWarning(0.49, custom), false);
  assert.equal(isBudgetWarning(0.5, custom), true);
});

/**
 * Property-based budget tests.
 *
 * 15 tests covering `lib/budget-pure.ts`:
 *   - `checkBudget`         — severity, allowed flag, remaining, usage ratio.
 *   - `checkQuota`          — allowed flag, remaining.
 *   - `formatCents`         — integer-cents → USD string.
 *   - `formatBudgetUsage`   — usage ratio → percentage string.
 *   - `shouldResetMonthly`  — month-boundary detection.
 *   - `shouldResetDaily`    — day-boundary detection.
 *   - `isBudgetWarning`     — warning threshold check.
 *
 * Properties verified:
 *   - Never exceeds limits — when `spent >= limit`, `allowed === false`.
 *   - Correct remaining calculation — `remaining = max(0, limit - spent)`.
 *   - Severity monotonicity — ok < warning < critical < exceeded as spend
 *     increases from 0 to limit (and beyond).
 *   - formatCents never returns a malformed USD string.
 *
 * Inputs are produced by a deterministic seeded PRNG (mulberry32).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkBudget,
  checkQuota,
  formatCents,
  formatBudgetUsage,
  shouldResetMonthly,
  shouldResetDaily,
  isBudgetWarning,
  DEFAULT_BUDGET,
  DEFAULT_QUOTA,
  type BudgetConfig,
} from "../lib/budget-pure.ts";

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

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const SAMPLES = 200;

// ─── 1. checkBudget: spent < limit → allowed, severity ok/warning/critical ─

test("property/budget-check: spent < limit yields allowed=true and remaining = limit - spent", () => {
  const rng = mulberry32(901);
  for (let i = 0; i < SAMPLES; i++) {
    const limit = randomInt(rng, 100, 1_000_000);
    const spent = randomInt(rng, 0, limit - 1);
    const config: BudgetConfig = {
      monthlyLimitCents: limit,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    };
    const r = checkBudget(spent, config);
    assert.equal(r.allowed, true);
    assert.equal(r.spentCents, spent);
    assert.equal(r.limitCents, limit);
    assert.equal(r.remainingCents, limit - spent);
    assert.equal(r.usageRatio, spent / limit);
    // Severity must be one of ok / warning / critical when spent < limit.
    assert.ok(["ok", "warning", "critical"].includes(r.severity));
  }
});

// ─── 2. checkBudget: spent >= limit → allowed=false, severity=exceeded ────

test("property/budget-check: spent >= limit yields allowed=false, severity=exceeded, remaining=0", () => {
  const rng = mulberry32(902);
  for (let i = 0; i < SAMPLES; i++) {
    const limit = randomInt(rng, 100, 1_000_000);
    const spent = limit + randomInt(rng, 0, 1_000_000);
    const r = checkBudget(spent, { monthlyLimitCents: limit, warningThreshold: 0.8, criticalThreshold: 0.95 });
    assert.equal(r.allowed, false);
    assert.equal(r.severity, "exceeded");
    assert.equal(r.remainingCents, 0);
    // usageRatio can exceed 1.0.
    assert.equal(r.usageRatio, spent / limit);
    assert.ok(r.usageRatio >= 1);
  }
});

// ─── 3. checkBudget: severity monotonicity (ok < warning < critical < exceeded) ─

test("property/budget-check: severity transitions ok → warning → critical → exceeded as spend increases", () => {
  const rng = mulberry32(903);
  const limit = 10_000;
  const config: BudgetConfig = {
    monthlyLimitCents: limit,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  };
  for (let i = 0; i < SAMPLES; i++) {
    // ok: spent in [0, 80% of limit).
    const okSpent = randomInt(rng, 0, Math.floor(0.79 * limit));
    assert.equal(checkBudget(okSpent, config).severity, "ok");
    // warning: spent in [80%, 95%) of limit.
    const warnSpent = randomInt(rng, Math.floor(0.8 * limit), Math.floor(0.949 * limit));
    assert.equal(checkBudget(warnSpent, config).severity, "warning");
    // critical: spent in [95%, 100%) of limit.
    const critSpent = randomInt(rng, Math.floor(0.95 * limit), limit - 1);
    assert.equal(checkBudget(critSpent, config).severity, "critical");
    // exceeded: spent >= limit.
    const excSpent = limit + randomInt(rng, 0, 1000);
    assert.equal(checkBudget(excSpent, config).severity, "exceeded");
  }
});

// ─── 4. checkBudget: boundary at exactly the threshold ────────────────────

test("property/budget-check: spent exactly at warning/critical/limit boundaries yields the higher severity", () => {
  const rng = mulberry32(904);
  const limit = 10_000;
  const config: BudgetConfig = {
    monthlyLimitCents: limit,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  };
  for (let i = 0; i < SAMPLES; i++) {
    // Exactly 80% → warning.
    assert.equal(checkBudget(8000, config).severity, "warning");
    // Exactly 95% → critical.
    assert.equal(checkBudget(9500, config).severity, "critical");
    // Exactly 100% → exceeded.
    assert.equal(checkBudget(10_000, config).severity, "exceeded");
    // Exactly 0 → ok, remaining = limit.
    const r = checkBudget(0, config);
    assert.equal(r.severity, "ok");
    assert.equal(r.remainingCents, limit);
    assert.equal(r.usageRatio, 0);
  }
});

// ─── 5. checkBudget: remaining never goes negative ────────────────────────

test("property/budget-check: remainingCents is always >= 0, even when spent >> limit", () => {
  const rng = mulberry32(905);
  for (let i = 0; i < SAMPLES; i++) {
    const limit = randomInt(rng, 1, 100_000);
    const spent = randomInt(rng, 0, limit * 10);
    const r = checkBudget(spent, { monthlyLimitCents: limit, warningThreshold: 0.8, criticalThreshold: 0.95 });
    assert.ok(r.remainingCents >= 0);
    if (spent >= limit) {
      assert.equal(r.remainingCents, 0);
    } else {
      assert.equal(r.remainingCents, limit - spent);
    }
  }
});

// ─── 6. checkQuota: used < limit → allowed; used >= limit → not allowed ───

test("property/budget-quota: allowed iff used < limit; remaining = max(0, limit - used)", () => {
  const rng = mulberry32(906);
  for (let i = 0; i < SAMPLES; i++) {
    const limit = randomInt(rng, 1, 10_000);
    const used = randomInt(rng, 0, limit * 2);
    const r = checkQuota(used, limit);
    assert.equal(r.allowed, used < limit);
    assert.equal(r.used, used);
    assert.equal(r.limit, limit);
    assert.equal(r.remaining, Math.max(0, limit - used));
    assert.ok(r.remaining >= 0);
  }
});

// ─── 7. formatCents: well-formed USD string ───────────────────────────────

test("property/budget-formatCents: always returns a USD-formatted string with two decimal places", () => {
  const rng = mulberry32(907);
  const USD_RE = /^-?\d+\.\d{2}$/;
  for (let i = 0; i < SAMPLES; i++) {
    const cents = randomInt(rng, -1_000_000, 1_000_000);
    const s = formatCents(cents);
    assert.match(s, USD_RE, `malformed USD string: "${s}" for cents=${cents}`);
    // Negative amounts are prefixed with "-".
    if (cents < 0) {
      assert.ok(s.startsWith("-"));
    }
    // Zero is "0.00".
    if (cents === 0) {
      assert.equal(s, "0.00");
    }
  }
});

// ─── 8. formatCents: known vectors ────────────────────────────────────────

test("property/budget-formatCents: known vectors (1099→10.99, 0→0.00, -5→-0.05, 100→1.00)", () => {
  assert.equal(formatCents(1099), "10.99");
  assert.equal(formatCents(0), "0.00");
  assert.equal(formatCents(-5), "-0.05");
  assert.equal(formatCents(100), "1.00");
  assert.equal(formatCents(1), "0.01");
  assert.equal(formatCents(99), "0.99");
  assert.equal(formatCents(123456), "1234.56");
});

// ─── 9. formatCents: rounds to nearest cent ───────────────────────────────

test("property/budget-formatCents: rounds half-up to nearest cent for fractional inputs", () => {
  const rng = mulberry32(908);
  for (let i = 0; i < SAMPLES; i++) {
    const base = randomInt(rng, 0, 100_000);
    // Add a fractional part — formatCents uses Math.round.
    const withFraction = base + 0.5;
    const s = formatCents(withFraction);
    assert.match(s, /^-?\d+\.\d{2}$/);
    // Math.round(base + 0.5) === base + 1 (round half-up for positive).
    const expected = base + 1;
    assert.equal(s, formatCents(expected));
  }
});

// ─── 10. formatBudgetUsage: well-formed percentage string ─────────────────

test("property/budget-formatUsage: returns a percentage string with one decimal place", () => {
  const rng = mulberry32(909);
  const PCT_RE = /^-?\d+(\.\d)?%$/;
  for (let i = 0; i < SAMPLES; i++) {
    const spent = randomInt(rng, 0, 1_000_000);
    const limit = randomInt(rng, 1, 1_000_000);
    const s = formatBudgetUsage(spent, limit);
    assert.match(s, PCT_RE, `malformed percentage: "${s}"`);
    // Value matches (spent / limit) * 100 with one decimal.
    const expected = ((spent / limit) * 100).toFixed(1) + "%";
    assert.equal(s, expected);
  }
});

// ─── 11. formatBudgetUsage: limit <= 0 → "0%" ─────────────────────────────

test("property/budget-formatUsage: limit <= 0 yields '0%' (no division by zero)", () => {
  const rng = mulberry32(910);
  for (let i = 0; i < SAMPLES; i++) {
    const spent = randomInt(rng, 0, 1_000_000);
    assert.equal(formatBudgetUsage(spent, 0), "0%");
    assert.equal(formatBudgetUsage(spent, -1), "0%");
  }
});

// ─── 12. shouldResetMonthly: detects calendar-month boundary ──────────────

test("property/budget-reset-monthly: returns true iff now is in a different calendar month than lastReset (UTC)", () => {
  const rng = mulberry32(911);
  for (let i = 0; i < SAMPLES; i++) {
    // Pick a random UTC year/month.
    const year = 2020 + Math.floor(rng() * 10);
    const month = Math.floor(rng() * 12); // 0-11
    const lastReset = Date.UTC(year, month, 15, 12, 0, 0);
    // now in the same month → false.
    const sameMonth = Date.UTC(year, month, 20, 6, 0, 0);
    assert.equal(shouldResetMonthly(lastReset, sameMonth), false);
    // now in the next month → true.
    const nextMonth = Date.UTC(year, month + 1, 1, 0, 0, 0);
    assert.equal(shouldResetMonthly(lastReset, nextMonth), true);
    // now in the next year → true.
    const nextYear = Date.UTC(year + 1, 0, 1, 0, 0, 0);
    assert.equal(shouldResetMonthly(lastReset, nextYear), true);
    // now before lastReset → false.
    const before = Date.UTC(year, month, 1, 0, 0, 0);
    assert.equal(shouldResetMonthly(lastReset, before), false);
  }
});

// ─── 13. shouldResetDaily: detects calendar-day boundary ──────────────────

test("property/budget-reset-daily: returns true iff now is on a different UTC calendar day than lastReset", () => {
  const rng = mulberry32(912);
  for (let i = 0; i < SAMPLES; i++) {
    const year = 2020 + Math.floor(rng() * 10);
    const month = Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    const lastReset = Date.UTC(year, month, day, 12, 0, 0);
    // Same day, different time → false.
    const sameDay = Date.UTC(year, month, day, 23, 59, 59);
    assert.equal(shouldResetDaily(lastReset, sameDay), false);
    // Next day → true.
    const nextDay = Date.UTC(year, month, day + 1, 0, 0, 0);
    assert.equal(shouldResetDaily(lastReset, nextDay), true);
    // Same time next month → true.
    const nextMonth = Date.UTC(year, month + 1, day, 12, 0, 0);
    assert.equal(shouldResetDaily(lastReset, nextMonth), true);
    // Before lastReset → false.
    const before = Date.UTC(year, month, day, 0, 0, 0);
    assert.equal(shouldResetDaily(lastReset, before), false);
  }
});

// ─── 14. isBudgetWarning: threshold check ────────────────────────────────

test("property/budget-warning: isBudgetWarning returns true iff usageRatio >= warningThreshold", () => {
  const rng = mulberry32(913);
  for (let i = 0; i < SAMPLES; i++) {
    const warningThreshold = pick(rng, [0.5, 0.7, 0.8, 0.9, 0.95]);
    const config: BudgetConfig = {
      monthlyLimitCents: 10_000,
      warningThreshold,
      criticalThreshold: Math.min(0.99, warningThreshold + 0.05),
    };
    const ratio = rng() * 1.5; // [0, 1.5)
    const expected = ratio >= warningThreshold;
    assert.equal(isBudgetWarning(ratio, config), expected);
  }
});

// ─── 15. DEFAULT_BUDGET and DEFAULT_QUOTA invariants ──────────────────────

test("property/budget-defaults: DEFAULT_BUDGET and DEFAULT_QUOTA are stable, sensible, and internally consistent", () => {
  // DEFAULT_BUDGET.
  assert.ok(DEFAULT_BUDGET.monthlyLimitCents > 0);
  assert.ok(DEFAULT_BUDGET.warningThreshold > 0 && DEFAULT_BUDGET.warningThreshold < 1);
  assert.ok(DEFAULT_BUDGET.criticalThreshold > DEFAULT_BUDGET.warningThreshold);
  assert.ok(DEFAULT_BUDGET.criticalThreshold < 1);
  // Known values (pinned).
  assert.equal(DEFAULT_BUDGET.monthlyLimitCents, 1_000_00); // $10,000.00
  assert.equal(DEFAULT_BUDGET.warningThreshold, 0.8);
  assert.equal(DEFAULT_BUDGET.criticalThreshold, 0.95);
  // DEFAULT_QUOTA.
  assert.ok(DEFAULT_QUOTA.monthlyLimit > 0);
  assert.ok(DEFAULT_QUOTA.dailyLimit > 0);
  assert.ok(DEFAULT_QUOTA.perRequestLimit > 0);
  assert.ok(DEFAULT_QUOTA.dailyLimit <= DEFAULT_QUOTA.monthlyLimit);
  // Known values (pinned).
  assert.equal(DEFAULT_QUOTA.monthlyLimit, 10_000);
  assert.equal(DEFAULT_QUOTA.dailyLimit, 500);
  assert.equal(DEFAULT_QUOTA.perRequestLimit, 100);
});

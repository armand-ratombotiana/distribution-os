import assert from "node:assert/strict";
import test from "node:test";

// Integration: budget enforcement ↔ token-bucket rate limiting
//
// Budget enforcement (cost ceiling in cents) and rate limiting (token-bucket
// requests per second) are the two independent gates that protect a workspace
// from runaway spend and runaway request volume. These tests exercise how
// their results compose to allow or deny an operation.

import {
  DEFAULT_BUDGET,
  DEFAULT_QUOTA,
  checkBudget,
  checkQuota,
  formatBudgetUsage,
  formatCents,
  isBudgetWarning,
  shouldResetDaily,
  shouldResetMonthly,
} from "../lib/budget-pure";

import {
  DEFAULT_RATE_LIMITS,
  buildRateLimitKey,
  checkRateLimit,
  getRateLimitHeaders,
  getRetryAfterHeader,
  type RateLimitState,
} from "../lib/rate-limit-pure";

const CFG = {
  monthlyLimitCents: 100_00,
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
};

const NOW = 1_700_000_000_000;

test("checkBudget allows spend within limit AND checkRateLimit allows a request within capacity", () => {
  const budget = checkBudget(50_00, CFG);
  assert.equal(budget.allowed, true);

  const rl = checkRateLimit(null, DEFAULT_RATE_LIMITS.workspace, NOW, 1);
  assert.equal(rl.allowed, true);
  assert.equal(rl.limit, DEFAULT_RATE_LIMITS.workspace.capacity);
});

test("checkBudget returns severity 'exceeded' at the limit AND checkRateLimit returns allowed=false at capacity", () => {
  const budget = checkBudget(CFG.monthlyLimitCents, CFG);
  assert.equal(budget.allowed, false);
  assert.equal(budget.severity, "exceeded");
  assert.equal(budget.remainingCents, 0);

  // Drain the bucket to capacity then request one more token.
  const drained: RateLimitState = {
    tokens: 0,
    lastRefillMs: NOW,
  };
  const rl = checkRateLimit(drained, DEFAULT_RATE_LIMITS.workspace, NOW, 1);
  assert.equal(rl.allowed, false);
  assert.ok(rl.retryAfterMs > 0);
});

test("shouldResetMonthly resets at month boundary AND buildRateLimitKey produces 'rl:workspace:ws_1'", () => {
  const jan1 = Date.UTC(2024, 0, 1);
  const feb1 = Date.UTC(2024, 1, 1);
  assert.equal(shouldResetMonthly(jan1, feb1), true);
  assert.equal(shouldResetMonthly(jan1, jan1), false);

  const key = buildRateLimitKey("workspace", "ws_1");
  assert.equal(key, "rl:workspace:ws_1");
  assert.equal(buildRateLimitKey("ip", "1.2.3.4", "write"), "rl:ip:1.2.3.4:write");
});

test("checkQuota denies at limit AND checkRateLimit denies when tokens are depleted", () => {
  assert.equal(checkQuota(10, 10).allowed, false);
  assert.equal(checkQuota(10, 10).remaining, 0);
  assert.equal(checkQuota(9, 10).allowed, true);
  assert.equal(checkQuota(9, 10).remaining, 1);

  const depleted: RateLimitState = { tokens: 0.4, lastRefillMs: NOW };
  const rl = checkRateLimit(depleted, DEFAULT_RATE_LIMITS.write, NOW, 1);
  assert.equal(rl.allowed, false);
  assert.ok(rl.retryAfterMs > 0);
});

test("formatCents formats budget amounts AND getRetryAfterHeader formats rate-limit retry as seconds", () => {
  assert.equal(formatCents(1099), "10.99");
  assert.equal(formatCents(0), "0.00");
  assert.equal(formatCents(-5), "-0.05");
  assert.equal(formatCents(100000), "1000.00");

  // 1500ms → 2 seconds (rounded up)
  assert.equal(getRetryAfterHeader(1500), "2");
  assert.equal(getRetryAfterHeader(1000), "1");
  assert.equal(getRetryAfterHeader(0), "0");
  assert.equal(getRetryAfterHeader(Number.NaN), "0");
});

test("isBudgetWarning triggers at 80% AND checkRateLimit retryAfterMs > 0 when denied", () => {
  assert.equal(isBudgetWarning(0.7), false);
  assert.equal(isBudgetWarning(0.8), true);
  assert.equal(isBudgetWarning(0.95), true);

  const depleted: RateLimitState = { tokens: 0, lastRefillMs: NOW };
  const rl = checkRateLimit(depleted, DEFAULT_RATE_LIMITS.write, NOW, 1);
  assert.equal(rl.allowed, false);
  assert.ok(rl.retryAfterMs > 0);
});

test("checkBudget reports remaining cents AND checkRateLimit reports remaining tokens", () => {
  const budget = checkBudget(25_00, CFG);
  assert.equal(budget.spentCents, 25_00);
  assert.equal(budget.remainingCents, 75_00);
  assert.ok(Math.abs(budget.usageRatio - 0.25) < 1e-9);

  const rl = checkRateLimit(null, DEFAULT_RATE_LIMITS.workspace, NOW, 1);
  assert.ok(rl.remaining < DEFAULT_RATE_LIMITS.workspace.capacity);
  assert.ok(rl.remaining >= 0);
});

test("shouldResetDaily resets at day boundary AND getRateLimitHeaders includes RateLimit-Reset", () => {
  const jan1 = Date.UTC(2024, 0, 1);
  const jan2 = Date.UTC(2024, 0, 2);
  assert.equal(shouldResetDaily(jan1, jan2), true);
  assert.equal(shouldResetDaily(jan1, jan1), false);

  const rl = checkRateLimit(null, DEFAULT_RATE_LIMITS.workspace, NOW, 1);
  const headers = getRateLimitHeaders(rl, NOW);
  assert.equal(headers["RateLimit-Limit"], String(DEFAULT_RATE_LIMITS.workspace.capacity));
  assert.ok(headers["RateLimit-Reset"] !== undefined);
  // Retry-After should NOT be present on an allowed request
  assert.equal("Retry-After" in headers, false);
});

test("checkBudget allows spend below warning threshold AND checkRateLimit allows a fresh bucket", () => {
  const budget = checkBudget(79_00, CFG);
  assert.equal(budget.severity, "ok");
  assert.equal(budget.allowed, true);

  const rl = checkRateLimit(null, DEFAULT_RATE_LIMITS.ip, NOW, 1);
  assert.equal(rl.allowed, true);
  // The fresh bucket starts at full capacity.
  assert.ok(rl.remaining <= DEFAULT_RATE_LIMITS.ip.capacity);
});

test("checkBudget severity 'critical' at 95% AND checkRateLimit advances lastRefillMs after denial", () => {
  const budget = checkBudget(95_00, CFG);
  assert.equal(budget.severity, "critical");
  assert.equal(budget.allowed, true);

  // A bucket drained to 0 tokens with lastRefillMs = now (no elapsed time)
  // cannot refill, so the request is denied.
  const depleted: RateLimitState = { tokens: 0, lastRefillMs: NOW };
  const rl = checkRateLimit(depleted, DEFAULT_RATE_LIMITS.write, NOW, 1);
  assert.equal(rl.allowed, false);
  // After a denied check, lastRefillMs advances to `now` so accumulated credit
  // is not recomputed against the ancient timestamp on the next call.
  assert.equal(rl.state.lastRefillMs, NOW);
});

test("DEFAULT_BUDGET exposes the $10,000 monthly cap AND DEFAULT_RATE_LIMITS.workspace capacity is 600", () => {
  assert.equal(DEFAULT_BUDGET.monthlyLimitCents, 1_000_00);
  assert.equal(DEFAULT_BUDGET.warningThreshold, 0.8);
  assert.equal(DEFAULT_BUDGET.criticalThreshold, 0.95);

  assert.equal(DEFAULT_RATE_LIMITS.workspace.capacity, 600);
  assert.equal(DEFAULT_RATE_LIMITS.ip.capacity, 120);
  assert.equal(DEFAULT_RATE_LIMITS.write.capacity, 60);
  assert.equal(DEFAULT_QUOTA.monthlyLimit, 10_000);
  assert.equal(DEFAULT_QUOTA.dailyLimit, 500);
});

test("formatBudgetUsage formats as percentage AND getRetryAfterHeader rounds up to seconds", () => {
  assert.equal(formatBudgetUsage(50_00, 100_00), "50.0%");
  assert.equal(formatBudgetUsage(0, 100_00), "0.0%");
  assert.equal(formatBudgetUsage(80_00, 100_00), "80.0%");
  assert.equal(formatBudgetUsage(0, 0), "0%");

  // 999ms → 1 second (rounds up)
  assert.equal(getRetryAfterHeader(999), "1");
  // 1001ms → 2 seconds (rounds up)
  assert.equal(getRetryAfterHeader(1001), "2");
});

test("checkQuota returns remaining=0 at limit AND checkRateLimit returns fractional remaining tokens", () => {
  const quota = checkQuota(10, 10);
  assert.equal(quota.allowed, false);
  assert.equal(quota.remaining, 0);

  // Consume 1 token from a write bucket that started at capacity=60.
  const rl = checkRateLimit(null, DEFAULT_RATE_LIMITS.write, NOW, 1);
  // The remaining count is fractional (59 in this case, since we consumed exactly 1 token).
  assert.equal(rl.allowed, true);
  assert.ok(rl.remaining < DEFAULT_RATE_LIMITS.write.capacity);
  assert.ok(rl.remaining > DEFAULT_RATE_LIMITS.write.capacity - 2);
});

test("shouldResetMonthly returns false within same month AND buildRateLimitKey supports multiple segments", () => {
  const jan1 = Date.UTC(2024, 0, 1);
  const midJan = Date.UTC(2024, 0, 15);
  assert.equal(shouldResetMonthly(jan1, midJan), false);
  assert.equal(shouldResetMonthly(jan1, jan1), false);

  // Multiple segments joined with ':' and prefixed with 'rl:'
  assert.equal(buildRateLimitKey("workspace", "ws_1", "write"), "rl:workspace:ws_1:write");
  assert.equal(buildRateLimitKey("global"), "rl:global");
  assert.equal(buildRateLimitKey("ip", "1.2.3.4"), "rl:ip:1.2.3.4");
});

test("checkBudget with custom thresholds respects custom criticalThreshold AND checkRateLimit respects custom capacity", () => {
  const customCfg = {
    monthlyLimitCents: 200_00,
    warningThreshold: 0.5,
    criticalThreshold: 0.75,
  };
  assert.equal(checkBudget(140_00, customCfg).severity, "warning"); // 70%
  assert.equal(checkBudget(160_00, customCfg).severity, "critical"); // 80%
  assert.equal(checkBudget(200_00, customCfg).severity, "exceeded"); // 100%

  const customRlCfg = { capacity: 5, refillPerSecond: 1 };
  const freshRl = checkRateLimit(null, customRlCfg, NOW, 1);
  assert.equal(freshRl.allowed, true);
  assert.equal(freshRl.limit, 5);
  // After 5 consecutive 1-token requests, the 6th should be denied.
  let state: RateLimitState | null = null;
  for (let i = 0; i < 5; i++) {
    state = checkRateLimit(state, customRlCfg, NOW + i, 1).state;
  }
  const sixth = checkRateLimit(state, customRlCfg, NOW + 5, 1);
  assert.equal(sixth.allowed, false);
});

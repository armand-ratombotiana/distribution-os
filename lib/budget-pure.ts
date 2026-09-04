/**
 * Pure budget & quota utilities.
 *
 * Money is tracked in integer **cents** to avoid floating-point rounding.
 * All functions are deterministic given their inputs.
 */

export interface BudgetConfig {
  /** Maximum monthly spend in cents. */
  monthlyLimitCents: number;
  /** Usage ratio at which a warning is raised. `0.8` == 80%. */
  warningThreshold: number;
  /** Usage ratio at which a critical alert is raised. `0.95` == 95%. */
  criticalThreshold: number;
}

/**
 * Default budget for a single workspace: $10,000/month, warn at 80%,
 * page at 95%.
 */
export const DEFAULT_BUDGET: BudgetConfig = {
  monthlyLimitCents: 1_000_00, // $10,000.00
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
};

export interface QuotaConfig {
  /** Maximum requests per calendar month. */
  monthlyLimit: number;
  /** Maximum requests per calendar day. */
  dailyLimit: number;
  /** Maximum tokens / items per single request. */
  perRequestLimit: number;
}

/**
 * Default request quotas for a single workspace.
 */
export const DEFAULT_QUOTA: QuotaConfig = {
  monthlyLimit: 10_000,
  dailyLimit: 500,
  perRequestLimit: 100,
};

export type BudgetSeverity = "ok" | "warning" | "critical" | "exceeded";

export interface BudgetCheckResult {
  allowed: boolean;
  spentCents: number;
  limitCents: number;
  remainingCents: number;
  /** Spent divided by limit, in `[0, ∞)`. */
  usageRatio: number;
  severity: BudgetSeverity;
}

/**
 * Evaluate current spend against a monthly budget.
 *
 * The result includes a `severity` field suitable for surfacing in
 * dashboards and a `allowed` flag that gates further spend.
 */
export function checkBudget(
  spentCents: number,
  config: BudgetConfig = DEFAULT_BUDGET,
): BudgetCheckResult {
  const limit = config.monthlyLimitCents;
  const remainingCents = Math.max(0, limit - spentCents);
  const usageRatio = limit > 0 ? spentCents / limit : 0;

  let severity: BudgetSeverity;
  if (spentCents >= limit) {
    severity = "exceeded";
  } else if (usageRatio >= config.criticalThreshold) {
    severity = "critical";
  } else if (usageRatio >= config.warningThreshold) {
    severity = "warning";
  } else {
    severity = "ok";
  }

  return {
    allowed: spentCents < limit,
    spentCents,
    limitCents: limit,
    remainingCents,
    usageRatio,
    severity,
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Evaluate a usage count against a hard limit. Returns `allowed: false`
 * once `used >= limit`.
 */
export function checkQuota(used: number, limit: number): QuotaCheckResult {
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Return `true` when `nowMs` falls in a different calendar month than
 * `lastResetMs` (in UTC).
 */
export function shouldResetMonthly(lastResetMs: number, nowMs: number): boolean {
  if (!Number.isFinite(lastResetMs) || !Number.isFinite(nowMs)) return false;
  if (nowMs < lastResetMs) return false;
  const last = new Date(lastResetMs);
  const now = new Date(nowMs);
  if (last.getUTCFullYear() !== now.getUTCFullYear()) return true;
  return last.getUTCMonth() !== now.getUTCMonth();
}

/**
 * Return `true` when `nowMs` falls on a different UTC calendar day than
 * `lastResetMs`.
 */
export function shouldResetDaily(lastResetMs: number, nowMs: number): boolean {
  if (!Number.isFinite(lastResetMs) || !Number.isFinite(nowMs)) return false;
  if (nowMs < lastResetMs) return false;
  const last = new Date(lastResetMs);
  const now = new Date(nowMs);
  if (last.getUTCFullYear() !== now.getUTCFullYear()) return true;
  if (last.getUTCMonth() !== now.getUTCMonth()) return true;
  return last.getUTCDate() !== now.getUTCDate();
}

/**
 * Format an integer number of cents as a decimal USD string with two
 * digits after the decimal point. Negative amounts are prefixed with `-`.
 *
 *   formatCents(1099)   → "10.99"
 *   formatCents(0)      → "0.00"
 *   formatCents(-5)     → "-0.05"
 */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return "0.00";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${dollars}.${rem.toString().padStart(2, "0")}`;
}

/**
 * Format the usage ratio of a budget as a percentage string with one
 * decimal of precision. Returns `"0%"` for non-positive limits.
 *
 *   formatBudgetUsage(5000, 10000) → "50.0%"
 */
export function formatBudgetUsage(spentCents: number, limitCents: number): string {
  if (limitCents <= 0) return "0%";
  const pct = (spentCents / limitCents) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Return `true` when the usage ratio has crossed the configured warning
 * threshold. Useful for fan-out to alerting channels.
 */
export function isBudgetWarning(
  usageRatio: number,
  config: BudgetConfig = DEFAULT_BUDGET,
): boolean {
  return usageRatio >= config.warningThreshold;
}

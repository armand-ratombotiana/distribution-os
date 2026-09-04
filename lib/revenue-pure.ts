/**
 * Pure revenue-model utilities.
 *
 * A `RevenueModel` captures a set of subscription plans, a starting cohort
 * of customers, and a churn rate. `calculateMRR` sums the per-plan
 * recurring revenue; `getChurnRate` derives the period churn rate from a
 * list of cohort snapshots; `projectRevenue` extrapolates MRR forward
 * `n` months applying expansion and churn.
 *
 * No I/O, no side effects, deterministic.
 */

export type PlanInterval = "monthly" | "annual";

export interface SubscriptionPlan {
  /** Stable plan identifier (e.g. "pro"). */
  id: string;
  /** Price per interval, in dollars. */
  price: number;
  /** Billing interval. */
  interval: PlanInterval;
  /** Number of customers currently on this plan. */
  customers: number;
}

export interface CohortSnapshot {
  /** Period index (0 = start). */
  periodIndex: number;
  /** Active customers at the start of the period. */
  activeCustomers: number;
  /** Customers who churned during this period. */
  churned: number;
}

export interface RevenueModel {
  /** Stable identifier. */
  id: string;
  /** Subscription plans in the model. */
  plans: SubscriptionPlan[];
  /** Monthly net expansion rate (e.g. 0.02 = +2% MRR per month). */
  expansionRate?: number;
  /** Monthly churn rate (e.g. 0.05 = -5% MRR per month). */
  churnRate?: number;
}

function safeNum(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

function annualToMonthly(price: number, interval: PlanInterval): number {
  if (interval === "annual") return price / 12;
  return price;
}

/**
 * Compute the monthly recurring revenue (MRR) for a revenue model by
 * summing `price × customers` across all monthly plans and
 * `(price / 12) × customers` across all annual plans. Returns `0` for
 * invalid input.
 */
export function calculateMRR(model: RevenueModel): number {
  if (!model || !Array.isArray(model.plans)) return 0;
  let mrr = 0;
  for (const plan of model.plans) {
    if (!plan) continue;
    const price = Math.max(0, safeNum(plan.price));
    const customers = Math.max(0, safeNum(plan.customers));
    mrr += annualToMonthly(price, plan.interval) * customers;
  }
  return mrr;
}

/**
 * Derive the average monthly churn rate from a list of cohort snapshots.
 * For each period (excluding the first), the period churn rate is
 * `churned / activeCustomers` (using the prior period's active count).
 * Returns the arithmetic mean across all periods with non-zero active
 * counts. Returns `0` when there are fewer than 2 snapshots or no
 * valid periods.
 */
export function getChurnRate(snapshots: CohortSnapshot[]): number {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return 0;
  const sorted = [...snapshots].sort((a, b) => safeNum(a.periodIndex) - safeNum(b.periodIndex));
  const rates: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevActive = safeNum(sorted[i - 1].activeCustomers);
    const churned = safeNum(sorted[i].churned);
    if (prevActive <= 0) continue;
    rates.push(Math.max(0, churned / prevActive));
  }
  if (rates.length === 0) return 0;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/**
 * Project MRR forward `months` months, applying the model's expansion and
 * churn rates each month. Returns an array of `{ month, mrr }` entries
 * where month 0 is the starting MRR (computed via `calculateMRR`). The
 * recurrence is:
 *
 *   mrr[t] = mrr[t-1] × (1 + expansionRate) × (1 - churnRate)
 *
 * Returns an empty array for invalid input or `months < 0`.
 */
export function projectRevenue(
  model: RevenueModel,
  months: number,
): Array<{ month: number; mrr: number }> {
  if (!model || !Number.isFinite(months) || months < 0) return [];
  const expansion = Math.max(-1, safeNum(model.expansionRate, 0));
  const churn = Math.max(0, Math.min(1, safeNum(model.churnRate, 0)));
  const factor = (1 + expansion) * (1 - churn);
  const out: Array<{ month: number; mrr: number }> = [];
  let mrr = calculateMRR(model);
  out.push({ month: 0, mrr });
  for (let m = 1; m <= Math.floor(months); m++) {
    mrr = mrr * factor;
    if (mrr < 0) mrr = 0;
    out.push({ month: m, mrr });
  }
  return out;
}

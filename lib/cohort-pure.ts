/**
 * Pure cohort-analysis utilities.
 *
 * A cohort is a set of users acquired in the same period (e.g. the same
 * calendar month). Each cohort tracks how many of those users were still
 * active `n` periods later, which lets us compute retention and churn curves.
 *
 * All inputs are plain numbers — no I/O, no side effects, deterministic.
 */

export interface CohortPeriodSize {
  /** Number of users still active at the start of period `n`. */
  periodIndex: number;
  /** Active users at that period. */
  activeUsers: number;
}

export interface Cohort {
  /** Stable cohort identifier (e.g. "2024-01"). */
  id: string;
  /** Initial size of the cohort at period 0. */
  initialSize: number;
  /** Active-user counts for periods 1..N. Index 0 is omitted (== initialSize). */
  retention: number[];
}

const EPSILON = 1e-9;

function safeNonNegative(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Return the size of a cohort: `initialSize` coerced to a non-negative
 * integer (fractional users are not meaningful).
 */
export function getCohortSize(cohort: Cohort): number {
  if (!cohort) return 0;
  return Math.floor(safeNonNegative(cohort.initialSize));
}

/**
 * Retention rate at period `periodIndex`:
 *   - period 0 → `1`
 *   - period n → `cohort.retention[n-1] / cohort.initialSize`
 *
 * Returns `0` when the cohort is empty, the period is out of range, or the
 * initial size is non-positive.
 */
export function calculateRetention(
  cohort: Cohort,
  periodIndex: number,
): number {
  if (!cohort) return 0;
  const initial = safeNonNegative(cohort.initialSize);
  if (initial <= 0) return 0;
  if (!Array.isArray(cohort.retention)) return 0;
  if (!Number.isFinite(periodIndex) || periodIndex < 0) return 0;
  const idx = Math.floor(periodIndex);
  if (idx === 0) return 1;
  if (idx - 1 >= cohort.retention.length) return 0;
  const active = safeNonNegative(cohort.retention[idx - 1]);
  if (active > initial) return 1; // never report > 100%
  return active / initial;
}

/**
 * Churn rate at period `periodIndex` is the complement of retention:
 *   `1 - calculateRetention(cohort, periodIndex)`.
 */
export function calculateChurn(
  cohort: Cohort,
  periodIndex: number,
): number {
  return 1 - calculateRetention(cohort, periodIndex);
}

/**
 * Build a full retention curve for every recorded period (0..retention.length).
 * Index 0 is always `1`; subsequent entries are the retention rates.
 */
export function calculateRetentionCurve(cohort: Cohort): number[] {
  if (!cohort) return [];
  const out: number[] = [];
  for (let i = 0; i <= (cohort.retention?.length ?? 0); i++) {
    out.push(calculateRetention(cohort, i));
  }
  return out;
}

/**
 * Average retention across all periods 1..N. Returns `0` when no retention
 * data is available.
 */
export function calculateAverageRetention(cohort: Cohort): number {
  if (!cohort || !Array.isArray(cohort.retention) || cohort.retention.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 1; i <= cohort.retention.length; i++) {
    sum += calculateRetention(cohort, i);
  }
  return sum / cohort.retention.length;
}

/**
 * Lifetime value proxy: `initialSize * averageRetention * revenuePerUser`.
 * Returns `0` for invalid inputs.
 */
export function calculateCohortLTV(
  cohort: Cohort,
  revenuePerUser: number,
): number {
  if (!cohort) return 0;
  const size = getCohortSize(cohort);
  const avg = calculateAverageRetention(cohort);
  const rpu = safeNonNegative(revenuePerUser);
  return size * avg * rpu;
}

export { EPSILON };

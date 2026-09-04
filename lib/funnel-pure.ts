/**
 * Pure funnel analysis utilities.
 *
 * A funnel is an ordered list of named stages; each stage has a count of
 * users who reached it. The conversion rate between stages, the drop-off
 * between stages, and the bottleneck (largest drop-off) stage are all
 * derivable from those counts alone, with no I/O.
 *
 * No side effects, deterministic.
 */

export interface FunnelStage {
  /** Stable identifier for the stage (e.g. "visit", "signup", "purchase"). */
  id: string;
  /** Human-readable label. Defaults to `id` when omitted. */
  label?: string;
  /** Number of users who reached this stage. */
  users: number;
}

export interface Funnel {
  /** Ordered list of stages, from top to bottom of the funnel. */
  stages: FunnelStage[];
}

export interface FunnelStageMetrics {
  stageId: string;
  /** Conversion rate from the previous stage to this one, in `[0, 1]`. */
  conversionRate: number;
  /** Drop-off ratio from the previous stage to this one, in `[0, 1]`. */
  dropoff: number;
  /** Users lost between the previous stage and this one. */
  usersLost: number;
  /** Users at this stage. */
  users: number;
}

const EPSILON = 1e-9;

function sanitizeUsers(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeFunnel(funnel: Funnel): FunnelStage[] {
  if (!funnel || !Array.isArray(funnel.stages)) return [];
  return funnel.stages.map((s) => ({
    id: String(s?.id ?? ""),
    label: s?.label,
    users: sanitizeUsers(s?.users),
  }));
}

/**
 * Conversion rate from one count to the next:
 *   `next / previous` when `previous > 0`, else `0`.
 *
 * Also exposed for ad-hoc use against raw counts.
 */
export function calculateConversionRate(
  previous: number,
  next: number,
): number {
  const p = sanitizeUsers(previous);
  const n = sanitizeUsers(next);
  if (p <= 0) return 0;
  return Math.min(1, n / p);
}

/**
 * Drop-off ratio between two stages: `1 - conversionRate(previous, next)`.
 * Always in `[0, 1]`.
 */
export function calculateDropoff(
  previous: number,
  next: number,
): number {
  return 1 - calculateConversionRate(previous, next);
}

/**
 * Per-stage metrics for the entire funnel. The first stage (index 0) has a
 * conversion rate of `1` and a drop-off of `0` because there is no previous
 * stage to compare against. An empty funnel yields an empty array.
 */
export function calculateStageMetrics(funnel: Funnel): FunnelStageMetrics[] {
  const stages = normalizeFunnel(funnel);
  if (stages.length === 0) return [];
  return stages.map((stage, i) => {
    if (i === 0) {
      return {
        stageId: stage.id,
        conversionRate: 1,
        dropoff: 0,
        usersLost: 0,
        users: stage.users,
      };
    }
    const prev = stages[i - 1].users;
    const conv = calculateConversionRate(prev, stage.users);
    return {
      stageId: stage.id,
      conversionRate: conv,
      dropoff: 1 - conv,
      usersLost: Math.max(0, prev - stage.users),
      users: stage.users,
    };
  });
}

/**
 * Overall funnel conversion rate: last stage / first stage. Returns `0` when
 * the funnel is empty or the first stage has no users.
 */
export function calculateOverallConversionRate(funnel: Funnel): number {
  const stages = normalizeFunnel(funnel);
  if (stages.length === 0) return 0;
  return calculateConversionRate(stages[0].users, stages[stages.length - 1].users);
}

export interface BottleneckResult {
  /** Stage where the largest drop-off occurred, or null for trivial funnels. */
  stageId: string | null;
  /** Drop-off ratio at the bottleneck stage, in `[0, 1]`. */
  dropoff: number;
  /** Users lost at the bottleneck stage. */
  usersLost: number;
}

/**
 * Find the stage with the largest drop-off. Returns `{ stageId: null }` when
 * the funnel has fewer than two stages. Ties resolve to the earliest stage.
 */
export function getBottleneckStage(funnel: Funnel): BottleneckResult {
  const metrics = calculateStageMetrics(funnel);
  if (metrics.length < 2) {
    return { stageId: null, dropoff: 0, usersLost: 0 };
  }
  let bestIdx = 1; // index 0 has dropoff 0 by definition
  for (let i = 2; i < metrics.length; i++) {
    if (metrics[i].dropoff > metrics[bestIdx].dropoff + EPSILON) {
      bestIdx = i;
    }
  }
  return {
    stageId: metrics[bestIdx].stageId,
    dropoff: metrics[bestIdx].dropoff,
    usersLost: metrics[bestIdx].usersLost,
  };
}

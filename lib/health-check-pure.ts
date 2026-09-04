/**
 * Pure health-check utilities.
 *
 * Computes uptime ratios, a 0-100 health score, and decides whether an
 * alert should fire. No I/O, no D1.
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  /** Latency in milliseconds. */
  latencyMs: number;
  /** Epoch ms when the check ran. */
  atMs: number;
}

export interface HealthMetrics {
  /** Fraction of checks that were healthy (0..1). */
  healthyRatio: number;
  /** Fraction of checks that were degraded (0..1). */
  degradedRatio: number;
  /** Average latency in ms. */
  avgLatencyMs: number;
  /** P95 latency in ms. */
  p95LatencyMs: number;
  /** Number of checks behind schedule. */
  staleChecks: number;
}

export interface HealthThresholds {
  /** Score below which we alert. */
  alertScore: number;
  /** Score at or above which the service is healthy. */
  healthyScore: number;
  /** Score below which the service is unhealthy. */
  unhealthyScore: number;
}

/**
 * Default thresholds: alert at 60, healthy at 80, unhealthy below 40.
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  alertScore: 60,
  healthyScore: 80,
  unhealthyScore: 40,
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Calculate the uptime ratio (fraction of checks that were healthy OR
 * degraded — i.e. not unhealthy) from a list of historical results.
 * Returns 1 for an empty input (no failures observed).
 */
export function calculateUptime(
  checks: ReadonlyArray<HealthCheckResult>,
): number {
  if (checks.length === 0) return 1;
  let up = 0;
  for (const c of checks) {
    if (c.status !== "unhealthy") up += 1;
  }
  return up / checks.length;
}

/**
 * Compute a 0-100 health score from health metrics. Weights:
 *   - 50% availability (healthy + degraded — i.e. "not unhealthy")
 *   - 20% healthy purity (fully healthy counts double)
 *   - 20% latency score (≤ 50 ms is full marks; degrades to 0 by 550 ms)
 *   - 10% freshness (no stale checks → full marks; each stale check −10%)
 */
export function getHealthScore(metrics: HealthMetrics): number {
  const healthy = clamp01(metrics.healthyRatio);
  const degraded = clamp01(metrics.degradedRatio);
  const availability = clamp01(healthy + degraded);
  const latencyScore =
    metrics.avgLatencyMs <= 0
      ? 1
      : clamp01(1 - (metrics.avgLatencyMs - 50) / 500);
  const freshness =
    metrics.staleChecks <= 0
      ? 1
      : clamp01(1 - metrics.staleChecks * 0.1);
  const score =
    50 * availability +
    20 * healthy +
    20 * latencyScore +
    10 * freshness;
  return Math.round(clamp01(score / 100) * 100);
}

/**
 * Map a numeric score to a {@link HealthStatus} using the given thresholds.
 */
export function scoreToStatus(
  score: number,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
): HealthStatus {
  if (score >= thresholds.healthyScore) return "healthy";
  if (score < thresholds.unhealthyScore) return "unhealthy";
  return "degraded";
}

/**
 * Decide whether an alert should fire. Alerts fire when:
 *   - status is unhealthy, OR
 *   - status is degraded AND the score is below the alert threshold.
 */
export function shouldAlert(
  status: HealthStatus,
  score: number,
  threshold: number,
): boolean {
  if (status === "unhealthy") return true;
  if (status === "degraded" && score < threshold) return true;
  return false;
}

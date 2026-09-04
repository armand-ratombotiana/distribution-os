/**
 * Pure metrics aggregator.
 *
 * Collects numeric samples (latency, count, byte size, etc.) and
 * computes aggregate statistics: count, sum, min, max, mean, median,
 * standard deviation, and arbitrary percentiles via nearest-rank
 * interpolation.
 *
 * All operations are pure functions of (samples, options). No I/O.
 */

export interface MetricAggregate {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  /** Population standard deviation (uses N, not N-1). */
  stdDev: number;
  /** Nearest-rank percentiles pre-computed at aggregate time. */
  percentiles: Record<number, number>;
}

export interface AggregateOptions {
  /** Percentiles (0–100) to pre-compute and embed in the result. */
  percentiles?: ReadonlyArray<number>;
}

/**
 * Compute aggregate statistics for a list of numeric samples.
 *
 *   - Empty sample list → all fields zero (count=0, sum=0, etc.).
 *   - Single sample → min=max=mean=median=sample, stdDev=0.
 *   - Percentiles use nearest-rank: ceil(p/100 * N) - 1 (clamped to [0, N-1]).
 */
export function aggregate(
  name: string,
  samples: ReadonlyArray<number>,
  options: AggregateOptions = {},
): MetricAggregate {
  const count = samples.length;
  if (count === 0) {
    return {
      name,
      count: 0,
      sum: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      percentiles: Object.fromEntries(
        (options.percentiles ?? []).map((p) => [p, 0]),
      ),
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const min = sorted[0]!;
  const max = sorted[count - 1]!;
  const mean = sum / count;
  const median = calculatePercentile(sorted, 50);
  const variance = sorted.reduce((acc, n) => acc + (n - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  const percentiles: Record<number, number> = {};
  for (const p of options.percentiles ?? []) {
    percentiles[p] = calculatePercentile(sorted, p);
  }

  return {
    name,
    count,
    sum,
    min,
    max,
    mean,
    median,
    stdDev,
    percentiles,
  };
}

/**
 * Calculate the nearest-rank percentile of a sample list.
 *
 *   - The list is assumed to already be sorted ascending. (Callers can
 *     pass unsorted data; this function re-sorts to be safe.)
 *   - p must be in [0, 100]. Out-of-range values are clamped.
 *   - rank = ceil(p / 100 * N), 1-indexed; index = rank - 1 (clamped to [0, N-1]).
 *   - Empty list returns 0.
 */
export function calculatePercentile(
  samples: ReadonlyArray<number>,
  p: number,
): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(100, p));
  // Nearest-rank: rank = ceil(p/100 * N), 1-indexed.
  const rank = Math.ceil((clamped / 100) * sorted.length);
  const idx = Math.max(0, Math.min(sorted.length - 1, rank - 1));
  return sorted[idx]!;
}

/**
 * Return a compact summary string for an aggregate (useful for log lines).
 *
 *   `name n=N min=M max=X mean=Avg p50=P50 p95=P95 p99=P99`
 */
export function getSummary(agg: MetricAggregate): string {
  const parts: string[] = [agg.name, `n=${agg.count}`];
  if (agg.count > 0) {
    parts.push(
      `min=${agg.min}`,
      `max=${agg.max}`,
      `mean=${round(agg.mean)}`,
      `median=${round(agg.median)}`,
      `stdDev=${round(agg.stdDev)}`,
    );
    const percentileKeys = Object.keys(agg.percentiles)
      .map((k) => Number(k))
      .sort((a, b) => a - b);
    for (const p of percentileKeys) {
      parts.push(`p${p}=${round(agg.percentiles[p]!)}`);
    }
  }
  return parts.join(" ");
}

/**
 * Merge two aggregates produced from samples of the same metric.
 *
 * Combines count, sum, min, max. Recomputes mean from total sum / total
 * count. Median, stdDev, and percentiles are NOT preserved (they would
 * require the original samples); they are set to 0 and the caller should
 * re-aggregate from raw samples if precise percentiles are needed.
 */
export function mergeAggregates(
  name: string,
  a: MetricAggregate,
  b: MetricAggregate,
): MetricAggregate {
  const count = a.count + b.count;
  const sum = a.sum + b.sum;
  const min = count === 0 ? 0 : count === a.count ? a.min : count === b.count ? b.min : Math.min(a.min, b.min);
  const max = count === 0 ? 0 : count === a.count ? a.max : count === b.count ? b.max : Math.max(a.max, b.max);
  const mean = count === 0 ? 0 : sum / count;
  return {
    name,
    count,
    sum,
    min,
    max,
    mean,
    median: 0,
    stdDev: 0,
    percentiles: {},
  };
}

function round(n: number, decimals: number = 4): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

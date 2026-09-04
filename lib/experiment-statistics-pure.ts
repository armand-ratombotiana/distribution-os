/**
 * Pure experiment-statistics utilities.
 *
 * Provides the math commonly needed for A/B and A/B/n experiments:
 *   - sample-size estimation for a two-proportion test
 *   - confidence intervals for proportions
 *   - a two-proportion z-test for significance
 *   - Cohen's h effect size for the difference of two proportions
 *
 * All functions are deterministic and side-effect free.
 */

export interface ProportionSample {
  /** Number of trials / impressions / users. */
  n: number;
  /** Number of successes / conversions / clicks. */
  successes: number;
}

export interface ConfidenceInterval {
  /** Lower bound, in `[0, 1]`. */
  lower: number;
  /** Upper bound, in `[0, 1]`. */
  upper: number;
  /** Point estimate used as the centre. */
  estimate: number;
  /** Confidence level in `[0, 1]` (e.g. 0.95). */
  level: number;
}

/** Two-tailed z critical values for common confidence levels. */
export const Z_TABLE: Record<string, number> = {
  "0.80": 1.2815515655446004,
  "0.90": 1.6448536269514722,
  "0.95": 1.959963984540054,
  "0.99": 2.5758293035489004,
};

/** Standard normal cumulative distribution function (Abramowitz & Stegun 26.2.17). */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Inverse normal CDF via the Beasley-Springer/Moro approximation. */
export function inverseNormalCdf(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  // Acklam's algorithm.
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/** Look up the two-tailed z critical value for a confidence `level` in `[0,1]`. */
export function zCritical(level: number): number {
  if (!Number.isFinite(level) || level <= 0 || level >= 1) {
    return Z_TABLE["0.95"];
  }
  const key = level.toFixed(2);
  if (Z_TABLE[key] !== undefined) return Z_TABLE[key];
  // Two-tailed: we want z such that P(|Z| <= z) = level, i.e. P(Z <= z) = (1+level)/2.
  return inverseNormalCdf((1 + level) / 2);
}

function proportion(sample: ProportionSample): number {
  if (!sample || sample.n <= 0) return 0;
  return Math.min(1, Math.max(0, sample.successes / sample.n));
}

function standardError(p: number, n: number): number {
  if (n <= 0) return 0;
  return Math.sqrt((p * (1 - p)) / n);
}

/**
 * Approximate sample size per arm for a two-proportion z-test using the
 * pooled formula:
 *
 *   n = (z_alpha/2 + z_beta)^2 * 2 * p*(1-p) / (delta^2)
 *
 * Where `p` is the baseline rate, `delta` is the minimum detectable effect,
 * and `power` defaults to 0.8 (z_beta ~= 0.84). Returns `Infinity` when
 * `delta` is non-positive and a safe lower bound of 30 otherwise.
 */
export function calculateSampleSize(params: {
  baselineRate: number;
  minimumDetectableEffect: number;
  confidenceLevel?: number;
  power?: number;
}): number {
  const baseline = Math.min(1, Math.max(0, params.baselineRate));
  const mde = params.minimumDetectableEffect;
  const level = params.confidenceLevel ?? 0.95;
  const power = params.power ?? 0.8;
  if (!Number.isFinite(mde) || mde <= 0) return Infinity;
  const zAlpha = zCritical(level);
  const zBeta = inverseNormalCdf(power);
  const numerator = Math.pow(zAlpha + zBeta, 2) * 2 * baseline * (1 - baseline);
  const n = numerator / (mde * mde);
  return Math.max(30, Math.ceil(n));
}

/**
 * Wald confidence interval for a single proportion. Returns `{ estimate,
 * lower, upper, level }` with both bounds clamped to `[0, 1]`. Returns an
 * interval equal to the estimate when `n` is non-positive.
 */
export function calculateConfidenceInterval(
  sample: ProportionSample,
  level = 0.95,
): ConfidenceInterval {
  const p = proportion(sample);
  const n = sample?.n ?? 0;
  if (n <= 0) {
    return { lower: 0, upper: 0, estimate: 0, level };
  }
  const z = zCritical(level);
  const se = standardError(p, n);
  const margin = z * se;
  return {
    estimate: p,
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin),
    level,
  };
}

export interface SignificanceResult {
  significant: boolean;
  /** |z| statistic. */
  z: number;
  /** Two-tailed p-value, in `[0, 1]`. */
  pValue: number;
  /** Required confidence level used for the test, in `[0, 1]`. */
  level: number;
}

/**
 * Two-proportion z-test for the difference `pA - pB`. Returns the |z|
 * statistic, the two-tailed p-value, and `significant` when `|z|` exceeds
 * the critical value for `level` (default 0.95 → 1.96).
 */
export function isSignificant(
  a: ProportionSample,
  b: ProportionSample,
  level = 0.95,
): SignificanceResult {
  const pA = proportion(a);
  const pB = proportion(b);
  const nA = a?.n ?? 0;
  const nB = b?.n ?? 0;
  if (nA <= 0 || nB <= 0) {
    return { significant: false, z: 0, pValue: 1, level };
  }
  const pooled = (a.successes + b.successes) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) {
    return { significant: false, z: 0, pValue: 1, level };
  }
  const z = (pA - pB) / se;
  const absZ = Math.abs(z);
  const pValue = 2 * (1 - normalCdf(absZ));
  return {
    significant: absZ > zCritical(level),
    z: absZ,
    pValue,
    level,
  };
}

/**
 * Cohen's h effect size for the difference of two proportions:
 *   h = 2 * asin(sqrt(pA)) - 2 * asin(sqrt(pB))
 *
 * Conventional interpretation: 0.2 small, 0.5 medium, 0.8 large.
 */
export function calculateEffectSize(a: ProportionSample, b: ProportionSample): number {
  const pA = proportion(a);
  const pB = proportion(b);
  return 2 * Math.asin(Math.sqrt(pA)) - 2 * Math.asin(Math.sqrt(pB));
}

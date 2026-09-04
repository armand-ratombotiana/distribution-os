/**
 * Pure statistics helpers for A/B content-variant experiments. All functions
 * are deterministic and side-effect free.
 */

export type VariantStats = {
  id: string;
  impressions: number;
  clicks: number;
  conversions: number;
};

/** Click-through rate = clicks / impressions. Returns 0 for no impressions. */
export function calculateCtr(impressions: number, clicks: number): number {
  if (!Number.isFinite(impressions) || impressions <= 0) return 0;
  if (!Number.isFinite(clicks) || clicks < 0) return 0;
  return Math.min(clicks, impressions) / impressions;
}

/** Conversion rate = conversions / clicks. Returns 0 for no clicks. */
export function calculateConversionRate(
  clicks: number,
  conversions: number,
): number {
  if (!Number.isFinite(clicks) || clicks <= 0) return 0;
  if (!Number.isFinite(conversions) || conversions < 0) return 0;
  return Math.min(conversions, clicks) / clicks;
}

/**
 * Computes a scalar score for a variant as CTR * conversion rate * 100.
 * Higher is better; combines reach and intent quality.
 */
export function calculateVariantScore(variant: VariantStats): number {
  const ctr = calculateCtr(variant.impressions, variant.clicks);
  const cvr = calculateConversionRate(variant.clicks, variant.conversions);
  return ctr * cvr * 100;
}

/**
 * Returns the variant with the highest score. Ties resolve to the
 * first-encountered variant. Returns null for an empty list.
 */
export function getBestVariant(
  variants: readonly VariantStats[],
): VariantStats | null {
  if (variants.length === 0) return null;
  let best = variants[0];
  let bestScore = calculateVariantScore(best);
  for (let i = 1; i < variants.length; i++) {
    const score = calculateVariantScore(variants[i]);
    if (score > bestScore) {
      best = variants[i];
      bestScore = score;
    }
  }
  return best;
}

/**
 * Approximate two-proportion z-test on click-through rates. Returns true
 * when the difference is significant at roughly the 95% confidence level
 * (|z| > 1.96) AND at least 100 total impressions have been collected.
 */
export function isStatisticallySignificant(
  variantA: VariantStats,
  variantB: VariantStats,
): boolean {
  const totalImpressions = variantA.impressions + variantB.impressions;
  if (totalImpressions < 100) return false;
  const totalClicks = variantA.clicks + variantB.clicks;
  if (totalClicks === 0) return false;
  const pPool = totalClicks / totalImpressions;
  const se = Math.sqrt(
    pPool *
      (1 - pPool) *
      (1 / Math.max(1, variantA.impressions) +
        1 / Math.max(1, variantB.impressions)),
  );
  if (se === 0) return false;
  const pA = calculateCtr(variantA.impressions, variantA.clicks);
  const pB = calculateCtr(variantB.impressions, variantB.clicks);
  const z = Math.abs(pA - pB) / se;
  return z > 1.96;
}

/**
 * Returns the winning variant when it is statistically significant against
 * every other variant. Returns null otherwise (including < 2 variants).
 */
export function shouldDeclareWinner(
  variants: readonly VariantStats[],
): VariantStats | null {
  if (variants.length < 2) return null;
  const best = getBestVariant(variants);
  if (!best) return null;
  const others = variants.filter((v) => v.id !== best.id);
  if (others.length === 0) return null;
  return others.every((other) => isStatisticallySignificant(best, other))
    ? best
    : null;
}

export type VariantDisplay = {
  id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: string;
  cvr: string;
  score: string;
};

/** Formats a variant as a display-friendly summary with percentages. */
export function summarizeVariantForDisplay(
  variant: VariantStats,
): VariantDisplay {
  const ctr = calculateCtr(variant.impressions, variant.clicks);
  const cvr = calculateConversionRate(variant.clicks, variant.conversions);
  const score = calculateVariantScore(variant);
  return {
    id: variant.id,
    impressions: variant.impressions,
    clicks: variant.clicks,
    conversions: variant.conversions,
    ctr: `${(ctr * 100).toFixed(2)}%`,
    cvr: `${(cvr * 100).toFixed(2)}%`,
    score: score.toFixed(4),
  };
}

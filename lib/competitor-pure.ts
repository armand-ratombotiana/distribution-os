/**
 * Pure competitor-analysis utilities.
 *
 * A `Competitor` is described by its market-share %, growth rate, product
 * feature set, pricing tier, and a threat-weight. This module computes the
 * capability gap between us and a competitor (`analyzeGap`), an overall
 * threat score (`calculateThreat`), and a list of differentiation
 * messages — features we have that they don't, or where we have a
 * pricing/feature advantage (`getDifferentiation`).
 *
 * No I/O, no side effects, deterministic.
 */

export type PricingTier = "free" | "low" | "mid" | "high" | "enterprise";

export interface Competitor {
  /** Stable identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Market share as a percentage, in `[0, 100]`. */
  marketShare: number;
  /** YoY growth rate as a percentage (can be negative). */
  growthRate: number;
  /** Set of feature names the competitor offers. */
  features: string[];
  /** Pricing tier. */
  pricing: PricingTier;
  /** Brand-recognition weight in `[0, 1]`. */
  brandStrength?: number;
}

export interface OurFirm {
  id: string;
  name: string;
  features: string[];
  pricing: PricingTier;
}

export interface CapabilityGap {
  /** Features the competitor has that we don't. */
  competitorOnly: string[];
  /** Features we have that the competitor doesn't. */
  ourOnly: string[];
  /** Features both offer. */
  shared: string[];
}

export interface Differentiation {
  /** One-line message we can use in positioning. */
  message: string;
  /** Type of advantage. */
  kind: "feature" | "price";
}

const TIER_RANK: Record<PricingTier, number> = {
  free: 0,
  low: 1,
  mid: 2,
  high: 3,
  enterprise: 4,
};

function safeNum(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

function safeFeatures(f: unknown): string[] {
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Compute the capability gap between `us` and `competitor` based on their
 * feature sets. Returns three lists: features only they have, features
 * only we have, and features both offer.
 */
export function analyzeGap(us: OurFirm, competitor: Competitor): CapabilityGap {
  const empty: CapabilityGap = { competitorOnly: [], ourOnly: [], shared: [] };
  if (!us || !competitor) return empty;
  const ours = new Set(safeFeatures(us.features));
  const theirs = new Set(safeFeatures(competitor.features));
  const competitorOnly: string[] = [];
  const ourOnly: string[] = [];
  const shared: string[] = [];
  for (const f of theirs) {
    if (ours.has(f)) shared.push(f);
    else competitorOnly.push(f);
  }
  for (const f of ours) {
    if (!theirs.has(f)) ourOnly.push(f);
  }
  return { competitorOnly, ourOnly, shared };
}

/**
 * Compute an overall threat score in `[0, 100]` from a competitor's
 * market share, growth rate, brand strength, and feature overlap with us.
 *
 *   threat = 0.4 × share + 0.3 × clamp(growth, 0, 50)
 *          + 0.2 × (brand × 100) + 0.1 × (overlap × 100)
 *
 * where `overlap` is the fraction of our features the competitor also has.
 * Returns `0` for invalid inputs.
 */
export function calculateThreat(competitor: Competitor, us?: OurFirm): number {
  if (!competitor) return 0;
  const share = Math.max(0, Math.min(100, safeNum(competitor.marketShare)));
  const growth = Math.max(0, Math.min(50, safeNum(competitor.growthRate)));
  const brand = Math.max(0, Math.min(1, safeNum(competitor.brandStrength, 0.5)));
  let overlap = 1;
  if (us) {
    const ours = safeFeatures(us.features);
    const theirs = new Set(safeFeatures(competitor.features));
    if (ours.length > 0) {
      overlap = ours.filter((f) => theirs.has(f)).length / ours.length;
    }
  }
  const score = 0.4 * share + 0.3 * growth + 0.2 * (brand * 100) + 0.1 * (overlap * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * Return a list of differentiation messages for use in positioning. Each
 * feature we have that the competitor lacks produces a `feature`
 * differentiation; if our pricing tier is strictly lower than theirs, an
 * additional `price` differentiation is prepended.
 *
 * Returns an empty array when there is no advantage.
 */
export function getDifferentiation(us: OurFirm, competitor: Competitor): Differentiation[] {
  if (!us || !competitor) return [];
  const out: Differentiation[] = [];
  const gap = analyzeGap(us, competitor);
  if (TIER_RANK[us.pricing] < TIER_RANK[competitor.pricing]) {
    out.push({
      kind: "price",
      message: `More affordable than ${competitor.name} (${us.pricing} vs ${competitor.pricing})`,
    });
  }
  for (const feature of gap.ourOnly) {
    out.push({
      kind: "feature",
      message: `We offer "${feature}"; ${competitor.name} does not`,
    });
  }
  return out;
}

/**
 * Pure budget-allocation utilities.
 *
 * Distributes a total budget across channels using either:
 *   - "proportional" — each channel's share = its weight / sum(weights)
 *   - "equal"        — every channel receives 1/N of the budget
 *   - "roi_weighted" — weight × clamped ROI, then normalised
 *
 * All monetary amounts are integer cents to avoid floating-point rounding.
 * ROI is the ratio returned per cent spent (e.g. 1.5 means $0.015 per cent,
 * i.e. +50%). ROI as a percentage is multiplied by 100 in the helpers.
 *
 * No I/O, no side effects, deterministic.
 */

export type AllocationStrategy = "proportional" | "equal" | "roi_weighted";

export interface AllocationChannelInput {
  /** Stable channel identifier. */
  id: string;
  /** Relative weight for proportional / roi_weighted strategies. */
  weight?: number;
  /** ROI ratio (1.0 == break-even). Required for roi_weighted. */
  roi?: number;
}

export interface AllocationResult {
  /** Channel id. */
  id: string;
  /** Allocated budget in integer cents. */
  allocatedCents: number;
  /** Share of total budget, in `[0, 1]`. */
  share: number;
  /** ROI ratio used for the allocation. */
  roi: number;
}

export interface AllocationSummary {
  /** Total budget that was allocated (== input total). */
  totalCents: number;
  /** Number of channels that received a non-zero allocation. */
  channelCount: number;
  /** Per-channel allocations, in the same order as the input channels. */
  allocations: AllocationResult[];
  /** Strategy used. */
  strategy: AllocationStrategy;
}

function safeNonNegative(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

function clampRoi(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return 0;
  return Math.min(1, n); // cap ROI ratio at 1 for weight purposes
}

/**
 * Distribute `totalCents` across `channels` using the requested strategy.
 * Remainder cents (from rounding) are distributed one cent at a time to the
 * channels with the largest fractional remainders, so the sum of
 * `allocatedCents` always equals `totalCents`.
 *
 * Returns an empty allocations array when `totalCents <= 0` or no channels
 * are provided.
 */
export function allocateBudget(
  totalCents: number,
  channels: AllocationChannelInput[],
  strategy: AllocationStrategy = "proportional",
): AllocationSummary {
  const total = Math.max(0, Math.floor(safeNonNegative(totalCents)));
  const safeChannels = Array.isArray(channels)
    ? channels.filter((c) => c && typeof c.id === "string")
    : [];
  if (total <= 0 || safeChannels.length === 0) {
    return { totalCents: total, channelCount: 0, allocations: [], strategy };
  }

  // Compute raw weights per channel.
  const weights = safeChannels.map((c) => {
    if (strategy === "equal") return 1;
    if (strategy === "roi_weighted") {
      return safeNonNegative(c.weight) * clampRoi(c.roi) || 0;
    }
    // proportional (default)
    return safeNonNegative(c.weight) || 0;
  });

  const totalWeight = weights.reduce((s, w) => s + w, 0);

  // Equal-share fallback when weights sum to zero.
  const useEqual = totalWeight <= 0;
  const effectiveWeights = useEqual
    ? weights.map(() => 1)
    : weights;

  const effectiveTotal = useEqual
    ? safeChannels.length
    : totalWeight;

  const raw = effectiveWeights.map((w) => (w / effectiveTotal) * total);
  const floored = raw.map((v) => Math.floor(v));
  const allocated = floored.reduce((s, v) => s + v, 0);
  const remainder = total - allocated;

  // Distribute remainder cents to the channels with the largest fractional part.
  const fractional = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const finalCents = [...floored];
  for (let k = 0; k < remainder; k++) {
    finalCents[fractional[k % fractional.length].i] += 1;
  }

  const allocations: AllocationResult[] = safeChannels.map((c, i) => ({
    id: c.id,
    allocatedCents: finalCents[i],
    share: total > 0 ? finalCents[i] / total : 0,
    roi: typeof c.roi === "number" && Number.isFinite(c.roi) ? c.roi : 0,
  }));

  return {
    totalCents: total,
    channelCount: allocations.filter((a) => a.allocatedCents > 0).length,
    allocations,
    strategy,
  };
}

/**
 * Return on investment as a percentage:
 *   ROI % = (revenue - cost) / cost * 100
 *
 * Returns `0` when cost is non-positive.
 */
export function calculateROI(revenueCents: number, costCents: number): number {
  const revenue = safeNonNegative(revenueCents);
  const cost = safeNonNegative(costCents);
  if (cost <= 0) return 0;
  return ((revenue - cost) / cost) * 100;
}

/**
 * Pick the allocation that maximises total revenue given each channel's ROI
 * ratio. Tries every supported strategy and returns the one whose expected
 * revenue is highest.
 *
 * Expected revenue per channel = allocatedCents × roi.
 */
export function getOptimalAllocation(
  totalCents: number,
  channels: AllocationChannelInput[],
): AllocationSummary {
  const strategies: AllocationStrategy[] = ["proportional", "equal", "roi_weighted"];
  let best: AllocationSummary | null = null;
  let bestRevenue = -1;
  for (const strategy of strategies) {
    const summary = allocateBudget(totalCents, channels, strategy);
    const revenue = summary.allocations.reduce(
      (s, a) => s + a.allocatedCents * a.roi,
      0,
    );
    if (revenue > bestRevenue) {
      bestRevenue = revenue;
      best = summary;
    }
  }
  return best ?? allocateBudget(totalCents, channels, "proportional");
}

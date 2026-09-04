/**
 * Pure channel-priority utilities.
 *
 * Given a list of marketing channels and their performance metrics, computes
 * a priority score per channel and returns them ranked from highest to
 * lowest. The score is a weighted combination of CTR, CVR, ROI, and reach —
 * channels with higher scores should be prioritised for spend and content.
 *
 * No I/O, no side effects, deterministic.
 */

export interface ChannelPriority {
  /** Stable channel identifier (e.g. "email", "paid_search"). */
  id: string;
  /** Click-through rate, in `[0, 1]`. */
  ctr: number;
  /** Conversion rate, in `[0, 1]`. */
  cvr: number;
  /** Return on investment as a ratio (1.5 == +50%). */
  roi: number;
  /** Reach share, in `[0, 1]`. */
  reach: number;
}

export interface ChannelRanking {
  channel: ChannelPriority;
  /** Composite priority score in `[0, 1]`. */
  score: number;
  /** 1-based rank in the sorted list. */
  rank: number;
}

export interface ChannelPriorityWeights {
  /** Weight for CTR. Defaults to 0.2. */
  ctr?: number;
  /** Weight for CVR. Defaults to 0.3. */
  cvr?: number;
  /** Weight for ROI (clamped to `[0,1]` before weighting). Defaults to 0.3. */
  roi?: number;
  /** Weight for reach. Defaults to 0.2. */
  reach?: number;
}

const DEFAULT_WEIGHTS: Required<ChannelPriorityWeights> = {
  ctr: 0.2,
  cvr: 0.3,
  roi: 0.3,
  reach: 0.2,
};

function clamp01(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeWeights(
  weights: ChannelPriorityWeights,
): Required<ChannelPriorityWeights> {
  const merged: Required<ChannelPriorityWeights> = {
    ctr: weights.ctr ?? DEFAULT_WEIGHTS.ctr,
    cvr: weights.cvr ?? DEFAULT_WEIGHTS.cvr,
    roi: weights.roi ?? DEFAULT_WEIGHTS.roi,
    reach: weights.reach ?? DEFAULT_WEIGHTS.reach,
  };
  const total = merged.ctr + merged.cvr + merged.roi + merged.reach;
  if (!Number.isFinite(total) || total <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }
  return {
    ctr: merged.ctr / total,
    cvr: merged.cvr / total,
    roi: merged.roi / total,
    reach: merged.reach / total,
  };
}

/**
 * Compute the composite priority score for a channel as a weighted average
 * of its CTR, CVR, ROI (clamped to `[0,1]`), and reach. The result is
 * always in `[0, 1]`. Weights are auto-normalised to sum to 1.
 */
export function calculateChannelScore(
  channel: ChannelPriority,
  weights: ChannelPriorityWeights = {},
): number {
  const w = normalizeWeights(weights);
  const ctr = clamp01(channel?.ctr);
  const cvr = clamp01(channel?.cvr);
  const roi = clamp01(channel?.roi);
  const reach = clamp01(channel?.reach);
  return ctr * w.ctr + cvr * w.cvr + roi * w.roi + reach * w.reach;
}

/**
 * Rank channels by composite score, descending. Ties are broken by channel
 * id (ascending) for stable ordering. Returns an array of `{ channel,
 * score, rank }` where `rank` starts at 1.
 */
export function rankChannels(
  channels: ChannelPriority[],
  weights: ChannelPriorityWeights = {},
): ChannelRanking[] {
  const safe = Array.isArray(channels) ? channels : [];
  const scored = safe.map((channel) => ({
    channel,
    score: calculateChannelScore(channel, weights),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.channel?.id ?? "").localeCompare(String(b.channel?.id ?? ""));
  });
  return scored.map((entry, i) => ({
    channel: entry.channel,
    score: entry.score,
    rank: i + 1,
  }));
}

/**
 * Return the top-ranked channel, or `null` when the list is empty.
 */
export function getTopChannel(
  channels: ChannelPriority[],
  weights: ChannelPriorityWeights = {},
): ChannelPriority | null {
  const ranked = rankChannels(channels, weights);
  return ranked.length === 0 ? null : ranked[0].channel;
}

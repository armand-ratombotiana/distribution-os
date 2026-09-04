/**
 * Pure go-to-market (GTM) strategy utilities.
 *
 * A `GTMStrategy` describes the channels, budget, and sequencing of a
 * product launch. `evaluateChannel` scores a channel against the strategy's
 * target metrics; `calculateBudget` distributes a total budget across
 * channels proportional to their score; `getSequence` returns the
 * ordered list of phase steps to execute.
 *
 * No I/O, no side effects, deterministic.
 */

export type GTMPhase = "research" | "positioning" | "launch" | "scale" | "retain";

export interface GTMChannel {
  /** Stable channel identifier (e.g. "paid_search"). */
  id: string;
  /** Channel phase alignment. */
  phase: GTMPhase;
  /** Estimated customer-acquisition cost (lower is better). */
  cac: number;
  /** Estimated lifetime value (higher is better). */
  ltv: number;
  /** Reach in `[0, 1]`. */
  reach: number;
  /** Fit score in `[0, 1]` against the ICP. */
  icpFit: number;
}

export interface GTMStrategy {
  /** Stable identifier. */
  id: string;
  /** Total budget to allocate, in dollars. */
  totalBudget: number;
  /** Target customer-acquisition cost ceiling. */
  targetCac: number;
  /** Target LTV:CAC ratio (e.g. 3 means LTV ≥ 3× CAC). */
  targetRatio: number;
  /** Channels under consideration. */
  channels: GTMChannel[];
  /** Phases the strategy will execute, in order. */
  phases: GTMPhase[];
}

export interface ChannelEvaluation {
  channelId: string;
  /** Composite score in `[0, 100]`. */
  score: number;
  /** LTV:CAC ratio (Infinity when CAC ≤ 0). */
  ratio: number;
  /** Whether the channel clears the strategy's targetCac and targetRatio. */
  viable: boolean;
}

export interface BudgetAllocation {
  channelId: string;
  /** Dollar amount allocated. */
  amount: number;
  /** Share of the total budget, in `[0, 1]`. */
  share: number;
}

export interface SequenceStep {
  /** 1-based step number. */
  step: number;
  phase: GTMPhase;
  /** Channels active in this phase, by id. */
  channelIds: string[];
}

function safeNum(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Evaluate a single channel against the strategy. The composite score is:
 *
 *   ratioScore = clamp(ltv / cac / targetRatio, 0, 1)        (weight 0.4)
 *   cacScore   = clamp(targetCac / cac, 0, 1)                 (weight 0.3)
 *   reachScore = clamp(reach, 0, 1)                           (weight 0.15)
 *   icpScore   = clamp(icpFit, 0, 1)                          (weight 0.15)
 *
 * A channel is `viable` when `cac ≤ targetCac` and `ltv / cac ≥ targetRatio`.
 */
export function evaluateChannel(
  channel: GTMChannel,
  strategy: GTMStrategy,
): ChannelEvaluation {
  const empty: ChannelEvaluation = { channelId: "", score: 0, ratio: 0, viable: false };
  if (!channel || !strategy) return empty;
  const cac = safeNum(channel.cac);
  const ltv = safeNum(channel.ltv);
  const ratio = cac > 0 ? ltv / cac : Infinity;
  const targetRatio = safeNum(strategy.targetRatio, 3);
  const targetCac = safeNum(strategy.targetCac, 0);
  const ratioScore = clamp01(ratio === Infinity ? 1 : ratio / targetRatio);
  const cacScore = cac > 0 ? clamp01(targetCac / cac) : 0;
  const reachScore = clamp01(safeNum(channel.reach, 0));
  const icpScore = clamp01(safeNum(channel.icpFit, 0));
  const score = Math.max(
    0,
    Math.min(
      100,
      0.4 * (ratioScore * 100) + 0.3 * (cacScore * 100) +
        0.15 * (reachScore * 100) + 0.15 * (icpScore * 100),
    ),
  );
  const viable = cac > 0 && cac <= targetCac && ratio >= targetRatio;
  return { channelId: channel.id, score, ratio, viable };
}

/**
 * Allocate the strategy's `totalBudget` across channels proportional to
 * their composite score (only viable channels receive budget). Channels
 * with score ≤ 0 or non-viable status receive `0`. Returns one
 * `BudgetAllocation` per channel, in input order.
 */
export function calculateBudget(strategy: GTMStrategy): BudgetAllocation[] {
  if (!strategy || !Array.isArray(strategy.channels) || strategy.channels.length === 0) {
    return [];
  }
  const total = Math.max(0, safeNum(strategy.totalBudget));
  const evaluations = strategy.channels.map((c) => evaluateChannel(c, strategy));
  const viableScores = evaluations
    .map((e) => (e.viable ? Math.max(0, e.score) : 0))
    .map((s) => (s > 0 ? s : 0));
  const sum = viableScores.reduce((a, b) => a + b, 0);
  return evaluations.map((e, i) => {
    const share = sum > 0 ? viableScores[i] / sum : 0;
    return {
      channelId: e.channelId,
      amount: total * share,
      share,
    };
  });
}

/**
 * Build the ordered list of execution steps from the strategy's phases.
 * Each step groups the channels active in that phase. Returns one
 * `SequenceStep` per phase, with `step` starting at 1.
 */
export function getSequence(strategy: GTMStrategy): SequenceStep[] {
  if (!strategy || !Array.isArray(strategy.phases) || strategy.phases.length === 0) {
    return [];
  }
  const channels = Array.isArray(strategy.channels) ? strategy.channels : [];
  return strategy.phases.map((phase, i) => ({
    step: i + 1,
    phase,
    channelIds: channels.filter((c) => c?.phase === phase).map((c) => c.id),
  }));
}

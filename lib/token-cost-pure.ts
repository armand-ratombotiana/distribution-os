/**
 * Pure token-cost estimation utilities. No I/O, no side effects, no globals
 * beyond the read-only pricing table. Safe to import from any runtime
 * (browser, worker, server, tests).
 */

export type ModelPricing = {
  /** Cost in cents per 1 million input tokens. */
  readonly inputCostPerMillion: number;
  /** Cost in cents per 1 million output tokens. */
  readonly outputCostPerMillion: number;
  /** Maximum context window in tokens. */
  readonly contextWindow: number;
  /** Flag for low-cost / efficient models. */
  readonly cheap?: boolean;
};

/**
 * Pricing table for supported models. All costs are expressed in cents
 * (1 USD = 100 cents) per 1 million tokens.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": {
    inputCostPerMillion: 250,
    outputCostPerMillion: 1000,
    contextWindow: 128_000,
  },
  "gpt-4o-mini": {
    inputCostPerMillion: 15,
    outputCostPerMillion: 60,
    contextWindow: 128_000,
    cheap: true,
  },
  "gpt-3.5-turbo": {
    inputCostPerMillion: 50,
    outputCostPerMillion: 150,
    contextWindow: 16_385,
    cheap: true,
  },
  "claude-3-opus": {
    inputCostPerMillion: 1500,
    outputCostPerMillion: 7500,
    contextWindow: 200_000,
  },
  "claude-3-sonnet": {
    inputCostPerMillion: 300,
    outputCostPerMillion: 1500,
    contextWindow: 200_000,
  },
  "claude-3-haiku": {
    inputCostPerMillion: 25,
    outputCostPerMillion: 125,
    contextWindow: 200_000,
    cheap: true,
  },
};

/** Fallback pricing used when a model is unknown. Conservative defaults. */
export const UNKNOWN_MODEL_PRICING: ModelPricing = {
  inputCostPerMillion: 100,
  outputCostPerMillion: 300,
  contextWindow: 8_192,
};

/** Returns pricing for a model, falling back to a conservative default. */
export function getPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? UNKNOWN_MODEL_PRICING;
}

/**
 * Calculates the cost in cents for a request to a model.
 * Returns 0 for any non-positive token counts.
 */
export function calculateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getPricing(model);
  const input = Math.max(0, inputTokens);
  const output = Math.max(0, outputTokens);
  const inputCost = (input / 1_000_000) * pricing.inputCostPerMillion;
  const outputCost = (output / 1_000_000) * pricing.outputCostPerMillion;
  return inputCost + outputCost;
}

/**
 * Estimates the number of tokens in a text. Uses a simple heuristic of
 * roughly 4 characters per token, rounded up. Returns 0 for empty input.
 */
export function estimateTokens(text: string): number {
  if (typeof text !== "string" || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/** Returns true if `tokens` fits within the model's context window. */
export function isWithinContextWindow(model: string, tokens: number): boolean {
  if (!Number.isFinite(tokens) || tokens < 0) return false;
  return tokens <= getPricing(model).contextWindow;
}

/** Returns the number of tokens remaining in a model's context window. */
export function getRemainingTokens(model: string, usedTokens: number): number {
  const used = Math.max(0, usedTokens);
  return Math.max(0, getPricing(model).contextWindow - used);
}

/**
 * Returns true when the current model is expensive and the input is small
 * enough (below `threshold` of the context window) that a cheaper model
 * would handle it. Returns false if the model is already cheap.
 */
export function shouldUseCheaperModel(
  model: string,
  inputTokens: number,
  threshold = 0.5,
): boolean {
  const pricing = getPricing(model);
  if (pricing.cheap) return false;
  if (pricing.contextWindow <= 0) return false;
  const ratio = inputTokens / pricing.contextWindow;
  return ratio <= threshold;
}

/**
 * Selects the cheapest model whose context window can fit `inputTokens`
 * and whose estimated input cost does not exceed `budgetCents` (if provided).
 * Returns null when no model satisfies the constraints.
 */
export function selectOptimalModel(
  inputTokens: number,
  budgetCents?: number,
): string | null {
  const safeTokens = Math.max(0, inputTokens);
  let candidates = Object.entries(MODEL_PRICING).filter(
    ([, pricing]) => pricing.contextWindow >= safeTokens,
  );
  if (budgetCents !== undefined) {
    candidates = candidates.filter(([, pricing]) => {
      const cost = (safeTokens / 1_000_000) * pricing.inputCostPerMillion;
      return cost <= budgetCents;
    });
  }
  candidates.sort(
    (a, b) => a[1].inputCostPerMillion - b[1].inputCostPerMillion,
  );
  return candidates[0]?.[0] ?? null;
}

/** Formats a cost given in cents as a USD dollar string with 4 decimals. */
export function formatCost(cents: number): string {
  if (!Number.isFinite(cents)) return "$0.0000";
  const dollars = Math.max(0, cents) / 100;
  return `$${dollars.toFixed(4)}`;
}

export type BudgetStatus = {
  spentCents: number;
  budgetCents: number;
  remainingCents: number;
  percentUsed: number;
  exceeded: boolean;
};

/** Computes a status object summarizing budget consumption. */
export function getBudgetStatus(
  spentCents: number,
  budgetCents: number,
): BudgetStatus {
  const spent = Math.max(0, spentCents);
  const budget = Math.max(0, budgetCents);
  const remaining = budget - spent;
  const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
  return {
    spentCents: spent,
    budgetCents: budget,
    remainingCents: remaining,
    percentUsed,
    exceeded: spent > budget,
  };
}

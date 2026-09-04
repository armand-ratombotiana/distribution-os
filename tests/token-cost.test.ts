import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_PRICING,
  UNKNOWN_MODEL_PRICING,
  getPricing,
  calculateCostCents,
  estimateTokens,
  isWithinContextWindow,
  getRemainingTokens,
  shouldUseCheaperModel,
  selectOptimalModel,
  formatCost,
  getBudgetStatus,
} from "../lib/token-cost-pure.js";

test("MODEL_PRICING exposes pricing entries for known models", () => {
  assert.ok(typeof MODEL_PRICING === "object" && MODEL_PRICING !== null);
  assert.ok(MODEL_PRICING["gpt-4o"]);
  assert.ok(MODEL_PRICING["gpt-4o-mini"].cheap === true);
  assert.ok(MODEL_PRICING["claude-3-opus"].contextWindow >= 100_000);
});

test("getPricing returns the stored entry for a known model", () => {
  const pricing = getPricing("gpt-4o-mini");
  assert.equal(pricing.inputCostPerMillion, 15);
  assert.equal(pricing.outputCostPerMillion, 60);
  assert.equal(pricing.contextWindow, 128_000);
});

test("getPricing falls back to a conservative default for unknown models", () => {
  const pricing = getPricing("does-not-exist");
  assert.equal(pricing.inputCostPerMillion, UNKNOWN_MODEL_PRICING.inputCostPerMillion);
  assert.equal(pricing.contextWindow, UNKNOWN_MODEL_PRICING.contextWindow);
});

test("calculateCostCents returns 0 for zero token usage", () => {
  assert.equal(calculateCostCents("gpt-4o", 0, 0), 0);
});

test("calculateCostCents sums input and output costs proportionally", () => {
  // gpt-4o-mini: 15 cents/1M input, 60 cents/1M output
  // 1_000_000 input + 500_000 output = 15 + 30 = 45 cents
  const cost = calculateCostCents("gpt-4o-mini", 1_000_000, 500_000);
  assert.equal(cost, 45);
});

test("estimateTokens returns 0 for empty or non-string input", () => {
  assert.equal(estimateTokens(""), 0);
});

test("estimateTokens approximates 4 characters per token, rounded up", () => {
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(estimateTokens("abcdefgh"), 2);
});

test("isWithinContextWindow returns true when tokens fit and false otherwise", () => {
  assert.equal(isWithinContextWindow("gpt-4o", 1000), true);
  assert.equal(isWithinContextWindow("gpt-4o", 1_000_000), false);
  assert.equal(isWithinContextWindow("gpt-4o", -1), false);
});

test("getRemainingTokens returns the unused capacity", () => {
  assert.equal(getRemainingTokens("gpt-4o", 28_000), 100_000);
});

test("shouldUseCheaperModel recommends a cheaper model for small inputs on expensive models", () => {
  // gpt-4o has 128k context, 1000 tokens is well below 50% threshold
  assert.equal(shouldUseCheaperModel("gpt-4o", 1000), true);
});

test("shouldUseCheaperModel returns false when the model is already cheap", () => {
  assert.equal(shouldUseCheaperModel("gpt-4o-mini", 1000), false);
});

test("selectOptimalModel picks the cheapest model that fits the context window", () => {
  // With 1000 tokens, all models fit; cheapest by input cost is gpt-4o-mini (15)
  assert.equal(selectOptimalModel(1000), "gpt-4o-mini");
});

test("selectOptimalModel returns null when no model fits the input size", () => {
  assert.equal(selectOptimalModel(1_000_000_000), null);
});

test("formatCost formats a value in cents as a USD string with 4 decimals", () => {
  assert.equal(formatCost(0), "$0.0000");
  assert.equal(formatCost(12), "$0.1200");
  assert.equal(formatCost(0.5), "$0.0050");
});

test("getBudgetStatus reports exceeded=true when spend surpasses the budget", () => {
  const status = getBudgetStatus(120, 100);
  assert.equal(status.exceeded, true);
  assert.equal(status.remainingCents, -20);
  assert.equal(status.percentUsed, 120);
});

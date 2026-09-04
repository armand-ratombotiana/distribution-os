import assert from "node:assert/strict";
import test from "node:test";

import {
  STEP_STATUSES,
  buildRunId,
  calculateCost,
  calculateLatencyMs,
  canTransitionRun,
  canTransitionStep,
  isTerminalRun,
  summarizeRunForDisplay,
  summarizeStepForDisplay,
  type AgentRunRow,
  type AgentStepRow,
} from "../db/agent-runs-pure.ts";

const baseRun: AgentRunRow = {
  id: "run_1",
  workspace_id: "ws_1",
  mission_id: "msn_1",
  agent_name: "ai-cmo",
  prompt_version: "1.0",
  model: "gpt-4",
  status: "running",
  input_refs_json: "[]",
  output_refs_json: "[]",
  tokens_input: 0,
  tokens_output: 0,
  cost_cents: 0,
  latency_ms: 0,
  error: null,
  started_at: 1_000,
  completed_at: null,
  created_at: 1_000,
};

const baseStep: AgentStepRow = {
  id: "step_1",
  run_id: "run_1",
  step_index: 0,
  tool_name: "search",
  tool_input_json: '{"q":"shoes"}',
  tool_output_json: '{"hits":3}',
  status: "running",
  started_at: 1_000,
  completed_at: null,
  created_at: 1_000,
};

test("STEP_STATUSES exposes the running + terminal lifecycle", () => {
  assert.deepEqual([...STEP_STATUSES], ["running", "completed", "failed", "cancelled"]);
});

test("canTransitionRun allows running to move to any terminal state", () => {
  for (const to of ["completed", "failed", "cancelled"] as const) {
    assert.equal(canTransitionRun("running", to), true);
  }
});

test("canTransitionRun forbids running from transitioning back to running", () => {
  assert.equal(canTransitionRun("running", "running"), false);
});

test("canTransitionRun forbids transitions out of terminal states", () => {
  for (const terminal of ["completed", "failed", "cancelled"] as const) {
    assert.equal(canTransitionRun(terminal, "running"), false);
    assert.equal(canTransitionRun(terminal, "completed"), false);
    assert.equal(canTransitionRun(terminal, "failed"), false);
    assert.equal(canTransitionRun(terminal, "cancelled"), false);
  }
});

test("isTerminalRun identifies terminal run states", () => {
  assert.equal(isTerminalRun("completed"), true);
  assert.equal(isTerminalRun("failed"), true);
  assert.equal(isTerminalRun("cancelled"), true);
  assert.equal(isTerminalRun("running"), false);
});

test("canTransitionStep mirrors the run lifecycle for steps", () => {
  assert.equal(canTransitionStep("running", "completed"), true);
  assert.equal(canTransitionStep("running", "failed"), true);
  assert.equal(canTransitionStep("running", "cancelled"), true);
  assert.equal(canTransitionStep("running", "running"), false);
  assert.equal(canTransitionStep("completed", "running"), false);
  assert.equal(canTransitionStep("failed", "completed"), false);
});

test("calculateCost computes gpt-4 cost in cents from input and output tokens", () => {
  // 1000 input * 0.003 + 500 output * 0.006 = 3 + 3 = 6 cents
  assert.equal(calculateCost("gpt-4", 1000, 500), 6);
  // 2000 input * 0.003 + 0 output * 0.006 = 6 cents
  assert.equal(calculateCost("gpt-4", 2000, 0), 6);
});

test("calculateCost computes gpt-5 cost in cents from input and output tokens", () => {
  // 1000 input * 0.005 + 500 output * 0.01 = 5 + 5 = 10 cents
  assert.equal(calculateCost("gpt-5", 1000, 500), 10);
  // 0 input + 1000 output * 0.01 = 10 cents
  assert.equal(calculateCost("gpt-5", 0, 1000), 10);
});

test("calculateCost defaults to gpt-4 pricing for unknown models and is case-insensitive", () => {
  // Unknown model uses gpt-4 pricing: 1000 * 0.003 + 500 * 0.006 = 6
  assert.equal(calculateCost("claude-3-opus", 1000, 500), 6);
  // Case-insensitive lookup
  assert.equal(calculateCost("GPT-4", 1000, 500), 6);
  assert.equal(calculateCost("Gpt-5", 1000, 500), 10);
});

test("calculateCost rounds fractional cents and clamps negative tokens", () => {
  // 100 input * 0.003 + 100 output * 0.006 = 0.3 + 0.6 = 0.9 -> rounds to 1
  assert.equal(calculateCost("gpt-4", 100, 100), 1);
  // Negatives are clamped to 0
  assert.equal(calculateCost("gpt-4", -100, -100), 0);
});

test("calculateLatencyMs returns elapsed milliseconds and handles null completion", () => {
  assert.equal(calculateLatencyMs(1_000, 1_500), 500);
  assert.equal(calculateLatencyMs(1_000, null), 0);
  assert.equal(calculateLatencyMs(1_000, undefined), 0);
  // Inverted timestamps are clamped to 0
  assert.equal(calculateLatencyMs(2_000, 1_000), 0);
  // Non-finite timestamps are clamped to 0
  assert.equal(calculateLatencyMs(Number.NaN, 1_000), 0);
});

test("summarizeRunForDisplay redacts workspace_id, input_refs_json and output_refs_json", () => {
  const summary = summarizeRunForDisplay(baseRun);
  assert.equal("workspace_id" in summary, false);
  assert.equal("input_refs_json" in summary, false);
  assert.equal("output_refs_json" in summary, false);
  assert.equal(summary.id, "run_1");
  assert.equal(summary.mission_id, "msn_1");
  assert.equal(summary.model, "gpt-4");
});

test("summarizeStepForDisplay redacts tool payloads and buildRunId returns prefixed id", () => {
  const stepSummary = summarizeStepForDisplay(baseStep);
  assert.equal("tool_input_json" in stepSummary, false);
  assert.equal("tool_output_json" in stepSummary, false);
  assert.equal(stepSummary.run_id, "run_1");
  assert.equal(stepSummary.tool_name, "search");

  const runId = buildRunId();
  assert.equal(typeof runId, "string");
  assert.equal(runId.startsWith("run_"), true);
  assert.equal(runId.length > "run_".length, true);
});

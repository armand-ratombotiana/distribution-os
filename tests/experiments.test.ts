import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPERIMENT_TRANSITIONS,
  canTransition,
  isTerminal,
  validateExperiment,
  summarizeForDisplay,
  shouldKill,
  type ExperimentRow,
} from "../db/experiments-pure";

const baseRow: ExperimentRow = {
  id: "exp_1",
  workspace_id: "ws_abc",
  mission_id: "msn_xyz",
  title: "Pricing page headline A/B",
  hypothesis: "A clearer headline increases demo signups.",
  baseline: "Current headline",
  variant: "New benefit-led headline",
  metric: "demo_signup_rate",
  denominator: "unique_visitors",
  sample_expectation: "1000 visitors per arm",
  deadline: 1700000000,
  kill_rule: "Stop if conversion drops below 0.5% after 500 visitors.",
  result: null,
  result_data_json: '{"visitors":600,"conversions":4}',
  decision: "pending",
  confidence: 0,
  strategy_version: 1,
  status: "running",
  created_at: 1700000000,
  updated_at: 1700000001,
};

test("EXPERIMENT_TRANSITIONS allows draft to move to running or blocked", () => {
  assert.deepEqual(EXPERIMENT_TRANSITIONS.draft, ["running", "blocked"]);
});

test("EXPERIMENT_TRANSITIONS allows running to move to completed, stopped, or blocked", () => {
  assert.deepEqual(EXPERIMENT_TRANSITIONS.running, [
    "completed",
    "stopped",
    "blocked",
  ]);
});

test("EXPERIMENT_TRANSITIONS maps completed and stopped to empty arrays", () => {
  assert.deepEqual(EXPERIMENT_TRANSITIONS.completed, []);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.stopped, []);
});

test("EXPERIMENT_TRANSITIONS allows blocked to return to draft or running", () => {
  assert.deepEqual(EXPERIMENT_TRANSITIONS.blocked, ["draft", "running"]);
});

test("canTransition returns true for draft -> running", () => {
  assert.equal(canTransition("draft", "running"), true);
});

test("canTransition returns false for running -> draft because it is not allowed", () => {
  assert.equal(canTransition("running", "draft"), false);
});

test("canTransition returns false for completed -> running because completed is terminal", () => {
  assert.equal(canTransition("completed", "running"), false);
});

test("isTerminal returns true for completed and stopped, false for draft", () => {
  assert.equal(isTerminal("completed"), true);
  assert.equal(isTerminal("stopped"), true);
  assert.equal(isTerminal("draft"), false);
});

test("validateExperiment returns null for a valid experiment spec", () => {
  assert.equal(
    validateExperiment({
      title: "Headline test",
      hypothesis: "A clearer headline increases signups.",
      metric: "signup_rate",
      killRule: "Stop if conversion < 0.5%.",
    }),
    null
  );
});

test("validateExperiment returns an error string when title exceeds 200 characters", () => {
  const longTitle = "x".repeat(201);
  const error = validateExperiment({
    title: longTitle,
    hypothesis: "A clearer headline increases signups.",
    metric: "signup_rate",
    killRule: "Stop if conversion < 0.5%.",
  });
  assert.equal(typeof error, "string");
  assert.match(error as string, /title/);
});

test("summarizeForDisplay redacts workspace_id and result_data_json while keeping the title", () => {
  const summary = summarizeForDisplay(baseRow);
  assert.equal(summary.workspace_id, "[redacted]");
  assert.equal(summary.result_data_json, "[redacted]");
  assert.equal(summary.id, baseRow.id);
  assert.equal(summary.title, baseRow.title);
});

test("shouldKill returns true only when currentMetric is below threshold and result is null", () => {
  assert.equal(
    shouldKill({ currentMetric: 0.3, threshold: 0.5, result: null }),
    true
  );
  assert.equal(
    shouldKill({
      currentMetric: 0.3,
      threshold: 0.5,
      result: "winner: variant",
    }),
    false
  );
  assert.equal(
    shouldKill({ currentMetric: 0.7, threshold: 0.5, result: null }),
    false
  );
});

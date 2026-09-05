/**
 * Edge-case tests for the experiments pure logic (db/experiments-pure.ts).
 *
 * Each test exercises a boundary: empty hypothesis, very long kill_rule,
 * negative confidence, confidence=100, result without decision, concurrent
 * status updates, etc.
 *
 * Run:  npx tsx --test tests/edge-experiments.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransition,
  isTerminal,
  shouldKill,
  summarizeForDisplay,
  validateExperiment,
  type ExperimentRow,
} from "../db/experiments-pure";

function baseRow(overrides: Partial<ExperimentRow> = {}): ExperimentRow {
  return {
    id: "exp_1",
    workspace_id: "ws_1",
    mission_id: "m_1",
    title: "Headline A/B",
    hypothesis: "A clearer headline increases demo signups.",
    baseline: "Current headline",
    variant: "New benefit-led headline",
    metric: "demo_signup_rate",
    denominator: "unique_visitors",
    sample_expectation: "1000 visitors per arm",
    deadline: 1_700_000_000,
    kill_rule: "Stop if conversion drops below 0.5% after 500 visitors.",
    result: null,
    result_data_json: '{"visitors":600,"conversions":4}',
    decision: "pending",
    confidence: 0,
    strategy_version: 1,
    status: "running",
    created_at: 1_700_000_000,
    updated_at: 1_700_000_001,
    ...overrides,
  };
}

test("edge: validateExperiment rejects empty hypothesis with a specific error", () => {
  const err = validateExperiment({
    title: "Headline test",
    hypothesis: "",
    metric: "signup_rate",
    killRule: "Stop if conversion < 0.5%.",
  });
  assert.equal(typeof err, "string");
  assert.match(err as string, /hypothesis/);
});

test("edge: validateExperiment rejects empty title and empty metric", () => {
  const errTitle = validateExperiment({
    title: "",
    hypothesis: "h",
    metric: "m",
    killRule: "k",
  });
  assert.match(errTitle as string, /title/);
  const errMetric = validateExperiment({
    title: "t",
    hypothesis: "h",
    metric: "",
    killRule: "k",
  });
  assert.match(errMetric as string, /metric/);
});

test("edge: validateExperiment rejects empty kill_rule", () => {
  const err = validateExperiment({
    title: "t",
    hypothesis: "h",
    metric: "m",
    killRule: "",
  });
  assert.match(err as string, /kill_rule/);
});

test("edge: validateExperiment rejects a 501-char kill_rule (boundary just over 500)", () => {
  const long = "x".repeat(501);
  const err = validateExperiment({
    title: "t",
    hypothesis: "h",
    metric: "m",
    killRule: long,
  });
  assert.match(err as string, /kill_rule/);
});

test("edge: validateExperiment accepts a 500-char kill_rule (boundary at limit)", () => {
  const at = "x".repeat(500);
  const err = validateExperiment({
    title: "t",
    hypothesis: "h",
    metric: "m",
    killRule: at,
  });
  assert.equal(err, null);
});

test("edge: validateExperiment accepts a 1000-char hypothesis (boundary at limit)", () => {
  const at = "h".repeat(1000);
  const err = validateExperiment({
    title: "t",
    hypothesis: at,
    metric: "m",
    killRule: "k",
  });
  assert.equal(err, null);
});

test("edge: validateExperiment rejects a 1001-char hypothesis (boundary just over 1000)", () => {
  const over = "h".repeat(1001);
  const err = validateExperiment({
    title: "t",
    hypothesis: over,
    metric: "m",
    killRule: "k",
  });
  assert.match(err as string, /hypothesis/);
});

test("edge: confidence field can be 0 and 100 (documented integer range)", () => {
  // The pure module does not clamp confidence — it just stores the integer.
  // The boundary values 0 and 100 must round-trip through summarizeForDisplay.
  const atZero = summarizeForDisplay(baseRow({ confidence: 0 }));
  assert.equal(atZero.confidence, 0);
  const atHundred = summarizeForDisplay(baseRow({ confidence: 100 }));
  assert.equal(atHundred.confidence, 100);
});

test("edge: negative confidence is not clamped by the pure module (caller's responsibility)", () => {
  // The pure helper does not validate the confidence range; verify the value
  // is preserved verbatim so callers know to clamp before persisting.
  const summary = summarizeForDisplay(baseRow({ confidence: -5 }));
  assert.equal(summary.confidence, -5);
});

test("edge: result without decision is allowed by the row shape (decision defaults to 'pending')", () => {
  // The pure module does not enforce result <-> decision coupling. A row with
  // a result but decision='pending' is structurally valid.
  const row = baseRow({ result: "winner: variant", decision: "pending" });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.result, "winner: variant");
  assert.equal(summary.decision, "pending");
});

test("edge: shouldKill is false when result is set, even if currentMetric is far below threshold", () => {
  // shouldKill only fires while the experiment is still running (result=null).
  assert.equal(
    shouldKill({ currentMetric: 0.0, threshold: 1.0, result: "winner: v" }),
    false,
  );
  // Null result + metric below threshold → kill.
  assert.equal(
    shouldKill({ currentMetric: 0.0, threshold: 1.0, result: null }),
    true,
  );
});

test("edge: shouldKill is false when currentMetric equals threshold exactly (strict less-than)", () => {
  assert.equal(
    shouldKill({ currentMetric: 0.5, threshold: 0.5, result: null }),
    false,
  );
  assert.equal(
    shouldKill({ currentMetric: 0.4999, threshold: 0.5, result: null }),
    true,
  );
});

test("edge: concurrent status updates from running are independently valid (no race in pure checks)", () => {
  // Two approvers racing on running → completed vs running → stopped both
  // pass canTransition; the state machine itself is pure and idempotent.
  assert.equal(canTransition("running", "completed"), true);
  assert.equal(canTransition("running", "stopped"), true);
  assert.equal(canTransition("running", "blocked"), true);
  // Re-checking the same transition is stable.
  assert.equal(canTransition("running", "completed"), true);
});

test("edge: blocked → running is allowed (recovery), but completed/stopped are terminal", () => {
  assert.equal(canTransition("blocked", "running"), true);
  assert.equal(canTransition("blocked", "draft"), true);
  assert.equal(isTerminal("completed"), true);
  assert.equal(isTerminal("stopped"), true);
  // No escape from terminal states.
  assert.equal(canTransition("completed", "running"), false);
  assert.equal(canTransition("stopped", "running"), false);
  assert.equal(canTransition("completed", "blocked"), false);
});

test("edge: summarizeForDisplay always redacts workspace_id and result_data_json regardless of status", () => {
  for (const status of ["draft", "running", "completed", "stopped", "blocked"] as const) {
    const summary = summarizeForDisplay(baseRow({ status }));
    assert.equal(summary.workspace_id, "[redacted]");
    assert.equal(summary.result_data_json, "[redacted]");
    assert.equal(summary.id, "exp_1");
    assert.equal(summary.status, status);
  }
});

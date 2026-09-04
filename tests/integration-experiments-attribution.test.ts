import assert from "node:assert/strict";
import test from "node:test";

// Integration: experiment lifecycle ↔ attribution confidence
//
// These tests exercise how an in-flight experiment's `shouldKill` decision
// composes with the attribution engine's confidence scoring. The two modules
// share no state, but the distribution loop reads both to decide whether a
// variant should be stopped and whether a payment has been attributed.

import {
  EXPERIMENT_TRANSITIONS,
  canTransition as canTransitionExperiment,
  isTerminal as isTerminalExperiment,
  shouldKill,
  summarizeForDisplay as summarizeExperiment,
  validateExperiment,
  type ExperimentRow,
} from "../db/experiments-pure";

import {
  EXPERIMENT_DECISIONS,
  EXPERIMENT_STATUSES,
  PAYMENT_STATUSES,
} from "../db/schema";

import {
  PAYMENT_TRANSITIONS,
  buildPaymentIdempotencyKey,
  calculateAttributionConfidence,
  canTransition as canTransitionPayment,
  formatAmount,
  isTerminal as isTerminalPayment,
  summarizePaymentForDisplay,
  summarizeTouchpointForDisplay,
  touchpointMatchesPayment,
  type PaymentRow,
  type TouchpointRow,
} from "../db/attribution-pure";

const baseExperiment: ExperimentRow = {
  id: "exp_1",
  workspace_id: "ws_1",
  mission_id: "m_1",
  title: "Pricing page headline A/B",
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
};

const basePayment: PaymentRow = {
  id: "pay_1",
  workspace_id: "ws_1",
  mission_id: "m_1",
  action_id: null,
  experiment_id: null,
  provider: "stripe",
  provider_payment_id: "pi_abc",
  amount_cents: 1999,
  currency: "usd",
  status: "pending",
  attribution_confidence: 0,
  attributed_at: null,
  received_at: 1_700_000_000_000,
  raw_event_json: '{"customer":"secret@example.com"}',
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

function makeTouchpoint(overrides: Partial<TouchpointRow> = {}): TouchpointRow {
  return {
    id: "tp_1",
    workspace_id: "ws_1",
    mission_id: "m_1",
    action_id: null,
    experiment_id: null,
    channel: "email",
    event_type: "open",
    occurred_at: 1_699_999_000_000,
    received_at: 1_699_999_000_000,
    provider_event_id: "evt_1",
    raw_event_json: '{"ip":"1.2.3.4"}',
    created_at: 1_699_999_000_000,
    ...overrides,
  };
}

test("shouldKill returns true when currentMetric is below threshold and result is null, with attribution_confidence=0 (no touchpoints yet)", () => {
  assert.equal(
    shouldKill({ currentMetric: 0.3, threshold: 0.5, result: null }),
    true,
  );
  assert.equal(calculateAttributionConfidence([], basePayment), 0);
  // An experiment with no attributable touchpoints and a sub-threshold metric
  // should be killed.
});

test("shouldKill returns false when result is non-null even if currentMetric is below threshold", () => {
  assert.equal(
    shouldKill({
      currentMetric: 0.3,
      threshold: 0.5,
      result: "winner: variant",
    }),
    false,
  );
  // Attribution confidence may still be high — the experiment has concluded.
  const tps = [makeTouchpoint({ mission_id: "m_1" })];
  assert.equal(calculateAttributionConfidence(tps, basePayment), 90);
});

test("attribution_confidence=90 (single matching touchpoint) does not affect shouldKill logic — concerns are orthogonal", () => {
  const tps = [makeTouchpoint({ mission_id: "m_1" })];
  assert.equal(calculateAttributionConfidence(tps, basePayment), 90);
  // Even with strong attribution, the kill rule depends only on the experiment's
  // own currentMetric / threshold / result fields.
  assert.equal(
    shouldKill({ currentMetric: 0.7, threshold: 0.5, result: null }),
    false,
  );
});

test("attribution_confidence=20 (no matching touchpoints) + sub-threshold metric + null result => kill experiment", () => {
  const tps = [
    makeTouchpoint({ id: "tp_x", mission_id: "other_mission" }),
    makeTouchpoint({ id: "tp_y", mission_id: "another_mission" }),
  ];
  assert.equal(calculateAttributionConfidence(tps, basePayment), 20);
  assert.equal(
    shouldKill({ currentMetric: 0.2, threshold: 0.5, result: null }),
    true,
  );
});

test("experiment transitions blocked→running and payment transitions pending→succeeded independently (parallel recovery / success paths)", () => {
  assert.equal(canTransitionExperiment("blocked", "running"), true);
  assert.equal(canTransitionPayment("pending", "succeeded"), true);
  // Cross-check: an experiment that is running cannot rewind to draft
  assert.equal(canTransitionExperiment("running", "draft"), false);
  // And a payment cannot go pending → refunded (must go through succeeded first)
  assert.equal(canTransitionPayment("pending", "refunded"), false);
});

test("validateExperiment returns null (valid) AND buildPaymentIdempotencyKey is deterministic — both validation pipelines are independent", () => {
  assert.equal(
    validateExperiment({
      title: "Headline test",
      hypothesis: "A clearer headline increases signups.",
      metric: "signup_rate",
      killRule: "Stop if conversion < 0.5%.",
    }),
    null,
  );
  const key1 = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "Stripe",
    providerPaymentId: "pi_abc",
  });
  const key2 = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "stripe",
    providerPaymentId: "pi_abc",
  });
  assert.equal(key1, key2);
  assert.equal(key1, "pay:ws_1:stripe:pi_abc");
});

test("summarizeForDisplay for experiment and summarizePaymentForDisplay both redact workspace_id", () => {
  const expSummary = summarizeExperiment(baseExperiment);
  assert.equal(expSummary.workspace_id, "[redacted]");
  assert.equal(expSummary.result_data_json, "[redacted]");
  assert.equal(expSummary.id, baseExperiment.id);

  const paySummary = summarizePaymentForDisplay(basePayment);
  assert.equal("workspace_id" in paySummary, false);
  assert.equal("raw_event_json" in paySummary, false);
  assert.equal(paySummary.id, basePayment.id);
});

test("shouldKill requires result === null: a result-filled experiment is never killed even at the same currentMetric", () => {
  // Same currentMetric and threshold, but result is non-null
  assert.equal(
    shouldKill({ currentMetric: 0.1, threshold: 0.5, result: "winner: variant" }),
    false,
  );
  assert.equal(
    shouldKill({ currentMetric: 0.1, threshold: 0.5, result: null }),
    true,
  );
});

test("EXPERIMENT_STATUSES has 5 entries and PAYMENT_STATUSES has 5 entries — both expose a 5-state machine", () => {
  assert.equal(EXPERIMENT_STATUSES.length, 5);
  assert.deepEqual(
    [...EXPERIMENT_STATUSES].sort(),
    ["blocked", "completed", "draft", "running", "stopped"],
  );
  assert.equal(PAYMENT_STATUSES.length, 5);
  assert.deepEqual(
    [...PAYMENT_STATUSES].sort(),
    ["disputed", "failed", "pending", "refunded", "succeeded"],
  );
});

test("isTerminal(experiment, completed/stopped) and isTerminal(payment, refunded/disputed/failed) all return true", () => {
  for (const s of ["completed", "stopped"] as const) {
    assert.equal(isTerminalExperiment(s), true);
  }
  for (const s of ["refunded", "disputed", "failed"] as const) {
    assert.equal(isTerminalPayment(s), true);
  }
  // Sanity: running and pending are not terminal
  assert.equal(isTerminalExperiment("running"), false);
  assert.equal(isTerminalPayment("pending"), false);
});

test("attribution_confidence=75 for 2+ matching touchpoints; experiment.status running→completed when winner declared", () => {
  const tps = [
    makeTouchpoint({ id: "tp_a", mission_id: "m_1" }),
    makeTouchpoint({ id: "tp_b", mission_id: "m_1" }),
    makeTouchpoint({ id: "tp_c", mission_id: "m_1" }),
  ];
  assert.equal(calculateAttributionConfidence(tps, basePayment), 75);
  // Once the experiment has a winner, it can transition running → completed.
  assert.equal(canTransitionExperiment("running", "completed"), true);
});

test("summarizeTouchpointForDisplay and summarizeExperiment both produce safe, PII-free shapes", () => {
  const tpSummary = summarizeTouchpointForDisplay(makeTouchpoint());
  assert.equal("raw_event_json" in tpSummary, false);
  assert.equal("workspace_id" in tpSummary, false);
  assert.equal(tpSummary.id, "tp_1");

  const expSummary = summarizeExperiment(baseExperiment);
  assert.equal(expSummary.workspace_id, "[redacted]");
  assert.equal(expSummary.result_data_json, "[redacted]");
  assert.equal(expSummary.confidence, 0);
});

test("touchpointMatchesPayment by mission_id and by action_id — both paths used for attribution confidence", () => {
  // Match by mission_id
  const tpByMission = makeTouchpoint({ mission_id: "m_1" });
  assert.equal(touchpointMatchesPayment(tpByMission, basePayment), true);
  // Match by action_id
  const paymentWithAction: PaymentRow = {
    ...basePayment,
    mission_id: null,
    action_id: "act_42",
  };
  const tpByAction = makeTouchpoint({ mission_id: "other", action_id: "act_42" });
  assert.equal(touchpointMatchesPayment(tpByAction, paymentWithAction), true);
  // No match
  const tpNoMatch = makeTouchpoint({ mission_id: "other", action_id: "act_99" });
  assert.equal(touchpointMatchesPayment(tpNoMatch, paymentWithAction), false);
});

test("EXPERIMENT_DECISIONS exposes continue/change/stop/blocked/pending and formatAmount formats payment amounts", () => {
  assert.deepEqual(
    [...EXPERIMENT_DECISIONS].sort(),
    ["blocked", "change", "continue", "pending", "stop"],
  );
  assert.equal(formatAmount(1999, "usd"), "$19.99");
  assert.equal(formatAmount(0, "usd"), "$0.00");
  assert.equal(formatAmount(100000, "usd"), "$1,000.00");
});

test("EXPERIMENT_TRANSITIONS and PAYMENT_TRANSITIONS expose their transition maps with the documented shapes", () => {
  assert.deepEqual(EXPERIMENT_TRANSITIONS.draft, ["running", "blocked"]);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.running, ["completed", "stopped", "blocked"]);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.completed, []);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.blocked, ["draft", "running"]);

  assert.deepEqual(PAYMENT_TRANSITIONS.pending, ["succeeded", "failed"]);
  assert.deepEqual(PAYMENT_TRANSITIONS.succeeded, ["refunded", "disputed"]);
  assert.deepEqual(PAYMENT_TRANSITIONS.failed, []);
  assert.deepEqual(PAYMENT_TRANSITIONS.refunded, []);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaymentIdempotencyKey,
  calculateAttributionConfidence,
  canTransition,
  formatAmount,
  isTerminal,
  summarizePaymentForDisplay,
  summarizeTouchpointForDisplay,
  type PaymentRow,
  type TouchpointRow,
} from "../db/attribution-pure.ts";

const basePayment: PaymentRow = {
  id: "pay_1",
  workspace_id: "ws_1",
  mission_id: "mis_1",
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

const baseTouchpoint: TouchpointRow = {
  id: "tp_1",
  workspace_id: "ws_1",
  mission_id: "mis_1",
  action_id: null,
  experiment_id: null,
  channel: "email",
  event_type: "open",
  occurred_at: 1_699_999_000_000,
  received_at: 1_699_999_000_000,
  provider_event_id: "evt_1",
  raw_event_json: '{"ip":"1.2.3.4"}',
  created_at: 1_699_999_000_000,
};

function makeTouchpoint(overrides: Partial<TouchpointRow> = {}): TouchpointRow {
  return { ...baseTouchpoint, ...overrides };
}

test("canTransition allows pending → succeeded and pending → failed", () => {
  assert.equal(canTransition("pending", "succeeded"), true);
  assert.equal(canTransition("pending", "failed"), true);
});

test("canTransition disallows transitions into terminal-only states from pending", () => {
  assert.equal(canTransition("pending", "refunded"), false);
  assert.equal(canTransition("pending", "disputed"), false);
  assert.equal(canTransition("pending", "pending"), false);
});

test("canTransition allows succeeded → refunded and succeeded → disputed, and disallows succeeded → pending", () => {
  assert.equal(canTransition("succeeded", "refunded"), true);
  assert.equal(canTransition("succeeded", "disputed"), true);
  assert.equal(canTransition("succeeded", "pending"), false);
});

test("isTerminal returns true for refunded, disputed and failed", () => {
  assert.equal(isTerminal("refunded"), true);
  assert.equal(isTerminal("disputed"), true);
  assert.equal(isTerminal("failed"), true);
});

test("isTerminal returns false for pending and succeeded", () => {
  assert.equal(isTerminal("pending"), false);
  assert.equal(isTerminal("succeeded"), false);
});

test("formatAmount formats 1999 usd cents as $19.99", () => {
  assert.equal(formatAmount(1999, "usd"), "$19.99");
});

test("formatAmount formats zero and large cent amounts with two decimals", () => {
  assert.equal(formatAmount(0, "usd"), "$0.00");
  assert.equal(formatAmount(100000, "usd"), "$1,000.00");
});

test("calculateAttributionConfidence returns 0 when there are no touchpoints", () => {
  assert.equal(calculateAttributionConfidence([], basePayment), 0);
});

test("calculateAttributionConfidence returns 90 for exactly one matching touchpoint", () => {
  const touchpoints = [makeTouchpoint({ mission_id: "mis_1" })];
  assert.equal(calculateAttributionConfidence(touchpoints, basePayment), 90);
});

test("calculateAttributionConfidence returns 75 for two or more matching touchpoints", () => {
  const touchpoints = [
    makeTouchpoint({ id: "tp_1", mission_id: "mis_1" }),
    makeTouchpoint({ id: "tp_2", mission_id: "mis_1" }),
  ];
  assert.equal(calculateAttributionConfidence(touchpoints, basePayment), 75);

  const three = [
    makeTouchpoint({ id: "tp_1", mission_id: "mis_1" }),
    makeTouchpoint({ id: "tp_2", mission_id: "mis_1" }),
    makeTouchpoint({ id: "tp_3", mission_id: "mis_1" }),
  ];
  assert.equal(calculateAttributionConfidence(three, basePayment), 75);
});

test("calculateAttributionConfidence returns 20 when touchpoints do not match the payment", () => {
  const touchpoints = [
    makeTouchpoint({ id: "tp_1", mission_id: "other_mission" }),
    makeTouchpoint({ id: "tp_2", mission_id: "another_mission" }),
  ];
  assert.equal(calculateAttributionConfidence(touchpoints, basePayment), 20);
});

test("summarizePaymentForDisplay and summarizeTouchpointForDisplay redact raw_event_json and workspace_id", () => {
  const paymentSummary = summarizePaymentForDisplay(basePayment);
  assert.equal("raw_event_json" in paymentSummary, false);
  assert.equal("workspace_id" in paymentSummary, false);
  assert.equal(paymentSummary.id, "pay_1");
  assert.equal(paymentSummary.amount_formatted, "$19.99");
  assert.equal(paymentSummary.status, "pending");

  const touchpointSummary = summarizeTouchpointForDisplay(baseTouchpoint);
  assert.equal("raw_event_json" in touchpointSummary, false);
  assert.equal("workspace_id" in touchpointSummary, false);
  assert.equal(touchpointSummary.id, "tp_1");
  assert.equal(touchpointSummary.channel, "email");
});

test("buildPaymentIdempotencyKey is deterministic and distinguishes inputs", () => {
  const a = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "Stripe",
    providerPaymentId: "pi_abc",
  });
  const aRepeat = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "stripe",
    providerPaymentId: "pi_abc",
  });
  const b = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "stripe",
    providerPaymentId: "pi_xyz",
  });
  const c = buildPaymentIdempotencyKey({
    workspaceId: "ws_2",
    provider: "stripe",
    providerPaymentId: "pi_abc",
  });

  assert.equal(a, aRepeat);
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^pay:ws_1:stripe:pi_abc$/);
});

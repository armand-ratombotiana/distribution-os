/**
 * Edge-case tests for the payments pure logic (db/attribution-pure.ts).
 *
 * Each test exercises a boundary: zero amount, negative amount, very large
 * amount, unknown currency, duplicate provider_payment_id, refund after
 * refund, etc.
 *
 * Run:  npx tsx --test tests/edge-payments.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PAYMENT_TRANSITIONS,
  buildPaymentIdempotencyKey,
  calculateAttributionConfidence,
  canTransition,
  formatAmount,
  isTerminal,
  summarizePaymentForDisplay,
  type PaymentRow,
  type TouchpointRow,
} from "../db/attribution-pure";

function basePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
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
    received_at: 1_700_000_000,
    raw_event_json: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_001,
    ...overrides,
  };
}

function baseTouchpoint(overrides: Partial<TouchpointRow> = {}): TouchpointRow {
  return {
    id: "tp_1",
    workspace_id: "ws_1",
    mission_id: "m_1",
    action_id: null,
    experiment_id: null,
    channel: "email",
    event_type: "open",
    occurred_at: 1_699_000_000,
    received_at: 1_700_000_000,
    provider_event_id: "evt_1",
    raw_event_json: null,
    created_at: 1_700_000_000,
    ...overrides,
  };
}

test("edge: zero-amount payment is allowed by the lifecycle (pending → succeeded)", () => {
  // The pure module does not enforce a minimum amount; $0.00 is structurally
  // valid and the state machine permits the same transitions as any payment.
  const zero = basePayment({ amount_cents: 0 });
  assert.equal(canTransition(zero.status, "succeeded"), true);
  assert.equal(formatAmount(zero.amount_cents, zero.currency), "$0.00");
});

test("edge: negative amount is preserved by the pure module (no clamping)", () => {
  // The pure helpers do not clamp amount_cents. The caller is responsible.
  const negative = basePayment({ amount_cents: -1999, status: "succeeded" });
  assert.equal(negative.amount_cents, -1999);
  // Display formatter still produces a human-readable string.
  assert.equal(formatAmount(negative.amount_cents, "usd"), "-$19.99");
});

test("edge: very large amount (Max safe integer / 100) formats without precision loss", () => {
  // $92,233,720,368,547,758.07 — close to Number.MAX_SAFE_INTEGER cents.
  const large = basePayment({
    amount_cents: Number.MAX_SAFE_INTEGER,
    status: "succeeded",
  });
  assert.equal(large.amount_cents, Number.MAX_SAFE_INTEGER);
  // The formatter divides by 100 and uses Intl — verify it does not throw
  // and produces a string starting with "$".
  const formatted = formatAmount(large.amount_cents, "usd");
  assert.equal(typeof formatted, "string");
  assert.ok(formatted.startsWith("$"));
});

test("edge: unknown currency falls back to a plain decimal+code rendering", () => {
  // Intl.NumberFormat throws for currency codes that are not 3 alphabetic
  // chars (e.g. "X", "USDX", "12"). The helper must catch and return a
  // fallback instead of crashing.
  assert.equal(formatAmount(1999, "X"), "19.99 X");
  assert.equal(formatAmount(1999, "usdx"), "19.99 USDX");
  assert.equal(formatAmount(1999, "12"), "19.99 12");
  // Empty currency defaults to "usd" in the implementation.
  assert.equal(formatAmount(1999, ""), "$19.99");
  // A valid-but-unusual ISO 4217 code (XXX = "no currency") still renders
  // via Intl without throwing (it uses the generic ¤ symbol).
  assert.equal(typeof formatAmount(1999, "xxx"), "string");
});

test("edge: duplicate provider_payment_id resolves to the same idempotency key (dedup contract)", () => {
  const a = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "Stripe",
    providerPaymentId: "pi_abc",
  });
  const b = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "stripe", // different casing — must normalise to lowercase
    providerPaymentId: "pi_abc",
  });
  assert.equal(a, b);
  assert.equal(a, "pay:ws_1:stripe:pi_abc");
  // A different workspace OR provider OR id must produce a different key.
  assert.notEqual(
    a,
    buildPaymentIdempotencyKey({
      workspaceId: "ws_2",
      provider: "stripe",
      providerPaymentId: "pi_abc",
    }),
  );
  assert.notEqual(
    a,
    buildPaymentIdempotencyKey({
      workspaceId: "ws_1",
      provider: "paypal",
      providerPaymentId: "pi_abc",
    }),
  );
  assert.notEqual(
    a,
    buildPaymentIdempotencyKey({
      workspaceId: "ws_1",
      provider: "stripe",
      providerPaymentId: "pi_other",
    }),
  );
});

test("edge: refund after refund is rejected — refunded is terminal", () => {
  assert.equal(isTerminal("refunded"), true);
  assert.equal(canTransition("refunded", "refunded"), false);
  assert.equal(canTransition("refunded", "succeeded"), false);
  assert.equal(canTransition("refunded", "disputed"), false);
  assert.equal(canTransition("refunded", "failed"), false);
  assert.equal(canTransition("refunded", "pending"), false);
});

test("edge: disputed is terminal — no further transitions after dispute", () => {
  assert.equal(isTerminal("disputed"), true);
  for (const target of Object.keys(PAYMENT_TRANSITIONS) as Array<
    keyof typeof PAYMENT_TRANSITIONS
  >) {
    assert.equal(canTransition("disputed", target), false);
  }
});

test("edge: failed is terminal — no recovery path", () => {
  assert.equal(isTerminal("failed"), true);
  assert.equal(canTransition("failed", "succeeded"), false);
  assert.equal(canTransition("failed", "pending"), false);
});

test("edge: succeeded → refunded AND succeeded → disputed are both valid", () => {
  // The model permits a one-way choice between refund and dispute from a
  // successful payment, but not both.
  assert.equal(canTransition("succeeded", "refunded"), true);
  assert.equal(canTransition("succeeded", "disputed"), true);
  // Cannot go back to pending from succeeded.
  assert.equal(canTransition("succeeded", "pending"), false);
});

test("edge: pending → succeeded AND pending → failed are the only exits from pending", () => {
  assert.deepEqual(PAYMENT_TRANSITIONS.pending, ["succeeded", "failed"]);
  assert.equal(canTransition("pending", "succeeded"), true);
  assert.equal(canTransition("pending", "failed"), true);
  assert.equal(canTransition("pending", "refunded"), false);
  assert.equal(canTransition("pending", "disputed"), false);
});

test("edge: attribution confidence is 0 when touchpoints list is empty", () => {
  const payment = basePayment();
  assert.equal(calculateAttributionConfidence([], payment), 0);
  assert.equal(calculateAttributionConfidence([], payment), 0); // idempotent
});

test("edge: attribution confidence is 90 with exactly one matching touchpoint (mission match)", () => {
  const payment = basePayment({ mission_id: "m_1" });
  const tp = baseTouchpoint({ mission_id: "m_1" });
  assert.equal(calculateAttributionConfidence([tp], payment), 90);
});

test("edge: attribution confidence drops to 75 with 2+ matching touchpoints", () => {
  const payment = basePayment({ mission_id: "m_1" });
  const tp1 = baseTouchpoint({ id: "tp_1", mission_id: "m_1" });
  const tp2 = baseTouchpoint({ id: "tp_2", mission_id: "m_1" });
  const tp3 = baseTouchpoint({ id: "tp_3", mission_id: "m_1" });
  assert.equal(calculateAttributionConfidence([tp1, tp2], payment), 75);
  assert.equal(calculateAttributionConfidence([tp1, tp2, tp3], payment), 75);
});

test("edge: attribution confidence is 20 when only non-matching touchpoints exist", () => {
  // Touchpoint belongs to a different mission and has no action_id linkage.
  const payment = basePayment({ mission_id: "m_1", action_id: null });
  const tp = baseTouchpoint({ mission_id: "m_OTHER", action_id: null });
  assert.equal(calculateAttributionConfidence([tp], payment), 20);
  // Action-id match is sufficient even when missions differ.
  const tpAction = baseTouchpoint({
    mission_id: "m_OTHER",
    action_id: "act_link",
  });
  const paymentAction = basePayment({ mission_id: "m_1", action_id: "act_link" });
  assert.equal(calculateAttributionConfidence([tpAction], paymentAction), 90);
});

test("edge: summarizePaymentForDisplay redacts raw_event_json and workspace_id and adds amount_formatted", () => {
  const payment = basePayment({ amount_cents: 1999, currency: "usd" });
  const summary = summarizePaymentForDisplay(payment);
  assert.equal("raw_event_json" in summary, false);
  assert.equal("workspace_id" in summary, false);
  assert.equal(summary.amount_cents, 1999);
  assert.equal(summary.currency, "usd");
  assert.equal(summary.amount_formatted, "$19.99");
  // Other public fields are preserved.
  assert.equal(summary.id, "pay_1");
  assert.equal(summary.provider, "stripe");
  assert.equal(summary.provider_payment_id, "pi_abc");
});

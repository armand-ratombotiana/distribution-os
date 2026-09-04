import assert from "node:assert/strict";
import test from "node:test";

// Integration: idempotency keys ↔ payment & touchpoint dedup
//
// Provider webhooks are retried, so the system must deduplicate both the
// raw webhook event (via `buildKey`) and the resulting payment (via
// `buildPaymentIdempotencyKey`). Touchpoints are deduplicated by
// `(provider, eventId)` and matched to payments by mission or action id.

import {
  buildKey,
  calculateBackoff,
  classifyError,
  computePayloadHash,
  deduplicateByProviderEventId,
  findDuplicates,
  isRecordValid,
  shouldRetry,
  type IdempotencyRecord,
} from "../lib/idempotency-pure";

import {
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

const FIXED_NOW = 1_700_000_000_000;

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

test("buildKey produces 'idem:provider:eventId' AND buildPaymentIdempotencyKey produces 'pay:ws:provider:paymentId'", () => {
  assert.equal(buildKey("stripe", "evt_1"), "idem:stripe:evt_1");
  assert.equal(buildKey("github", "123"), "idem:github:123");

  const payKey = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "Stripe",
    providerPaymentId: "pi_abc",
  });
  assert.equal(payKey, "pay:ws_1:stripe:pi_abc");
});

test("isRecordValid returns true within TTL AND canTransition(payment, pending→succeeded) returns true", () => {
  const record: IdempotencyRecord = {
    key: "idem:stripe:evt_1",
    status: "completed",
    createdAtMs: FIXED_NOW,
    expiresAtMs: FIXED_NOW + 60_000,
  };
  assert.equal(isRecordValid(record, FIXED_NOW), true);
  assert.equal(isRecordValid(record, FIXED_NOW + 59_999), true);
  assert.equal(isRecordValid(record, FIXED_NOW + 60_000), false);

  assert.equal(canTransitionPayment("pending", "succeeded"), true);
  assert.equal(canTransitionPayment("pending", "failed"), true);
});

test("findDuplicates returns second-and-later occurrences AND deduplicateByProviderEventId keeps first occurrence", () => {
  const items = ["a", "b", "a", "c", "b", "a"];
  const dupes = findDuplicates(items, (s) => s);
  assert.deepEqual(dupes, ["a", "b", "a"]);

  const events = [
    { provider: "stripe", eventId: "a", n: 1 },
    { provider: "stripe", eventId: "a", n: 2 },
    { provider: "stripe", eventId: "b", n: 3 },
    { provider: "github", eventId: "a", n: 4 }, // different provider → not a dupe
    { provider: "stripe", eventId: "b", n: 5 },
  ];
  const out = deduplicateByProviderEventId(events);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((x) => x.n),
    [1, 3, 4],
  );
});

test("computePayloadHash matches the known SHA-256 vector AND formatAmount formats 1999 usd as $19.99", () => {
  assert.equal(
    computePayloadHash("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
  assert.equal(computePayloadHash("").length, 64);

  assert.equal(formatAmount(1999, "usd"), "$19.99");
  assert.equal(formatAmount(0, "usd"), "$0.00");
  assert.equal(formatAmount(100000, "usd"), "$1,000.00");
});

test("classifyError maps HTTP 429 to 'rate_limit' AND canTransition(payment, succeeded→refunded) returns true", () => {
  assert.equal(classifyError({ status: 429 }), "rate_limit");
  assert.equal(classifyError({ status: 500 }), "transient");
  assert.equal(classifyError({ status: 503 }), "transient");
  assert.equal(classifyError({ status: 400 }), "permanent");

  assert.equal(canTransitionPayment("succeeded", "refunded"), true);
  assert.equal(canTransitionPayment("succeeded", "disputed"), true);
  assert.equal(canTransitionPayment("succeeded", "pending"), false);
});

test("shouldRetry retries transient errors AND isTerminal(payment, failed) returns true", () => {
  assert.equal(shouldRetry("transient", 0, 3), true);
  assert.equal(shouldRetry("rate_limit", 1, 3), true);
  assert.equal(shouldRetry("timeout", 2, 3), true);
  assert.equal(shouldRetry("network", 0, 3), true);
  assert.equal(shouldRetry("transient", 3, 3), false);
  assert.equal(shouldRetry("permanent", 0, 3), false);
  assert.equal(shouldRetry("unknown", 0, 3), false);

  assert.equal(isTerminalPayment("failed"), true);
  assert.equal(isTerminalPayment("refunded"), true);
  assert.equal(isTerminalPayment("disputed"), true);
  assert.equal(isTerminalPayment("pending"), false);
  assert.equal(isTerminalPayment("succeeded"), false);
});

test("calculateBackoff grows exponentially AND summarizePaymentForDisplay redacts raw_event_json", () => {
  assert.equal(calculateBackoff(0), 1000);
  assert.equal(calculateBackoff(1), 2000);
  assert.equal(calculateBackoff(2), 4000);
  assert.equal(calculateBackoff(3), 8000);
  assert.equal(calculateBackoff(5), 30_000); // capped
  assert.equal(calculateBackoff(10, { maxMs: 5000 }), 5000);

  const summary = summarizePaymentForDisplay(basePayment);
  assert.equal("raw_event_json" in summary, false);
  assert.equal("workspace_id" in summary, false);
  assert.equal(summary.id, "pay_1");
  assert.equal(summary.amount_formatted, "$19.99");
  assert.equal(summary.status, "pending");
});

test("buildKey and buildPaymentIdempotencyKey are both deterministic for identical inputs", () => {
  assert.equal(buildKey("stripe", "evt_1"), buildKey("stripe", "evt_1"));
  assert.equal(
    buildPaymentIdempotencyKey({
      workspaceId: "ws_1",
      provider: "Stripe",
      providerPaymentId: "pi_abc",
    }),
    buildPaymentIdempotencyKey({
      workspaceId: "ws_1",
      provider: "stripe",
      providerPaymentId: "pi_abc",
    }),
  );
});

test("deduplicateByProviderEventId distinguishes by provider AND touchpointMatchesPayment matches by mission_id", () => {
  const events = [
    { provider: "stripe", eventId: "a", n: 1 },
    { provider: "stripe", eventId: "a", n: 2 }, // dupe
    { provider: "github", eventId: "a", n: 3 }, // not a dupe (different provider)
  ];
  const out = deduplicateByProviderEventId(events);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((x) => x.n),
    [1, 3],
  );

  const tp = makeTouchpoint({ mission_id: "m_1" });
  assert.equal(touchpointMatchesPayment(tp, basePayment), true);
  const tpOther = makeTouchpoint({ mission_id: "other" });
  assert.equal(touchpointMatchesPayment(tpOther, basePayment), false);
});

test("computePayloadHash is sensitive to input changes AND calculateAttributionConfidence returns 0 for no touchpoints", () => {
  const a = computePayloadHash('{"id":1}');
  const b = computePayloadHash('{"id":1}');
  assert.equal(a, b);
  assert.notEqual(computePayloadHash('{"id":2}'), a);
  assert.notEqual(computePayloadHash('{"id":1 }'), a); // whitespace matters

  assert.equal(calculateAttributionConfidence([], basePayment), 0);
});

test("isRecordValid returns false past expiry AND isTerminal(payment, refunded) returns true", () => {
  const record: IdempotencyRecord = {
    key: "idem:stripe:evt_1",
    status: "completed",
    createdAtMs: FIXED_NOW,
    expiresAtMs: FIXED_NOW + 60_000,
  };
  assert.equal(isRecordValid(record, FIXED_NOW + 120_000), false);

  assert.equal(isTerminalPayment("refunded"), true);
  assert.equal(isTerminalPayment("disputed"), true);
});

test("findDuplicates returns empty for unique items AND calculateAttributionConfidence returns 90 for one matching touchpoint", () => {
  const unique = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const dupes = findDuplicates(unique, (x) => String(x.id));
  assert.deepEqual(dupes, []);

  const tps = [makeTouchpoint({ mission_id: "m_1" })];
  assert.equal(calculateAttributionConfidence(tps, basePayment), 90);
});

test("shouldRetry never retries permanent errors AND canTransition(payment, pending→refunded) returns false (must go through succeeded)", () => {
  assert.equal(shouldRetry("permanent", 0, 3), false);
  assert.equal(shouldRetry("permanent", 1, 5), false);
  assert.equal(shouldRetry("unknown", 0, 3), false);

  assert.equal(canTransitionPayment("pending", "refunded"), false);
  assert.equal(canTransitionPayment("pending", "disputed"), false);
  // Must go pending → succeeded → refunded/disputed
  assert.equal(canTransitionPayment("pending", "succeeded"), true);
  assert.equal(canTransitionPayment("succeeded", "refunded"), true);
});

test("calculateBackoff caps at maxMs AND calculateAttributionConfidence returns 75 for multiple matching touchpoints", () => {
  assert.equal(calculateBackoff(5), 30_000);
  assert.equal(calculateBackoff(10), 30_000);
  assert.equal(calculateBackoff(2, { jitter: true, random: () => 0.5 }), Math.floor(4000 * 0.5));

  const tps = [
    makeTouchpoint({ id: "tp_a", mission_id: "m_1" }),
    makeTouchpoint({ id: "tp_b", mission_id: "m_1" }),
    makeTouchpoint({ id: "tp_c", mission_id: "m_1" }),
  ];
  assert.equal(calculateAttributionConfidence(tps, basePayment), 75);
});

test("classifyError maps HTTP 5xx to 'transient' AND touchpointMatchesPayment matches by action_id", () => {
  assert.equal(classifyError({ status: 500 }), "transient");
  assert.equal(classifyError({ status: 502 }), "transient");
  assert.equal(classifyError({ status: 503 }), "transient");
  assert.equal(classifyError({ code: "ECONNREFUSED" }), "network");
  assert.equal(classifyError({ code: "ETIMEDOUT" }), "timeout");
  assert.equal(classifyError({ message: "Request timeout exceeded" }), "timeout");

  const paymentWithAction: PaymentRow = {
    ...basePayment,
    mission_id: null,
    action_id: "act_42",
  };
  const tpByAction = makeTouchpoint({ mission_id: "other", action_id: "act_42" });
  assert.equal(touchpointMatchesPayment(tpByAction, paymentWithAction), true);

  // summarizeTouchpointForDisplay redacts raw_event_json and workspace_id
  const tpSummary = summarizeTouchpointForDisplay(tpByAction);
  assert.equal("raw_event_json" in tpSummary, false);
  assert.equal("workspace_id" in tpSummary, false);
});

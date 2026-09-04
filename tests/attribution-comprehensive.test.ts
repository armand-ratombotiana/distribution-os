/**
 * Comprehensive attribution coverage. Crosses the multi-touch attribution
 * models in `lib/attribution-model-pure.ts` with the payment-touchpoint
 * attribution helpers in `db/attribution-pure.ts`.
 *
 * 15 tests, all pure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  firstTouchAttribution,
  lastTouchAttribution,
  linearAttribution,
  timeDecayAttribution,
  positionBasedAttribution,
  runAttribution,
  getModelLabel,
  type Touchpoint,
  type AttributionModel,
} from "../lib/attribution-model-pure.ts";
import {
  calculateAttributionConfidence,
  touchpointMatchesPayment,
  formatAmount,
  type PaymentRow,
  type TouchpointRow,
} from "../db/attribution-pure.ts";

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function tp(id: string, daysAgo: number, channel = "email"): Touchpoint {
  return { id, channel, timestamp: NOW - daysAgo * DAY };
}

function sumCredits(results: { credit: number }[]): number {
  return results.reduce((acc, r) => acc + r.credit, 0);
}

// ─── first_touch ──────────────────────────────────────────────────────────

test("attribution/first_touch: 100% credit goes to the earliest touchpoint by timestamp", () => {
  const tps = [tp("a", 5), tp("b", 1), tp("c", 3)];
  const result = firstTouchAttribution(tps);
  assert.equal(result.length, 1);
  assert.equal(result[0].touchpoint.id, "a");
  assert.equal(result[0].credit, 1);
});

// ─── last_touch ───────────────────────────────────────────────────────────

test("attribution/last_touch: 100% credit goes to the latest touchpoint by timestamp", () => {
  const tps = [tp("a", 5), tp("b", 1), tp("c", 3)];
  const result = lastTouchAttribution(tps);
  assert.equal(result.length, 1);
  assert.equal(result[0].touchpoint.id, "b");
  assert.equal(result[0].credit, 1);
});

// ─── linear ───────────────────────────────────────────────────────────────

test("attribution/linear: equal credit to every touchpoint; sum to 1", () => {
  const tps = [tp("a", 1), tp("b", 2), tp("c", 3), tp("d", 4)];
  const result = linearAttribution(tps);
  assert.equal(result.length, 4);
  for (const r of result) {
    assert.ok(Math.abs(r.credit - 0.25) < 1e-9);
  }
  assert.ok(Math.abs(sumCredits(result) - 1) < 1e-9);
});

// ─── time_decay ───────────────────────────────────────────────────────────

test("attribution/time_decay: later touchpoints receive more credit; sum to 1", () => {
  const tps = [tp("a", 14), tp("b", 7), tp("c", 1)];
  const result = timeDecayAttribution(tps, 7);
  assert.equal(result.length, 3);
  // Credits ascending: a < b < c.
  const credits = result.map((r) => r.credit);
  assert.ok(credits[0] < credits[1]);
  assert.ok(credits[1] < credits[2]);
  // Sum to 1.
  assert.ok(Math.abs(sumCredits(result) - 1) < 1e-9);
  // Sorted by timestamp ascending → a is first.
  assert.equal(result[0].touchpoint.id, "a");
});

test("attribution/time_decay: half-life parameter affects weight distribution", () => {
  const tps = [tp("a", 14), tp("b", 0)];
  const shortHalf = timeDecayAttribution(tps, 1); // 1-day half-life
  const longHalf = timeDecayAttribution(tps, 30); // 30-day half-life
  // With a shorter half-life, the older touchpoint is discounted more heavily.
  const shortRatio = shortHalf[0].credit / shortHalf[1].credit;
  const longRatio = longHalf[0].credit / longHalf[1].credit;
  assert.ok(shortRatio < longRatio, "shorter half-life should discount the older touchpoint more");
});

// ─── position_based ───────────────────────────────────────────────────────

test("attribution/position_based: 40/20/40 split for 3 touchpoints (U-shaped)", () => {
  const tps = [tp("a", 3), tp("b", 2), tp("c", 1)];
  const result = positionBasedAttribution(tps);
  assert.equal(result.length, 3);
  assert.ok(Math.abs(result[0].credit - 0.4) < 1e-9);
  assert.ok(Math.abs(result[1].credit - 0.2) < 1e-9);
  assert.ok(Math.abs(result[2].credit - 0.4) < 1e-9);
  assert.ok(Math.abs(sumCredits(result) - 1) < 1e-9);
});

test("attribution/position_based: 50/50 for 2 touchpoints; 100% for 1; 40/(20/n)/40 for n>3", () => {
  const single = positionBasedAttribution([tp("a", 1)]);
  assert.equal(single.length, 1);
  assert.equal(single[0].credit, 1);

  const pair = positionBasedAttribution([tp("a", 2), tp("b", 1)]);
  assert.equal(pair.length, 2);
  assert.ok(Math.abs(pair[0].credit - 0.5) < 1e-9);
  assert.ok(Math.abs(pair[1].credit - 0.5) < 1e-9);

  const four = positionBasedAttribution([tp("a", 4), tp("b", 3), tp("c", 2), tp("d", 1)]);
  assert.equal(four.length, 4);
  assert.ok(Math.abs(four[0].credit - 0.4) < 1e-9);
  assert.ok(Math.abs(four[3].credit - 0.4) < 1e-9);
  // Middle two share 20% evenly: 0.1 each.
  assert.ok(Math.abs(four[1].credit - 0.1) < 1e-9);
  assert.ok(Math.abs(four[2].credit - 0.1) < 1e-9);
  assert.ok(Math.abs(sumCredits(four) - 1) < 1e-9);
});

// ─── empty input invariant ────────────────────────────────────────────────

test("attribution/empty: every model returns [] for empty touchpoint list", () => {
  for (const fn of [
    firstTouchAttribution,
    lastTouchAttribution,
    linearAttribution,
    (tps: Touchpoint[]) => timeDecayAttribution(tps, 7),
    positionBasedAttribution,
  ]) {
    assert.deepEqual(fn([]), []);
  }
});

// ─── runAttribution dispatcher ────────────────────────────────────────────

test("attribution/runAttribution: dispatcher routes to the correct model", () => {
  const tps = [tp("a", 3), tp("b", 2), tp("c", 1)];
  assert.deepEqual(
    runAttribution("first_touch", tps).map((r) => r.touchpoint.id),
    firstTouchAttribution(tps).map((r) => r.touchpoint.id),
  );
  assert.deepEqual(
    runAttribution("last_touch", tps).map((r) => r.touchpoint.id),
    lastTouchAttribution(tps).map((r) => r.touchpoint.id),
  );
  assert.equal(runAttribution("linear", tps).length, 3);
  assert.equal(runAttribution("time_decay", tps).length, 3);
  assert.equal(runAttribution("position_based", tps).length, 3);
});

test("attribution/runAttribution: returns [] for an unknown model", () => {
  assert.deepEqual(runAttribution("unknown" as AttributionModel, [tp("a", 1)]), []);
});

test("attribution/runAttribution: forwards halfLifeDays option to time_decay model", () => {
  const tps = [tp("a", 14), tp("b", 0)];
  const direct = timeDecayAttribution(tps, 1);
  const viaRun = runAttribution("time_decay", tps, { halfLifeDays: 1 });
  assert.equal(direct.length, viaRun.length);
  for (let i = 0; i < direct.length; i++) {
    assert.ok(Math.abs(direct[i].credit - viaRun[i].credit) < 1e-9);
  }
});

// ─── getModelLabel ────────────────────────────────────────────────────────

test("attribution/getModelLabel: returns human-readable labels for each model", () => {
  assert.equal(getModelLabel("first_touch"), "First Touch");
  assert.equal(getModelLabel("last_touch"), "Last Touch");
  assert.equal(getModelLabel("linear"), "Linear");
  assert.equal(getModelLabel("time_decay"), "Time Decay");
  assert.equal(getModelLabel("position_based"), "Position Based (U-Shaped)");
});

// ─── calculateAttributionConfidence ───────────────────────────────────────

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
  received_at: NOW,
  raw_event_json: null,
  created_at: NOW,
  updated_at: NOW,
};

function makeTouchpoint(overrides: Partial<TouchpointRow> = {}): TouchpointRow {
  return {
    id: "tp_1",
    workspace_id: "ws_1",
    mission_id: "mis_1",
    action_id: null,
    experiment_id: null,
    channel: "email",
    event_type: "open",
    occurred_at: NOW - DAY,
    received_at: NOW - DAY,
    provider_event_id: "evt_1",
    raw_event_json: null,
    created_at: NOW - DAY,
    ...overrides,
  };
}

test("attribution/calculateAttributionConfidence: 0 touchpoints → 0; 1 match → 90; 2+ matches → 75; no match → 20", () => {
  assert.equal(calculateAttributionConfidence([], basePayment), 0);
  const oneMatch = [makeTouchpoint({ mission_id: "mis_1" })];
  assert.equal(calculateAttributionConfidence(oneMatch, basePayment), 90);
  const twoMatches = [
    makeTouchpoint({ id: "tp_1", mission_id: "mis_1" }),
    makeTouchpoint({ id: "tp_2", mission_id: "mis_1" }),
  ];
  assert.equal(calculateAttributionConfidence(twoMatches, basePayment), 75);
  const noMatch = [
    makeTouchpoint({ id: "tp_1", mission_id: "other" }),
    makeTouchpoint({ id: "tp_2", mission_id: "another" }),
  ];
  assert.equal(calculateAttributionConfidence(noMatch, basePayment), 20);
});

// ─── touchpointMatchesPayment ─────────────────────────────────────────────

test("attribution/touchpointMatchesPayment: matches by mission_id OR action_id", () => {
  // Mission match.
  assert.equal(
    touchpointMatchesPayment(
      makeTouchpoint({ mission_id: "mis_1" }),
      { ...basePayment, mission_id: "mis_1", action_id: null },
    ),
    true,
  );
  // Action match (different missions).
  assert.equal(
    touchpointMatchesPayment(
      makeTouchpoint({ mission_id: "other", action_id: "act_1" }),
      { ...basePayment, mission_id: "different", action_id: "act_1" },
    ),
    true,
  );
  // No match.
  assert.equal(
    touchpointMatchesPayment(
      makeTouchpoint({ mission_id: "x", action_id: null }),
      { ...basePayment, mission_id: "y", action_id: null },
    ),
    false,
  );
});

// ─── formatAmount ─────────────────────────────────────────────────────────

test("attribution/formatAmount: formats integer cents as USD currency string with two decimals", () => {
  assert.equal(formatAmount(1999, "usd"), "$19.99");
  assert.equal(formatAmount(0, "usd"), "$0.00");
  assert.equal(formatAmount(100000, "usd"), "$1,000.00");
  assert.equal(formatAmount(5, "usd"), "$0.05");
  // Empty / missing currency defaults to USD.
  assert.equal(formatAmount(1999, ""), "$19.99");
  // Invalid currency code (non-ISO) triggers the catch branch and falls back
  // to "<amount> <CODE>".
  assert.match(formatAmount(1999, "12" as never), /19\.99\s*12/i);
});

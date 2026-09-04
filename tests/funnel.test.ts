import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConversionRate,
  calculateDropoff,
  calculateStageMetrics,
  calculateOverallConversionRate,
  getBottleneckStage,
  type Funnel,
  type FunnelStage,
} from "../lib/funnel-pure.ts";

const funnel: Funnel = {
  stages: [
    { id: "visit", label: "Visit", users: 1000 },
    { id: "signup", label: "Sign Up", users: 400 },
    { id: "activate", label: "Activate", users: 200 },
    { id: "purchase", label: "Purchase", users: 50 },
  ],
};

test("calculateConversionRate returns next/previous for positive previous", () => {
  assert.ok(Math.abs(calculateConversionRate(1000, 400) - 0.4) < 1e-9);
});

test("calculateConversionRate returns 0 when previous is non-positive or inputs are invalid", () => {
  assert.equal(calculateConversionRate(0, 10), 0);
  assert.equal(calculateConversionRate(-5, 10), 0);
  assert.equal(calculateConversionRate(NaN, 10), 0);
  assert.equal(calculateConversionRate(100, NaN), 0);
  assert.equal(calculateConversionRate(100, -5), 0);
});

test("calculateConversionRate caps result at 1 when next exceeds previous", () => {
  assert.equal(calculateConversionRate(100, 200), 1);
});

test("calculateDropoff is the complement of conversion rate", () => {
  assert.ok(Math.abs(calculateDropoff(1000, 400) - 0.6) < 1e-9);
  assert.ok(Math.abs(calculateDropoff(0, 10) - 1) < 1e-9);
});

test("calculateStageMetrics returns one entry per stage", () => {
  const m = calculateStageMetrics(funnel);
  assert.equal(m.length, 4);
  assert.deepEqual(m.map((x) => x.stageId), ["visit", "signup", "activate", "purchase"]);
});

test("calculateStageMetrics gives the first stage a conversion of 1 and no drop-off", () => {
  const m = calculateStageMetrics(funnel);
  assert.equal(m[0].conversionRate, 1);
  assert.equal(m[0].dropoff, 0);
  assert.equal(m[0].usersLost, 0);
});

test("calculateStageMetrics computes per-stage conversion, drop-off, and users lost", () => {
  const m = calculateStageMetrics(funnel);
  assert.ok(Math.abs(m[1].conversionRate - 0.4) < 1e-9);
  assert.ok(Math.abs(m[1].dropoff - 0.6) < 1e-9);
  assert.equal(m[1].usersLost, 600);
  assert.ok(Math.abs(m[2].conversionRate - 0.5) < 1e-9);
  assert.equal(m[2].usersLost, 200);
});

test("calculateStageMetrics returns empty for an empty funnel", () => {
  assert.deepEqual(calculateStageMetrics({ stages: [] }), []);
});

test("calculateOverallConversionRate returns last/first", () => {
  assert.ok(Math.abs(calculateOverallConversionRate(funnel) - 0.05) < 1e-9);
});

test("calculateOverallConversionRate returns 0 for empty or zero-first-stage funnels", () => {
  assert.equal(calculateOverallConversionRate({ stages: [] }), 0);
  assert.equal(
    calculateOverallConversionRate({ stages: [{ id: "a", users: 0 }, { id: "b", users: 5 }] }),
    0,
  );
});

test("getBottleneckStage identifies the stage with the largest drop-off", () => {
  const bn = getBottleneckStage(funnel);
  assert.equal(bn.stageId, "purchase");
  assert.ok(Math.abs(bn.dropoff - 0.75) < 1e-9);
  assert.equal(bn.usersLost, 150);
});

test("getBottleneckStage returns null stageId for funnels with fewer than two stages", () => {
  const single: FunnelStage[] = [{ id: "only", users: 10 }];
  assert.equal(getBottleneckStage({ stages: single }).stageId, null);
  assert.equal(getBottleneckStage({ stages: [] }).stageId, null);
});

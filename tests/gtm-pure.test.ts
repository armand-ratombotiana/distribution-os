import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateChannel,
  calculateBudget,
  getSequence,
  type GTMChannel,
  type GTMStrategy,
} from "../lib/gtm-pure.ts";

const strategy: GTMStrategy = {
  id: "g1",
  totalBudget: 100_000,
  targetCac: 100,
  targetRatio: 3,
  channels: [
    { id: "paid", phase: "launch", cac: 50, ltv: 200, reach: 0.7, icpFit: 0.8 },
    { id: "content", phase: "research", cac: 20, ltv: 120, reach: 0.4, icpFit: 0.9 },
    { id: "expensive", phase: "scale", cac: 150, ltv: 400, reach: 0.9, icpFit: 0.6 },
  ],
  phases: ["research", "positioning", "launch", "scale", "retain"],
};

test("evaluateChannel computes a composite score in [0, 100]", () => {
  const e = evaluateChannel(strategy.channels[0], strategy);
  assert.ok(e.score >= 0 && e.score <= 100);
  assert.equal(e.channelId, "paid");
});

test("evaluateChannel weights LTV:CAC ratio at 0.4, CAC ceiling at 0.3, reach at 0.15, icpFit at 0.15", () => {
  // paid: ratio=200/50=4 → ratioScore=4/3=1.0; cacScore=100/50=2.0→1; reach=0.7; icp=0.8
  // score = 0.4×100 + 0.3×100 + 0.15×70 + 0.15×80 = 40 + 30 + 10.5 + 12 = 92.5
  const e = evaluateChannel(strategy.channels[0], strategy);
  assert.ok(Math.abs(e.score - 92.5) < 1e-9);
});

test("evaluateChannel reports the LTV:CAC ratio and Infinity when CAC is 0", () => {
  const e = evaluateChannel(strategy.channels[0], strategy);
  assert.equal(e.ratio, 4);
  const zeroCac: GTMChannel = { ...strategy.channels[0], cac: 0, ltv: 100 };
  assert.equal(evaluateChannel(zeroCac, strategy).ratio, Infinity);
});

test("evaluateChannel marks viable when cac ≤ targetCac and ratio ≥ targetRatio", () => {
  assert.equal(evaluateChannel(strategy.channels[0], strategy).viable, true); // cac=50≤100, ratio=4≥3
  assert.equal(evaluateChannel(strategy.channels[1], strategy).viable, true); // cac=20≤100, ratio=6≥3
  assert.equal(evaluateChannel(strategy.channels[2], strategy).viable, false); // cac=150>100
});

test("evaluateChannel returns a zero-score empty result for invalid input", () => {
  const e = evaluateChannel(null as unknown as GTMChannel, strategy);
  assert.equal(e.score, 0);
  assert.equal(e.viable, false);
  assert.equal(evaluateChannel(strategy.channels[0], null as unknown as GTMStrategy).score, 0);
});

test("calculateBudget allocates total budget proportional to score among viable channels only", () => {
  // paid score 92.5; content: ratio=6→1.0, cacScore=100/20=5→1, reach=0.4, icp=0.9 → 40+30+6+13.5 = 89.5
  // expensive is not viable (cac>targetCac) → excluded
  const alloc = calculateBudget(strategy);
  assert.equal(alloc.length, 3);
  assert.equal(alloc[2].amount, 0); // expensive gets nothing
  const totalAllocated = alloc.reduce((sum, a) => sum + a.amount, 0);
  assert.ok(Math.abs(totalAllocated - 100_000) < 1e-9);
  // paid (92.5) vs content (89.5) → paid gets slightly more
  assert.ok(alloc[0].amount > alloc[1].amount);
});

test("calculateBudget returns shares summing to 1 across viable channels", () => {
  const alloc = calculateBudget(strategy);
  const viableShares = alloc.filter((a) => a.amount > 0).map((a) => a.share);
  const sum = viableShares.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("calculateBudget returns [] for empty / invalid strategy and zero to all when none viable", () => {
  assert.deepEqual(calculateBudget(null as unknown as GTMStrategy), []);
  assert.deepEqual(calculateBudget({ ...strategy, channels: [] }), []);
  assert.deepEqual(
    calculateBudget({ ...strategy, totalBudget: -10 }).map((a) => a.amount),
    [0, 0, 0],
  );

  const inv: GTMStrategy = {
    ...strategy,
    channels: [{ id: "bad", phase: "launch", cac: 9999, ltv: 1, reach: 0.5, icpFit: 0.5 }],
  };
  const alloc = calculateBudget(inv);
  assert.equal(alloc.length, 1);
  assert.equal(alloc[0].amount, 0);
  assert.equal(alloc[0].share, 0);
});

test("getSequence returns one step per phase, ordered, with channels grouped by phase", () => {
  const seq = getSequence(strategy);
  assert.equal(seq.length, 5);
  assert.equal(seq[0].step, 1);
  assert.equal(seq[0].phase, "research");
  assert.deepEqual(seq[0].channelIds, ["content"]);
  assert.deepEqual(seq[2].channelIds, ["paid"]);
  assert.deepEqual(seq[3].channelIds, ["expensive"]);
  // phases with no channels return []
  assert.deepEqual(seq[1].channelIds, []);
  assert.deepEqual(seq[4].channelIds, []);
});

test("getSequence returns [] for empty / invalid strategy", () => {
  assert.deepEqual(getSequence(null as unknown as GTMStrategy), []);
  assert.deepEqual(getSequence({ ...strategy, phases: [] }), []);
});

test("getSequence step numbers are 1-based and sequential", () => {
  const seq = getSequence({ ...strategy, phases: ["launch", "scale"] });
  assert.deepEqual(seq.map((s) => s.step), [1, 2]);
  assert.deepEqual(seq.map((s) => s.phase), ["launch", "scale"]);
});

test("calculateBudget and getSequence handle channels referenced by getSequence even when no phase matches", () => {
  const noPhaseMatch: GTMStrategy = {
    ...strategy,
    channels: [{ id: "x", phase: "retain" as never, cac: 10, ltv: 50, reach: 0.5, icpFit: 0.5 }],
    phases: ["launch"],
  };
  // viable: cac=10≤100, ratio=5≥3 → viable; allocated full budget
  const alloc = calculateBudget(noPhaseMatch);
  assert.ok(Math.abs(alloc[0].amount - 100_000) < 1e-9);
  // getSequence returns the launch step with no matching channels
  const seq = getSequence(noPhaseMatch);
  assert.deepEqual(seq[0].channelIds, []);
});

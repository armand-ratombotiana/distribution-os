import assert from "node:assert/strict";
import test from "node:test";

import {
  firstTouchAttribution,
  lastTouchAttribution,
  linearAttribution,
  timeDecayAttribution,
  positionBasedAttribution,
  runAttribution,
  getModelLabel,
  type Touchpoint,
} from "../lib/attribution-model-pure.ts";

const DAY = 24 * 60 * 60 * 1000;

const baseTouchpoints: Touchpoint[] = [
  { id: "t1", channel: "email", timestamp: 0 },
  { id: "t2", channel: "ad", timestamp: 7 * DAY },
  { id: "t3", channel: "social", timestamp: 14 * DAY },
];

test("firstTouchAttribution returns empty array for no touchpoints", () => {
  assert.deepEqual(firstTouchAttribution([]), []);
});

test("firstTouchAttribution credits only the earliest touchpoint", () => {
  const res = firstTouchAttribution(baseTouchpoints);
  assert.equal(res.length, 1);
  assert.equal(res[0].touchpoint.id, "t1");
  assert.equal(res[0].credit, 1);
});

test("firstTouchAttribution sorts unsorted input by timestamp", () => {
  const reversed = [...baseTouchpoints].reverse();
  const res = firstTouchAttribution(reversed);
  assert.equal(res.length, 1);
  assert.equal(res[0].touchpoint.id, "t1");
});

test("lastTouchAttribution credits only the latest touchpoint", () => {
  const res = lastTouchAttribution(baseTouchpoints);
  assert.equal(res.length, 1);
  assert.equal(res[0].touchpoint.id, "t3");
  assert.equal(res[0].credit, 1);
});

test("lastTouchAttribution returns empty array for no touchpoints", () => {
  assert.deepEqual(lastTouchAttribution([]), []);
});

test("linearAttribution splits credit equally across touchpoints", () => {
  const res = linearAttribution(baseTouchpoints);
  assert.equal(res.length, 3);
  for (const r of res) {
    assert.ok(Math.abs(r.credit - 1 / 3) < 1e-9);
  }
});

test("linearAttribution credits sum to 1", () => {
  const res = linearAttribution(baseTouchpoints);
  const total = res.reduce((sum, r) => sum + r.credit, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("timeDecayAttribution gives more credit to later touchpoints", () => {
  const res = timeDecayAttribution(baseTouchpoints);
  const credits = res.map((r) => r.credit);
  assert.ok(credits[2] > credits[1]);
  assert.ok(credits[1] > credits[0]);
});

test("timeDecayAttribution credits sum to 1", () => {
  const res = timeDecayAttribution(baseTouchpoints);
  const total = res.reduce((sum, r) => sum + r.credit, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("timeDecayAttribution returns equal credits when all timestamps are equal", () => {
  const tps: Touchpoint[] = [
    { id: "a", channel: "x", timestamp: 5000 },
    { id: "b", channel: "x", timestamp: 5000 },
  ];
  const res = timeDecayAttribution(tps);
  assert.equal(res.length, 2);
  assert.ok(Math.abs(res[0].credit - 0.5) < 1e-9);
  assert.ok(Math.abs(res[1].credit - 0.5) < 1e-9);
});

test("positionBasedAttribution allocates 40/20/40 for three touchpoints", () => {
  const res = positionBasedAttribution(baseTouchpoints);
  assert.equal(res.length, 3);
  assert.ok(Math.abs(res[0].credit - 0.4) < 1e-9);
  assert.ok(Math.abs(res[1].credit - 0.2) < 1e-9);
  assert.ok(Math.abs(res[2].credit - 0.4) < 1e-9);
});

test("positionBasedAttribution splits 50/50 for two touchpoints", () => {
  const tps = baseTouchpoints.slice(0, 2);
  const res = positionBasedAttribution(tps);
  assert.equal(res.length, 2);
  assert.ok(Math.abs(res[0].credit - 0.5) < 1e-9);
  assert.ok(Math.abs(res[1].credit - 0.5) < 1e-9);
});

test("positionBasedAttribution gives 100% credit for a single touchpoint", () => {
  const tps = [baseTouchpoints[0]];
  const res = positionBasedAttribution(tps);
  assert.equal(res.length, 1);
  assert.equal(res[0].credit, 1);
});

test("runAttribution dispatches to the correct model implementation", () => {
  const firstRes = runAttribution("first_touch", baseTouchpoints);
  assert.equal(firstRes.length, 1);
  assert.equal(firstRes[0].touchpoint.id, "t1");

  const linearRes = runAttribution("linear", baseTouchpoints);
  assert.equal(linearRes.length, 3);

  const tdRes = runAttribution("time_decay", baseTouchpoints, { halfLifeDays: 14 });
  assert.equal(tdRes.length, 3);
  assert.ok(tdRes[2].credit > tdRes[0].credit);
});

test("getModelLabel returns human readable labels for every model", () => {
  assert.equal(getModelLabel("first_touch"), "First Touch");
  assert.equal(getModelLabel("last_touch"), "Last Touch");
  assert.equal(getModelLabel("linear"), "Linear");
  assert.equal(getModelLabel("time_decay"), "Time Decay");
  assert.equal(getModelLabel("position_based"), "Position Based (U-Shaped)");
});

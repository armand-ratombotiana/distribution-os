import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateBudget,
  calculateROI,
  getOptimalAllocation,
  type AllocationChannelInput,
} from "../lib/budget-allocation-pure.ts";

const channels: AllocationChannelInput[] = [
  { id: "email", weight: 1, roi: 2.0 },
  { id: "paid_search", weight: 3, roi: 1.5 },
  { id: "social", weight: 1, roi: 0.5 },
];

test("allocateBudget splits totalCents across channels proportionally to weights", () => {
  const summary = allocateBudget(1000, channels, "proportional");
  assert.equal(summary.totalCents, 1000);
  assert.equal(summary.allocations.length, 3);
  // Weights 1/3/1 → total 5 → 200/600/200
  assert.equal(summary.allocations[0].allocatedCents, 200);
  assert.equal(summary.allocations[1].allocatedCents, 600);
  assert.equal(summary.allocations[2].allocatedCents, 200);
});

test("allocateBudget sums exactly to totalCents (no cent lost to rounding)", () => {
  const summary = allocateBudget(999, channels, "proportional");
  const sum = summary.allocations.reduce((s, a) => s + a.allocatedCents, 0);
  assert.equal(sum, 999);
});

test("allocateBudget equal strategy gives every channel the same share", () => {
  const summary = allocateBudget(900, channels, "equal");
  for (const a of summary.allocations) {
    assert.equal(a.allocatedCents, 300);
  }
});

test("allocateBudget roi_weighted strategy weights each channel by weight × ROI", () => {
  // weights × ROI: 1*1=1, 3*1=3 (1.5 capped to 1), 1*0.5=0.5 → total 4.5
  // shares: 1/4.5, 3/4.5, 0.5/4.5
  const summary = allocateBudget(900, channels, "roi_weighted");
  assert.equal(summary.allocations.length, 3);
  const sum = summary.allocations.reduce((s, a) => s + a.allocatedCents, 0);
  assert.equal(sum, 900);
  assert.ok(summary.allocations[1].allocatedCents > summary.allocations[0].allocatedCents);
  assert.ok(summary.allocations[0].allocatedCents > summary.allocations[2].allocatedCents);
});

test("allocateBudget falls back to equal split when all weights are zero", () => {
  const zeroWeight: AllocationChannelInput[] = [
    { id: "a", weight: 0 },
    { id: "b", weight: 0 },
  ];
  const summary = allocateBudget(100, zeroWeight, "proportional");
  assert.equal(summary.allocations[0].allocatedCents, 50);
  assert.equal(summary.allocations[1].allocatedCents, 50);
});

test("allocateBudget reports a per-channel share in [0, 1]", () => {
  const summary = allocateBudget(1000, channels, "proportional");
  for (const a of summary.allocations) {
    assert.ok(a.share >= 0 && a.share <= 1);
  }
  const shareSum = summary.allocations.reduce((s, a) => s + a.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9);
});

test("allocateBudget returns an empty allocations array when totalCents is 0", () => {
  const summary = allocateBudget(0, channels, "proportional");
  assert.equal(summary.totalCents, 0);
  assert.equal(summary.channelCount, 0);
  assert.deepEqual(summary.allocations, []);
});

test("allocateBudget returns an empty allocations array when no channels are provided", () => {
  const summary = allocateBudget(1000, [], "proportional");
  assert.equal(summary.channelCount, 0);
  assert.deepEqual(summary.allocations, []);
});

test("allocateBudget reports channelCount as the number of channels with a non-zero allocation", () => {
  const oneZero: AllocationChannelInput[] = [
    { id: "a", weight: 10 },
    { id: "b", weight: 0 },
  ];
  const summary = allocateBudget(1000, oneZero, "proportional");
  assert.equal(summary.channelCount, 1);
  assert.equal(summary.allocations[0].allocatedCents, 1000);
  assert.equal(summary.allocations[1].allocatedCents, 0);
});

test("calculateROI returns the percentage ROI and 0 for non-positive cost", () => {
  // (1500 - 1000) / 1000 * 100 = 50
  assert.ok(Math.abs(calculateROI(1500, 1000) - 50) < 1e-9);
  // (500 - 1000) / 1000 * 100 = -50
  assert.ok(Math.abs(calculateROI(500, 1000) - (-50)) < 1e-9);
  assert.equal(calculateROI(1000, 0), 0);
  assert.equal(calculateROI(1000, -5), 0);
});

test("getOptimalAllocation picks the strategy that maximises total expected revenue", () => {
  // Channels: email (w=1, roi=2.0), paid_search (w=3, roi=1.5), social (w=1, roi=0.5)
  // With 1000 cents:
  //   proportional (1/3/1 → 200/600/200): rev = 200*2 + 600*1.5 + 200*0.5 = 400+900+100 = 1400
  //   equal (333/333/334): rev = 333*2 + 333*1.5 + 334*0.5 = 666+499.5+167 = 1332.5
  //   roi_weighted (1*1=1, 3*1=3, 1*0.5=0.5 → total 4.5): 1000*(1/4.5) + 1000*(3/4.5) + 1000*(0.5/4.5)
  //     ≈ 222.22 + 666.67 + 111.11 → floored, sum must equal 1000
  //     rev = 222*2 + 666*1.5 + 112*0.5 (approx) ≈ 444 + 999 + 56 ≈ 1499
  // → roi_weighted should win
  const optimal = getOptimalAllocation(1000, channels);
  assert.equal(optimal.strategy, "roi_weighted");
  const sum = optimal.allocations.reduce((s, a) => s + a.allocatedCents, 0);
  assert.equal(sum, 1000);
});

test("getOptimalAllocation still works when no channel reports a ROI", () => {
  const noRoi: AllocationChannelInput[] = [
    { id: "a", weight: 1 },
    { id: "b", weight: 2 },
  ];
  const optimal = getOptimalAllocation(300, noRoi);
  // All strategies tie at zero revenue; the function still returns a valid split.
  assert.equal(optimal.allocations.length, 2);
  const sum = optimal.allocations.reduce((s, a) => s + a.allocatedCents, 0);
  assert.equal(sum, 300);
});

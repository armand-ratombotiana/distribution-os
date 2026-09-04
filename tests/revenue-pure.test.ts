import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMRR,
  getChurnRate,
  projectRevenue,
  type RevenueModel,
  type CohortSnapshot,
} from "../lib/revenue-pure.ts";

const model: RevenueModel = {
  id: "m1",
  plans: [
    { id: "pro", price: 50, interval: "monthly", customers: 100 },
    { id: "enterprise", price: 12_000, interval: "annual", customers: 5 },
  ],
  expansionRate: 0.02,
  churnRate: 0.05,
};

test("calculateMRR sums monthly plans at face value and annual plans divided by 12", () => {
  // pro: 50 × 100 = 5000 ; enterprise: 12000 / 12 × 5 = 5000 → total 10000
  assert.ok(Math.abs(calculateMRR(model) - 10_000) < 1e-9);
});

test("calculateMRR returns 0 for an empty plan list and invalid input", () => {
  assert.equal(calculateMRR({ ...model, plans: [] }), 0);
  assert.equal(calculateMRR(null as unknown as RevenueModel), 0);
  assert.equal(calculateMRR({ ...model, plans: "nope" as unknown as RevenueModel["plans"] }), 0);
});

test("calculateMRR clamps negative prices and customer counts to 0", () => {
  const m: RevenueModel = {
    ...model,
    plans: [
      { id: "neg-price", price: -10, interval: "monthly", customers: 10 },
      { id: "neg-cust", price: 10, interval: "monthly", customers: -5 },
    ],
  };
  assert.equal(calculateMRR(m), 0);
});

test("getChurnRate averages period churn rates across snapshots", () => {
  // period 0: 100 active; period 1: churned 5 → 0.05; period 2: churned 4 (of 95) → 0.0421...
  const snaps: CohortSnapshot[] = [
    { periodIndex: 0, activeCustomers: 100, churned: 0 },
    { periodIndex: 1, activeCustomers: 95, churned: 5 },
    { periodIndex: 2, activeCustomers: 91, churned: 4 },
  ];
  // rates = [5/100, 4/95] = [0.05, 0.042105263] → mean ≈ 0.04605263
  const r = getChurnRate(snaps);
  assert.ok(Math.abs(r - 0.04605263) < 1e-6);
});

test("getChurnRate returns 0 for fewer than 2 snapshots or invalid input", () => {
  assert.equal(getChurnRate([]), 0);
  assert.equal(getChurnRate([{ periodIndex: 0, activeCustomers: 100, churned: 5 }]), 0);
  assert.equal(getChurnRate(null as unknown as CohortSnapshot[]), 0);
});

test("getChurnRate sorts snapshots by periodIndex before computing", () => {
  const unsorted: CohortSnapshot[] = [
    { periodIndex: 2, activeCustomers: 91, churned: 4 },
    { periodIndex: 0, activeCustomers: 100, churned: 0 },
    { periodIndex: 1, activeCustomers: 95, churned: 5 },
  ];
  // same as the ordered test above
  assert.ok(Math.abs(getChurnRate(unsorted) - 0.04605263) < 1e-6);
});

test("getChurnRate skips periods with non-positive prior active count", () => {
  const snaps: CohortSnapshot[] = [
    { periodIndex: 0, activeCustomers: 0, churned: 0 },
    { periodIndex: 1, activeCustomers: 100, churned: 5 },
    { periodIndex: 2, activeCustomers: 95, churned: 4 },
  ];
  // period 1 churned/0 → skipped; period 2 churned/100 = 0.04
  assert.ok(Math.abs(getChurnRate(snaps) - 0.04) < 1e-9);
});

test("projectRevenue returns month 0 = current MRR and projects forward with expansion × (1 - churn)", () => {
  // starting MRR = 10000; factor = 1.02 × 0.95 = 0.969
  const proj = projectRevenue(model, 3);
  assert.equal(proj.length, 4);
  assert.ok(Math.abs(proj[0].mrr - 10_000) < 1e-9);
  assert.ok(Math.abs(proj[1].mrr - 9_690) < 1e-6);
  assert.ok(Math.abs(proj[2].mrr - 9_389.61) < 1e-3);
  assert.ok(Math.abs(proj[3].mrr - 9_098.5321) < 1e-2);
});

test("projectRevenue returns an empty array for invalid input or negative months", () => {
  assert.deepEqual(projectRevenue(null as unknown as RevenueModel, 12), []);
  assert.deepEqual(projectRevenue(model, -1), []);
  assert.deepEqual(projectRevenue(model, NaN), []);
});

test("projectRevenue clamps churn to [0, 1] and tolerates negative expansion", () => {
  // churn > 1 → clamps to 1 → factor = 1.02 × 0 = 0 → month 1 = 0
  const shrunk: RevenueModel = {
    ...model,
    plans: [{ id: "p", price: 10, interval: "monthly", customers: 1 }],
    expansionRate: 0.02,
    churnRate: 2,
  };
  const proj = projectRevenue(shrunk, 2);
  assert.equal(proj[1].mrr, 0);
  assert.equal(proj[2].mrr, 0);

  // negative expansion (contraction)
  const contracted: RevenueModel = {
    ...model,
    plans: [{ id: "p", price: 10, interval: "monthly", customers: 1 }],
    expansionRate: -0.5,
    churnRate: 0,
  };
  const proj2 = projectRevenue(contracted, 1);
  // MRR = 10; factor = 0.5 → 5
  assert.ok(Math.abs(proj2[1].mrr - 5) < 1e-9);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  getCohortSize,
  calculateRetention,
  calculateChurn,
  calculateRetentionCurve,
  calculateAverageRetention,
  calculateCohortLTV,
  type Cohort,
} from "../lib/cohort-pure.ts";

const cohort: Cohort = {
  id: "2024-01",
  initialSize: 1000,
  retention: [800, 600, 450, 360],
};

test("getCohortSize returns the floor of initialSize and 0 for invalid input", () => {
  assert.equal(getCohortSize(cohort), 1000);
  assert.equal(getCohortSize({ id: "x", initialSize: 99.9, retention: [] }), 99);
  assert.equal(getCohortSize({ id: "x", initialSize: -5, retention: [] }), 0);
  assert.equal(getCohortSize(null as unknown as Cohort), 0);
});

test("calculateRetention returns 1 at period 0", () => {
  assert.equal(calculateRetention(cohort, 0), 1);
});

test("calculateRetention computes active/initial for each period", () => {
  assert.ok(Math.abs(calculateRetention(cohort, 1) - 0.8) < 1e-9);
  assert.ok(Math.abs(calculateRetention(cohort, 2) - 0.6) < 1e-9);
  assert.ok(Math.abs(calculateRetention(cohort, 4) - 0.36) < 1e-9);
});

test("calculateRetention returns 0 for out-of-range or invalid periods", () => {
  assert.equal(calculateRetention(cohort, 5), 0);
  assert.equal(calculateRetention(cohort, -1), 0);
  assert.equal(calculateRetention(cohort, NaN), 0);
});

test("calculateRetention returns 0 when initialSize is non-positive", () => {
  const empty: Cohort = { id: "x", initialSize: 0, retention: [10] };
  assert.equal(calculateRetention(empty, 1), 0);
});

test("calculateRetention caps result at 1 when activeUsers exceeds initialSize", () => {
  const leaky: Cohort = { id: "x", initialSize: 100, retention: [150] };
  assert.equal(calculateRetention(leaky, 1), 1);
});

test("calculateChurn is the complement of retention", () => {
  assert.equal(calculateChurn(cohort, 0), 0);
  assert.ok(Math.abs(calculateChurn(cohort, 1) - 0.2) < 1e-9);
  assert.ok(Math.abs(calculateChurn(cohort, 4) - 0.64) < 1e-9);
});

test("calculateRetentionCurve returns one entry per recorded period plus period 0", () => {
  const curve = calculateRetentionCurve(cohort);
  assert.equal(curve.length, 5);
  assert.equal(curve[0], 1);
  assert.ok(Math.abs(curve[1] - 0.8) < 1e-9);
  assert.ok(Math.abs(curve[4] - 0.36) < 1e-9);
});

test("calculateAverageRetention averages the per-period retention rates", () => {
  // (0.8 + 0.6 + 0.45 + 0.36) / 4 == 0.5525
  assert.ok(Math.abs(calculateAverageRetention(cohort) - 0.5525) < 1e-9);
  assert.equal(calculateAverageRetention({ id: "x", initialSize: 100, retention: [] }), 0);
});

test("calculateCohortLTV multiplies size, average retention, and revenue per user", () => {
  // 1000 * 0.5525 * 5 = 2762.5
  assert.ok(Math.abs(calculateCohortLTV(cohort, 5) - 2762.5) < 1e-9);
  assert.equal(calculateCohortLTV(cohort, -1), 0);
});

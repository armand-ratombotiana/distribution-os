import assert from "node:assert/strict";
import { test } from "node:test";

import {
  aggregate,
  calculatePercentile,
  getSummary,
  mergeAggregates,
  type MetricAggregate,
} from "../lib/metrics-aggregator-pure.ts";

test("aggregate returns a zero-state result for an empty sample list", () => {
  const r = aggregate("latency", []);
  assert.equal(r.count, 0);
  assert.equal(r.sum, 0);
  assert.equal(r.min, 0);
  assert.equal(r.max, 0);
  assert.equal(r.mean, 0);
  assert.equal(r.median, 0);
  assert.equal(r.stdDev, 0);
});

test("aggregate computes count, sum, min, max, mean for a simple list", () => {
  const r = aggregate("size", [10, 20, 30, 40]);
  assert.equal(r.count, 4);
  assert.equal(r.sum, 100);
  assert.equal(r.min, 10);
  assert.equal(r.max, 40);
  assert.equal(r.mean, 25);
});

test("aggregate computes median for odd and even sample counts", () => {
  // Nearest-rank p=50: rank = ceil(0.5 * N), idx = rank - 1.
  const odd = aggregate("x", [1, 3, 5]);
  // rank = ceil(1.5) = 2, idx = 1 → 3
  assert.equal(odd.median, 3);
  const even = aggregate("x", [1, 2, 3, 4]);
  // rank = ceil(2) = 2, idx = 1 → 2
  assert.equal(even.median, 2);
});

test("aggregate computes population standard deviation", () => {
  // samples: 2, 4, 4, 4, 5, 5, 7, 9 → variance=4, stdDev=2
  const r = aggregate("x", [2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(r.stdDev, 2);
});

test("aggregate computes single-sample statistics (stdDev=0)", () => {
  const r = aggregate("x", [42]);
  assert.equal(r.count, 1);
  assert.equal(r.min, 42);
  assert.equal(r.max, 42);
  assert.equal(r.mean, 42);
  assert.equal(r.median, 42);
  assert.equal(r.stdDev, 0);
});

test("aggregate pre-computes requested percentiles", () => {
  const r = aggregate("latency", [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], {
    percentiles: [50, 95, 99],
  });
  assert.equal(r.percentiles[50], 50);
  assert.equal(r.percentiles[95], 100);
  assert.equal(r.percentiles[99], 100);
});

test("calculatePercentile uses nearest-rank interpolation", () => {
  const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(calculatePercentile(samples, 0), 1);
  assert.equal(calculatePercentile(samples, 50), 5);
  assert.equal(calculatePercentile(samples, 90), 9);
  assert.equal(calculatePercentile(samples, 100), 10);
});

test("calculatePercentile handles empty samples, out-of-range p, and unsorted input", () => {
  assert.equal(calculatePercentile([], 50), 0);
  const samples = [10, 20, 30];
  assert.equal(calculatePercentile(samples, -10), 10);
  assert.equal(calculatePercentile(samples, 200), 30);
  const unsorted = [30, 10, 20, 50, 40];
  assert.equal(calculatePercentile(unsorted, 50), 30);
  assert.equal(calculatePercentile(unsorted, 100), 50);
});

test("getSummary returns a compact human-readable string", () => {
  const r = aggregate("latency", [10, 20, 30], { percentiles: [50, 95] });
  const summary = getSummary(r);
  assert.match(summary, /^latency n=3/);
  assert.ok(summary.includes("min=10"));
  assert.ok(summary.includes("max=30"));
  assert.ok(summary.includes("mean=20"));
  assert.ok(summary.includes("p50=20"));
  assert.ok(summary.includes("p95=30"));
});

test("getSummary emits just name and n=0 for empty aggregates", () => {
  const r = aggregate("latency", []);
  assert.equal(getSummary(r), "latency n=0");
});

test("mergeAggregates combines counts, sums, mins, and maxes", () => {
  const a = aggregate("x", [1, 2, 3]);
  const b = aggregate("x", [4, 5, 6]);
  const merged = mergeAggregates("x", a, b);
  assert.equal(merged.count, 6);
  assert.equal(merged.sum, 21);
  assert.equal(merged.min, 1);
  assert.equal(merged.max, 6);
  assert.equal(merged.mean, 3.5);
});

test("mergeAggregates handles empty aggregates on either side", () => {
  const empty: MetricAggregate = aggregate("x", []);
  const nonEmpty = aggregate("x", [1, 2, 3]);
  const m1 = mergeAggregates("x", empty, nonEmpty);
  assert.equal(m1.count, 3);
  assert.equal(m1.sum, 6);
  assert.equal(m1.min, 1);
  assert.equal(m1.max, 3);
  const m2 = mergeAggregates("x", nonEmpty, empty);
  assert.equal(m2.count, 3);
  const m3 = mergeAggregates("x", empty, empty);
  assert.equal(m3.count, 0);
  assert.equal(m3.sum, 0);
});

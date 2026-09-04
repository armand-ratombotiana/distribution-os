import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeGap,
  calculateThreat,
  getDifferentiation,
  type Competitor,
  type OurFirm,
} from "../lib/competitor-pure.ts";

const us: OurFirm = {
  id: "us",
  name: "Acme",
  features: ["alpha", "beta", "gamma"],
  pricing: "low",
};

const competitor: Competitor = {
  id: "comp",
  name: "BigCo",
  marketShare: 35,
  growthRate: 12,
  features: ["beta", "delta", "epsilon"],
  pricing: "high",
  brandStrength: 0.6,
};

test("analyzeGap splits features into competitorOnly, ourOnly, and shared buckets", () => {
  const gap = analyzeGap(us, competitor);
  assert.deepEqual(gap.competitorOnly.sort(), ["delta", "epsilon"]);
  assert.deepEqual(gap.ourOnly.sort(), ["alpha", "gamma"]);
  assert.deepEqual(gap.shared, ["beta"]);
});

test("analyzeGap returns empty buckets for missing input and handles non-array features defensively", () => {
  const empty = { competitorOnly: [], ourOnly: [], shared: [] };
  assert.deepEqual(analyzeGap(null as unknown as OurFirm, competitor), empty);
  assert.deepEqual(analyzeGap(us, null as unknown as Competitor), empty);

  // non-array features coerced to []
  const gap = analyzeGap(
    { ...us, features: "not-an-array" as unknown as string[] },
    competitor,
  );
  assert.deepEqual(gap.ourOnly, []);
  assert.deepEqual(gap.competitorOnly.sort(), ["beta", "delta", "epsilon"]);
  assert.deepEqual(gap.shared, []);
});

test("calculateThreat weights market share, growth, brand, and overlap", () => {
  // share=35 (×0.4 = 14), growth=12 (×0.3 = 3.6), brand=0.6 (×0.2×100 = 12),
  // overlap = 1/3 → ×0.1×100 = 3.333... → total ≈ 32.933
  const t = calculateThreat(competitor, us);
  assert.ok(Math.abs(t - 32.933333) < 1e-4);
});

test("calculateThreat clamps share to [0, 100] and growth to [0, 50]", () => {
  const huge: Competitor = {
    ...competitor,
    marketShare: 500,
    growthRate: 999,
  };
  // share=100 (×0.4 = 40), growth=50 (×0.3 = 15), brand=0.6 (×0.2×100 = 12), overlap=1/3 (×0.1×100 ≈ 3.33)
  // total ≈ 70.333
  const t = calculateThreat(huge, us);
  assert.ok(Math.abs(t - 70.333333) < 1e-4);
});

test("calculateThreat defaults brandStrength to 0.5 when undefined", () => {
  const t = calculateThreat({ ...competitor, brandStrength: undefined }, us);
  // brand=0.5 → ×0.2×100 = 10; total = 14 + 3.6 + 10 + 3.333 ≈ 30.933
  assert.ok(Math.abs(t - 30.933333) < 1e-4);
});

test("calculateThreat returns 0 for invalid input and treats overlap as 1 without us", () => {
  assert.equal(calculateThreat(null as unknown as Competitor, us), 0);
  // without `us`, overlap defaults to 1 → ×0.1×100 = 10
  const t = calculateThreat(competitor);
  // share=35 (×0.4 = 14), growth=12 (×0.3 = 3.6), brand=0.6 (×0.2×100 = 12), overlap=1 (×0.1×100 = 10)
  // total = 39.6
  assert.ok(Math.abs(t - 39.6) < 1e-9);
});

test("calculateThreat clamps the final score to [0, 100]", () => {
  const max: Competitor = {
    id: "x",
    name: "X",
    marketShare: 100,
    growthRate: 50,
    features: [],
    pricing: "free",
    brandStrength: 1,
  };
  // 0.4×100 + 0.3×50 + 0.2×100 + 0.1×100 = 40 + 15 + 20 + 10 = 85
  assert.ok(Math.abs(calculateThreat(max, { ...us, features: [] }) - 85) < 1e-9);
});

test("getDifferentiation produces a price message when our tier is strictly lower", () => {
  const diffs = getDifferentiation(us, competitor);
  assert.ok(diffs.some((d) => d.kind === "price" && d.message.includes("More affordable")));
  assert.ok(diffs.some((d) => d.kind === "feature" && d.message.includes("alpha")));
  assert.ok(diffs.some((d) => d.kind === "feature" && d.message.includes("gamma")));
});

test("getDifferentiation omits the price message when our tier is equal or higher", () => {
  const diffs = getDifferentiation(
    { ...us, pricing: "high" },
    { ...competitor, pricing: "high" },
  );
  assert.equal(diffs.some((d) => d.kind === "price"), false);
  // still produces feature diffs for alpha and gamma
  assert.ok(diffs.some((d) => d.kind === "feature"));
});

test("getDifferentiation returns an empty array when there is no advantage", () => {
  // competitor has every feature we have, and equal pricing
  const dominant: Competitor = {
    ...competitor,
    features: ["alpha", "beta", "gamma", "delta"],
    pricing: "low",
  };
  assert.deepEqual(getDifferentiation(us, dominant), []);
  // bad input
  assert.deepEqual(getDifferentiation(null as unknown as OurFirm, competitor), []);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMarketSize,
  getTrendDirection,
  assessDemand,
  type MarketData,
} from "../lib/market-research-pure.ts";

const data: MarketData = {
  tam: 1000,
  sam: 500,
  som: 100,
  dataPoints: [
    { period: "2024-01", value: 100 },
    { period: "2024-02", value: 110 },
    { period: "2024-03", value: 125 },
  ],
  searchVolume: 0.7,
  competition: 0.4,
};

test("calculateMarketSize sums TAM + SAM + SOM", () => {
  assert.equal(calculateMarketSize(data), 1600);
});

test("calculateMarketSize clamps negative components to 0 and returns 0 for invalid input", () => {
  assert.equal(
    calculateMarketSize({ ...data, tam: -100, sam: -50, som: 25 }),
    25,
  );
  assert.equal(calculateMarketSize(null as unknown as MarketData), 0);
});

test("getTrendDirection returns 'up' when last value is more than 1% above first", () => {
  assert.equal(getTrendDirection(data), "up");
});

test("getTrendDirection returns 'down' when last value is more than 1% below first", () => {
  const down: MarketData = {
    ...data,
    dataPoints: [
      { period: "a", value: 100 },
      { period: "b", value: 90 },
    ],
  };
  assert.equal(getTrendDirection(down), "down");
});

test("getTrendDirection returns 'flat' for < 2 points or small delta", () => {
  assert.equal(
    getTrendDirection({ ...data, dataPoints: [{ period: "a", value: 100 }] }),
    "flat",
  );
  assert.equal(
    getTrendDirection({
      ...data,
      dataPoints: [
        { period: "a", value: 100 },
        { period: "b", value: 100.5 },
      ],
    }),
    "flat",
  );
  assert.equal(getTrendDirection(null as unknown as MarketData), "flat");
});

test("getTrendDirection handles a zero first value (last>0 → up, last<0 → down, else flat)", () => {
  assert.equal(
    getTrendDirection({
      ...data,
      dataPoints: [
        { period: "a", value: 0 },
        { period: "b", value: 5 },
      ],
    }),
    "up",
  );
  assert.equal(
    getTrendDirection({
      ...data,
      dataPoints: [
        { period: "a", value: 0 },
        { period: "b", value: 0 },
      ],
    }),
    "flat",
  );
});

test("assessDemand computes the composite demand score and grade", () => {
  // growth = (125-100)/100 × 100 = 25 → ×0.4 = 10
  // search = 0.7 × 100 = 70 → ×0.3 = 21
  // competition = 0.4 → (1-0.4) × 100 = 60 → ×0.3 = 18
  // total = 10 + 21 + 18 = 49 → grade C
  const a = assessDemand(data);
  assert.ok(Math.abs(a.score - 49) < 1e-9);
  assert.equal(a.grade, "C");
});

test("assessDemand clamps growth to [0, 100] and handles defaults for missing signals", () => {
  // searchVolume & competition default to 0.5 each; growth is 25%
  // 0.4×25 + 0.3×50 + 0.3×50 = 10 + 15 + 15 = 40 → grade C
  const a = assessDemand({
    tam: 0,
    sam: 0,
    som: 0,
    dataPoints: [
      { period: "a", value: 100 },
      { period: "b", value: 125 },
    ],
  });
  assert.ok(Math.abs(a.score - 40) < 1e-9);
  assert.equal(a.grade, "C");
});

test("assessDemand grades A (80+), B (60–79), C (40–59), D (<40)", () => {
  const a: MarketData = {
    tam: 0, sam: 0, som: 0,
    dataPoints: [{ period: "a", value: 100 }, { period: "b", value: 1000 }], // 900% growth clamped to 100
    searchVolume: 1, competition: 0,
  };
  // 0.4×100 + 0.3×100 + 0.3×100 = 100 → grade A
  assert.equal(assessDemand(a).grade, "A");

  const b: MarketData = { ...a, searchVolume: 0.5, competition: 0.5 };
  // 0.4×100 + 0.3×50 + 0.3×50 = 70 → grade B
  assert.equal(assessDemand(b).grade, "B");

  const d: MarketData = {
    tam: 0, sam: 0, som: 0,
    dataPoints: [{ period: "a", value: 100 }, { period: "b", value: 50 }], // negative growth → 0
    searchVolume: 0, competition: 1,
  };
  // 0.4×0 + 0.3×0 + 0.3×0 = 0 → grade D
  assert.equal(assessDemand(d).grade, "D");
});

test("assessDemand returns score 0 / grade D for invalid input", () => {
  const a = assessDemand(null as unknown as MarketData);
  assert.equal(a.score, 0);
  assert.equal(a.grade, "D");
});

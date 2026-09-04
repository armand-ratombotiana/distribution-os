import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScore,
  getGrade,
  getPriority,
  type LeadScoreInput,
} from "../lib/lead-scoring-pure.ts";

test("calculateScore sums weight*value across attributes and clamps to [0, 100]", () => {
  const input: LeadScoreInput = {
    leadId: "L1",
    attributes: [
      { name: "company_size", value: 10, weight: 3 },
      { name: "engagement", value: 5, weight: 4 },
    ],
  };
  // 10*3 + 5*4 = 30 + 20 = 50
  const res = calculateScore(input);
  assert.equal(res.score, 50);
  assert.equal(res.leadId, "L1");
  assert.deepEqual(res.contributions.map((c) => c.name), ["company_size", "engagement"]);
});

test("calculateScore adds a positive bonus to the total", () => {
  const input: LeadScoreInput = {
    leadId: "L2",
    attributes: [{ name: "x", value: 5, weight: 2 }],
    bonus: 10,
  };
  // 5*2 + 10 = 20
  assert.equal(calculateScore(input).score, 20);
});

test("calculateScore ignores a negative bonus", () => {
  const input: LeadScoreInput = {
    leadId: "L3",
    attributes: [{ name: "x", value: 5, weight: 2 }],
    bonus: -100,
  };
  // 5*2 + 0 = 10 (negative bonus dropped)
  assert.equal(calculateScore(input).score, 10);
});

test("calculateScore clamps a too-large total at 100", () => {
  const input: LeadScoreInput = {
    leadId: "L4",
    attributes: [{ name: "x", value: 50, weight: 10 }],
  };
  // 500 → clamped to 100
  assert.equal(calculateScore(input).score, 100);
});

test("calculateScore applies each attribute's cap before summing", () => {
  const input: LeadScoreInput = {
    leadId: "L5",
    attributes: [
      { name: "x", value: 10, weight: 10, cap: 25 },
      { name: "y", value: 1, weight: 5 },
    ],
  };
  // min(100, 25) + 5 = 30
  assert.equal(calculateScore(input).score, 30);
});

test("calculateScore handles invalid inputs without throwing", () => {
  const res = calculateScore(null as unknown as LeadScoreInput);
  assert.equal(res.score, 0);
  assert.equal(res.grade, "D");
  assert.equal(res.priority, "low");
  assert.deepEqual(res.contributions, []);
});

test("calculateScore treats NaN weights/values as 0", () => {
  const input: LeadScoreInput = {
    leadId: "L6",
    attributes: [
      { name: "x", value: NaN, weight: 10 },
      { name: "y", value: 5, weight: NaN },
      { name: "z", value: 5, weight: 2 },
    ],
  };
  // 0 + 0 + 10 = 10
  assert.equal(calculateScore(input).score, 10);
});

test("getGrade maps score thresholds to A/B/C/D and treats invalid input as D", () => {
  assert.equal(getGrade(95), "A");
  assert.equal(getGrade(80), "A");
  assert.equal(getGrade(79.999), "B");
  assert.equal(getGrade(60), "B");
  assert.equal(getGrade(59), "C");
  assert.equal(getGrade(40), "C");
  assert.equal(getGrade(39), "D");
  assert.equal(getGrade(0), "D");
  assert.equal(getGrade(NaN), "D");
  assert.equal(getGrade(-5), "D");
});

test("getPriority maps grades to high/medium/low", () => {
  assert.equal(getPriority("A"), "high");
  assert.equal(getPriority("B"), "high");
  assert.equal(getPriority("C"), "medium");
  assert.equal(getPriority("D"), "low");
});

test("getPriority accepts a numeric score and converts via getGrade", () => {
  assert.equal(getPriority(90), "high");
  assert.equal(getPriority(50), "medium");
  assert.equal(getPriority(10), "low");
});

test("calculateScore returns a grade and priority consistent with the score", () => {
  const input: LeadScoreInput = {
    leadId: "L7",
    attributes: [{ name: "x", value: 9, weight: 10 }], // 90
  };
  const res = calculateScore(input);
  assert.equal(res.score, 90);
  assert.equal(res.grade, "A");
  assert.equal(res.priority, "high");
});

test("calculateScore returns a low priority for a low score", () => {
  const input: LeadScoreInput = {
    leadId: "L8",
    attributes: [{ name: "x", value: 1, weight: 1 }], // 1
  };
  const res = calculateScore(input);
  assert.equal(res.grade, "D");
  assert.equal(res.priority, "low");
});

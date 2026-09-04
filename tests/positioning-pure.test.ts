import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePromise,
  getDifferentiation,
  validatePositioning,
  type Positioning,
} from "../lib/positioning-pure.ts";

const positioning: Positioning = {
  id: "p1",
  promise: "Cut onboarding time in half",
  audience: "SaaS founders",
  category: "AI Onboarding",
  evidence: [
    { id: "case-acme", strength: 0.9, verified: true },
    { id: "poll-2024", strength: 0.6, verified: true },
    { id: "anecdote", strength: 0.4, verified: false },
  ],
  differentiators: [
    "5-min setup vs. competitors' 1 hour",
    "No-code workflow builder",
    "Native Slack integration",
  ],
  risks: ["dependency on OpenAI API"],
};

test("evaluatePromise returns 100 when evidence, differentiators, and risk-adj are maxed", () => {
  const p: Positioning = {
    ...positioning,
    evidence: [{ id: "e1", strength: 1, verified: true }],
    differentiators: ["a", "b", "c", "d", "e"],
    risks: [],
  };
  // 0.6×100 + 0.3×100 + 0.1×100 = 100
  assert.equal(evaluatePromise(p).score, 100);
});

test("evaluatePromise averages only verified evidence for the strength term", () => {
  // verified = [0.9, 0.6] → avg = 0.75 → ×0.6×100 = 45
  // differentiators = 3 → 3/5 × 0.3 × 100 = 18
  // risks = 1 → riskAdj = 9/10 × 0.1 × 100 = 9
  // total = 45 + 18 + 9 = 72
  const r = evaluatePromise(positioning);
  assert.ok(Math.abs(r.score - 72) < 1e-9);
});

test("evaluatePromise caps the differentiator term at 5 items", () => {
  const many: Positioning = {
    ...positioning,
    differentiators: ["a", "b", "c", "d", "e", "f", "g"],
    risks: [],
  };
  // 0.6×75 + 0.3×100 + 0.1×100 = 45 + 30 + 10 = 85
  assert.ok(Math.abs(evaluatePromise(many).score - 85) < 1e-9);
});

test("evaluatePromise reports gaps when evidence or differentiators are missing", () => {
  const r = evaluatePromise({
    ...positioning,
    evidence: [],
    differentiators: [],
  });
  assert.ok(r.gaps.some((g) => g.includes("no supporting evidence")));
  assert.ok(r.gaps.some((g) => g.includes("no verified evidence")));
  assert.ok(r.gaps.some((g) => g.includes("no differentiators listed")));
});

test("evaluatePromise returns score 0 with a missing gap for invalid input", () => {
  const r = evaluatePromise(null as unknown as Positioning);
  assert.equal(r.score, 0);
  assert.deepEqual(r.gaps, ["positioning is missing"]);
});

test("evaluatePromise penalises risk count via the risk-adjustment term", () => {
  // 11 risks → riskAdj clamps to 0
  const heavy: Positioning = {
    ...positioning,
    risks: Array.from({ length: 11 }, (_, i) => `risk-${i}`),
  };
  // verified avg 0.75 × 0.6 × 100 = 45; diffs 3/5 × 0.3 × 100 = 18; riskAdj 0 × 0.1 × 100 = 0
  assert.ok(Math.abs(evaluatePromise(heavy).score - 63) < 1e-9);
});

test("getDifferentiation returns the differentiator strings, filtered for non-empty", () => {
  assert.deepEqual(
    getDifferentiation({ ...positioning, differentiators: ["a", "", "  ", "b"] }),
    ["a", "b"],
  );
  assert.deepEqual(getDifferentiation({ ...positioning, differentiators: [] }), []);
  assert.deepEqual(getDifferentiation(null as unknown as Positioning), []);
});

test("validatePositioning accepts a well-formed record", () => {
  const res = validatePositioning(positioning);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, []);
});

test("validatePositioning flags empty id/promise/audience/category and non-array evidence/differentiators", () => {
  const res = validatePositioning({
    id: "",
    promise: "",
    audience: "",
    category: "",
    evidence: "nope" as unknown as Positioning["evidence"],
    differentiators: "nope" as unknown as string[],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("id must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("promise must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("audience must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("category must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("evidence must be an array")));
  assert.ok(res.errors.some((e) => e.includes("differentiators must be an array")));
});

test("validatePositioning flags malformed evidence items, risks, and non-object input", () => {
  const res = validatePositioning({
    id: "x",
    promise: "p",
    audience: "a",
    category: "c",
    evidence: [
      { id: "", strength: 1.5 }, // bad id and out-of-range strength
      "not-an-object" as unknown as Positioning["evidence"][number],
    ],
    differentiators: ["ok", ""],
    risks: ["ok", 123] as unknown as string[],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("evidence[0].id must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("evidence[0].strength must be a number in [0, 1]")));
  assert.ok(res.errors.some((e) => e.includes("evidence[1] must be an object")));
  assert.ok(res.errors.some((e) => e.includes("differentiators[1] must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("risks[1] must be a string")));

  const nonObject = validatePositioning(null as unknown as Positioning);
  assert.equal(nonObject.valid, false);
  assert.ok(nonObject.errors.some((e) => e.includes("positioning must be an object")));
});

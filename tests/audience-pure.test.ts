import assert from "node:assert/strict";
import test from "node:test";

import {
  matchSegment,
  matchFilter,
  calculateReach,
  prioritizeSegments,
  getTopSegment,
  type AudienceSegment,
} from "../lib/audience-pure.ts";

const seg: AudienceSegment = {
  id: "s1",
  name: "Enterprise SaaS",
  filters: [
    { field: "company.size", op: "gte", value: 500 },
    { field: "company.industry", op: "in", value: ["saas", "fintech"] },
  ],
  size: 1200,
  population: 10000,
  intentWeight: 0.8,
};

test("matchSegment returns true when every filter passes (AND semantics)", () => {
  assert.equal(
    matchSegment(seg, { company: { size: 750, industry: "saas" } }),
    true,
  );
});

test("matchSegment returns false when any filter fails", () => {
  assert.equal(
    matchSegment(seg, { company: { size: 100, industry: "saas" } }),
    false,
  );
  assert.equal(
    matchSegment(seg, { company: { size: 750, industry: "retail" } }),
    false,
  );
});

test("matchSegment matches every contact for a segment with no filters", () => {
  const empty: AudienceSegment = { id: "x", name: "x", filters: [], size: 0, population: 0 };
  assert.equal(matchSegment(empty, { anything: true }), true);
});

test("matchFilter handles eq, neq, gt, gte, lt, lte, in, not_in, and contains", () => {
  const contact = { a: 5, b: "hello world", c: "x" };
  assert.equal(matchFilter({ field: "a", op: "eq", value: 5 }, contact), true);
  assert.equal(matchFilter({ field: "a", op: "neq", value: 6 }, contact), true);
  assert.equal(matchFilter({ field: "a", op: "gt", value: 4 }, contact), true);
  assert.equal(matchFilter({ field: "a", op: "gte", value: 5 }, contact), true);
  assert.equal(matchFilter({ field: "a", op: "lt", value: 6 }, contact), true);
  assert.equal(matchFilter({ field: "a", op: "lte", value: 5 }, contact), true);
  assert.equal(matchFilter({ field: "c", op: "in", value: ["x", "y"] }, contact), true);
  assert.equal(matchFilter({ field: "c", op: "not_in", value: ["y", "z"] }, contact), true);
  assert.equal(matchFilter({ field: "b", op: "contains", value: "world" }, contact), true);
});

test("matchFilter returns false for unknown operators and bad inputs", () => {
  assert.equal(matchFilter({ field: "a", op: "weird" as never, value: 1 }, { a: 1 }), false);
  assert.equal(matchFilter(null as never, { a: 1 }), false);
  // numeric ops on strings coerce via Number(); "5" → 5
  assert.equal(matchFilter({ field: "a", op: "gt", value: 4 }, { a: "5" }), true);
  // numeric op against non-numeric actual returns false
  assert.equal(matchFilter({ field: "a", op: "gt", value: 4 }, { a: "abc" }), false);
});

test("calculateReach returns size/population clamped to [0, 1]", () => {
  assert.ok(Math.abs(calculateReach(seg) - 0.12) < 1e-9);
  assert.equal(calculateReach({ ...seg, size: 20000, population: 10000 }), 1);
  assert.equal(calculateReach({ ...seg, size: 0, population: 10000 }), 0);
  assert.equal(calculateReach({ ...seg, size: -5, population: 10000 }), 0);
  assert.equal(calculateReach({ ...seg, size: 5, population: 0 }), 0);
  assert.equal(calculateReach(null as unknown as AudienceSegment), 0);
});

test("prioritizeSegments ranks by size × intentWeight × reach, descending, and returns [] for empty input", () => {
  const segments: AudienceSegment[] = [
    { id: "a", name: "a", filters: [], size: 100, population: 1000, intentWeight: 0.5 },   // 100*0.5*0.1 = 5
    { id: "b", name: "b", filters: [], size: 200, population: 1000, intentWeight: 0.9 },   // 200*0.9*0.2 = 36
    { id: "c", name: "c", filters: [], size: 1000, population: 1000, intentWeight: 0.1 },  // 1000*0.1*1 = 100
  ];
  const ranked = prioritizeSegments(segments);
  assert.equal(ranked[0].segment.id, "c");
  assert.equal(ranked[1].segment.id, "b");
  assert.equal(ranked[2].segment.id, "a");
  assert.equal(ranked[0].rank, 1);
  // empty / invalid input
  assert.deepEqual(prioritizeSegments([]), []);
  assert.deepEqual(prioritizeSegments(null as unknown as AudienceSegment[]), []);
});

test("prioritizeSegments breaks ties by segment id (ascending) for stable ordering", () => {
  const segments: AudienceSegment[] = [
    { id: "z", name: "z", filters: [], size: 100, population: 100, intentWeight: 0.5 },
    { id: "a", name: "a", filters: [], size: 100, population: 100, intentWeight: 0.5 },
  ];
  const ranked = prioritizeSegments(segments);
  assert.equal(ranked[0].segment.id, "a");
  assert.equal(ranked[1].segment.id, "z");
});

test("prioritizeSegments defaults intentWeight to 1 when undefined and clamps to [0, 1]", () => {
  // undefined intent → defaults to 1
  assert.equal(
    prioritizeSegments([
      { id: "a", name: "a", filters: [], size: 100, population: 100 },
    ])[0].score,
    100,
  );
  // negative or >1 intent is clamped to [0, 1]
  const ranked = prioritizeSegments([
    { id: "neg", name: "n", filters: [], size: 100, population: 100, intentWeight: -0.5 },
    { id: "big", name: "b", filters: [], size: 100, population: 100, intentWeight: 5 },
  ]);
  assert.equal(ranked[0].segment.id, "big");
  assert.equal(ranked[0].score, 100);
  assert.equal(ranked[1].segment.id, "neg");
  assert.equal(ranked[1].score, 0);
});

test("getTopSegment returns the highest-priority segment and null for empty input", () => {
  const segments: AudienceSegment[] = [
    { id: "a", name: "a", filters: [], size: 100, population: 1000, intentWeight: 0.5 },
    { id: "b", name: "b", filters: [], size: 200, population: 1000, intentWeight: 0.9 },
  ];
  assert.equal(getTopSegment(segments)?.id, "b");
  assert.equal(getTopSegment([]), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRule,
  evaluateSegment,
  combineSegments,
  type SegmentRule,
  type Contact,
  type SegmentEvaluation,
} from "../lib/segmentation-pure.ts";

const contact: Contact = {
  email: "ada@example.com",
  age: 36,
  country: "US",
  attributes: { plan: "pro", score: 87 },
};

test("evaluateRule eq / neq / gt / gte / lt / lte compare scalar fields", () => {
  assert.equal(evaluateRule({ field: "country", op: "eq", value: "US" }, contact), true);
  assert.equal(evaluateRule({ field: "country", op: "neq", value: "US" }, contact), false);
  assert.equal(evaluateRule({ field: "age", op: "gt", value: 30 }, contact), true);
  assert.equal(evaluateRule({ field: "age", op: "gte", value: 36 }, contact), true);
  assert.equal(evaluateRule({ field: "age", op: "lt", value: 30 }, contact), false);
  assert.equal(evaluateRule({ field: "age", op: "lte", value: 36 }, contact), true);
});

test("evaluateRule in / not_in check membership against an array value", () => {
  assert.equal(evaluateRule({ field: "country", op: "in", value: ["US", "CA"] }, contact), true);
  assert.equal(evaluateRule({ field: "country", op: "not_in", value: ["CA", "MX"] }, contact), true);
});

test("evaluateRule contains / starts_with / ends_with operate on string fields", () => {
  assert.equal(evaluateRule({ field: "email", op: "contains", value: "example" }, contact), true);
  assert.equal(evaluateRule({ field: "email", op: "starts_with", value: "ada" }, contact), true);
  assert.equal(evaluateRule({ field: "email", op: "ends_with", value: ".com" }, contact), true);
});

test("evaluateRule exists / missing check field presence", () => {
  assert.equal(evaluateRule({ field: "email", op: "exists" }, contact), true);
  assert.equal(evaluateRule({ field: "phone", op: "missing" }, contact), true);
});

test("evaluateRule resolves dotted paths", () => {
  assert.equal(evaluateRule({ field: "attributes.plan", op: "eq", value: "pro" }, contact), true);
  assert.equal(evaluateRule({ field: "attributes.score", op: "gte", value: 80 }, contact), true);
});

test("evaluateSegment with AND requires every rule to pass", () => {
  const rules: SegmentRule[] = [
    { field: "country", op: "eq", value: "US" },
    { field: "attributes.plan", op: "eq", value: "pro" },
  ];
  const res = evaluateSegment(rules, contact, "and");
  assert.equal(res.matched, true);
  assert.deepEqual(res.results, [true, true]);

  const failing = evaluateSegment(
    [...rules, { field: "age", op: "lt", value: 30 }],
    contact,
    "and",
  );
  assert.equal(failing.matched, false);
  assert.deepEqual(failing.results, [true, true, false]);
});

test("evaluateSegment with OR matches when at least one rule passes", () => {
  const rules: SegmentRule[] = [
    { field: "country", op: "eq", value: "CA" },
    { field: "attributes.plan", op: "eq", value: "pro" },
  ];
  const res = evaluateSegment(rules, contact, "or");
  assert.equal(res.matched, true);
  assert.deepEqual(res.results, [false, true]);
});

test("evaluateSegment with an empty rule list matches every contact", () => {
  const res = evaluateSegment([], contact, "and");
  assert.equal(res.matched, true);
  assert.deepEqual(res.results, []);
});

test("combineSegments with OR returns matched indices", () => {
  const evaluations: SegmentEvaluation[] = [
    { matched: false, results: [false] },
    { matched: true, results: [true] },
    { matched: true, results: [true, true] },
  ];
  const res = combineSegments(evaluations, "or");
  assert.equal(res.matched, true);
  assert.deepEqual(res.matchedSegmentIndices, [1, 2]);
});

test("combineSegments with AND requires every evaluation to match", () => {
  const all: SegmentEvaluation[] = [
    { matched: true, results: [true] },
    { matched: true, results: [true] },
  ];
  assert.equal(combineSegments(all, "and").matched, true);
  const some: SegmentEvaluation[] = [
    { matched: true, results: [true] },
    { matched: false, results: [false] },
  ];
  assert.equal(combineSegments(some, "and").matched, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonResponse,
  extractCitations,
  validateStructuredOutput,
  type StructuredSchema,
} from "../lib/ai-response-pure.ts";

test("parseJsonResponse parses a bare JSON object", () => {
  const r = parseJsonResponse('{"a":1,"b":"x"}');
  assert.equal(r.ok, true);
  assert.equal(r.error, null);
  assert.deepEqual(r.data, { a: 1, b: "x" });
});

test("parseJsonResponse parses a JSON array", () => {
  const r = parseJsonResponse("[1, 2, 3]");
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, [1, 2, 3]);
});

test("parseJsonResponse extracts JSON from a markdown code fence", () => {
  const r = parseJsonResponse("Here is the answer:\n```json\n{\"x\":42}\n```\nThanks!");
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { x: 42 });
});

test("parseJsonResponse extracts JSON from a bare code fence", () => {
  const r = parseJsonResponse("```\n{\"x\":7}\n```");
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { x: 7 });
});

test("parseJsonResponse tolerates surrounding prose and embedded JSON in text", () => {
  const r = parseJsonResponse('Result: {"deeply":{"nested":true}} done.');
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { deeply: { nested: true } });
});

test("parseJsonResponse trims a single pair of surrounding quotes", () => {
  const r = parseJsonResponse('"\"hello\""');
  assert.equal(r.ok, true);
  assert.equal(r.data, "hello");
});

test("parseJsonResponse returns ok:false with an error message for invalid JSON or empty input", () => {
  const bad = parseJsonResponse("not json at all");
  assert.equal(bad.ok, false);
  assert.equal(bad.data, null);
  assert.ok(typeof bad.error === "string" && bad.error.length > 0);

  const empty = parseJsonResponse("");
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "empty input");
  assert.equal(empty.data, null);
  assert.equal(empty.raw, "");
});

test("extractCitations returns deduplicated, sorted citations with counts", () => {
  const c = extractCitations("see [3] and [1] and [3] again, also [2].");
  assert.deepEqual(c, [
    { index: 1, count: 1 },
    { index: 2, count: 1 },
    { index: 3, count: 2 },
  ]);
});

test("extractCitations returns an empty array for no citations or invalid input", () => {
  assert.deepEqual(extractCitations("no citations here"), []);
  assert.deepEqual(extractCitations(""), []);
  assert.deepEqual(extractCitations(null as unknown as string), []);
  // [0] is filtered as out-of-range; [1234] is kept; [99999] (5 digits) doesn't match the regex
  assert.deepEqual(extractCitations("[0] [1234]"), [{ index: 1234, count: 1 }]);
  assert.deepEqual(extractCitations("[99999]"), []);
});

test("validateStructuredOutput accepts a conforming payload", () => {
  const schema: StructuredSchema = {
    name: { type: "string", required: true },
    count: { type: "number", required: true },
    tags: { type: "array" },
    meta: { type: "object" },
    active: { type: "boolean" },
  };
  const r = validateStructuredOutput(
    { name: "x", count: 5, tags: ["a"], meta: { k: 1 }, active: true },
    schema,
  );
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
});

test("validateStructuredOutput flags missing required fields and type mismatches", () => {
  const schema: StructuredSchema = {
    name: { type: "string", required: true },
    count: { type: "number", required: true },
  };
  const r = validateStructuredOutput({ count: "not-a-number" }, schema);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('"name" is missing')));
  assert.ok(r.errors.some((e) => e.includes('"count" has type "string", expected "number"')));
});

test("validateStructuredOutput rejects non-object data and bad schema", () => {
  assert.equal(validateStructuredOutput(null, {}).valid, false);
  assert.equal(validateStructuredOutput([1, 2], {}).valid, false);
  assert.equal(validateStructuredOutput({}, null as unknown as StructuredSchema).valid, false);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deepClone,
  deepMerge,
  pick,
  omit,
  getPath,
  setPath,
  hasPath,
  flattenObject,
} from "../lib/object-utils-pure";

test("deepClone clones nested objects and arrays", () => {
  const original = { a: [1, 2, { b: 3 }], c: "x" };
  const cloned = deepClone(original);
  assert.deepEqual(cloned, original);
  assert.notEqual(cloned, original);
  assert.notEqual(cloned.a, original.a);
  assert.notEqual(cloned.a[2], original.a[2]);
});

test("deepClone does not mutate the original when the clone is modified", () => {
  const original = { a: { b: 1 } };
  const cloned = deepClone(original);
  cloned.a.b = 99;
  assert.equal(original.a.b, 1);
});

test("deepClone returns primitives unchanged", () => {
  assert.equal(deepClone(42), 42);
  assert.equal(deepClone("hello"), "hello");
  assert.equal(deepClone(null), null);
  assert.equal(deepClone(undefined), undefined);
});

test("deepMerge merges nested plain objects recursively", () => {
  const result = deepMerge({ a: { x: 1 } }, { a: { y: 2 }, b: 3 });
  assert.deepEqual(result, { a: { x: 1, y: 2 }, b: 3 });
});

test("deepMerge replaces arrays rather than concatenating them", () => {
  const result = deepMerge({ a: [1, 2, 3] }, { a: [4, 5] });
  assert.deepEqual(result, { a: [4, 5] });
});

test("deepMerge does not mutate its inputs", () => {
  const target = { a: { x: 1 } };
  const source = { a: { y: 2 } };
  deepMerge(target, source);
  assert.deepEqual(target, { a: { x: 1 } });
  assert.deepEqual(source, { a: { y: 2 } });
});

test("pick returns only the requested keys and omits missing ones", () => {
  const obj = { a: 1, b: 2, c: 3 };
  assert.deepEqual(pick(obj, ["a", "c"]), { a: 1, c: 3 });
  const partial = pick({ a: 1 }, ["a", "b" as keyof { a: 1 }]);
  assert.deepEqual(partial, { a: 1 });
  assert.ok(!("b" in partial));
});

test("omit returns a new object without the excluded keys (or a copy when none are excluded)", () => {
  const obj = { a: 1, b: 2, c: 3 };
  assert.deepEqual(omit(obj, ["b"]), { a: 1, c: 3 });
  const copy = omit(obj, []);
  assert.deepEqual(copy, obj);
  assert.notEqual(copy, obj);
});

test("getPath reads nested values via dotted paths", () => {
  const obj = { a: { b: { c: 42 } } };
  assert.equal(getPath(obj, "a.b.c"), 42);
  assert.equal(getPath(obj, "a.x"), undefined);
  assert.equal(getPath(obj, ""), undefined);
});

test("getPath supports bracket notation for array indices", () => {
  const obj = { a: { b: [10, 20, 30] } };
  assert.equal(getPath(obj, "a.b[1]"), 20);
  assert.equal(getPath(obj, "a[b][2]"), 30);
});

test("hasPath returns true only for present values", () => {
  const obj = { a: { b: 1 } };
  assert.equal(hasPath(obj, "a.b"), true);
  assert.equal(hasPath(obj, "a.c"), false);
});

test("setPath sets a value at a nested path without mutating the input and creates intermediates", () => {
  const obj = { a: { b: 1 } };
  const next = setPath(obj, "a.b", 99);
  assert.equal(next.a.b, 99);
  assert.equal(obj.a.b, 1);
  const grown = setPath({}, "a.b.c", 5);
  assert.deepEqual(grown, { a: { b: { c: 5 } } });
});

test("flattenObject flattens nested objects using dotted keys", () => {
  const flat = flattenObject({ a: { b: 1, c: 2 }, d: 3 });
  assert.deepEqual(flat, { "a.b": 1, "a.c": 2, "d": 3 });
});

test("flattenObject flattens array values using their indices", () => {
  const flat = flattenObject({ a: [10, 20] });
  assert.deepEqual(flat, { "a.0": 10, "a.1": 20 });
});

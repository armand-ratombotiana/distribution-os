import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deepEqual,
  shallowEqual,
  compareVersions,
  compareDates,
  sortByField,
} from "../lib/comparison-pure.ts";

test("deepEqual returns true for primitives that are ===", () => {
  assert.equal(deepEqual(1, 1), true);
  assert.equal(deepEqual("a", "a"), true);
  assert.equal(deepEqual(true, true), true);
  assert.equal(deepEqual(null, null), true);
  assert.equal(deepEqual(1, "1"), false);
});

test("deepEqual treats NaN as equal to NaN", () => {
  assert.equal(deepEqual(NaN, NaN), true);
});

test("deepEqual compares arrays element-by-element", () => {
  assert.equal(deepEqual([1, 2, 3], [1, 2, 3]), true);
  assert.equal(deepEqual([1, 2, 3], [1, 2, 4]), false);
  assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
  assert.equal(deepEqual([{ a: 1 }], [{ a: 1 }]), true);
});

test("deepEqual recurses into nested objects", () => {
  assert.equal(
    deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } }),
    true,
  );
  assert.equal(
    deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }),
    false,
  );
});

test("deepEqual compares Dates by their epoch time", () => {
  const d1 = new Date("2024-01-01T00:00:00Z");
  const d2 = new Date("2024-01-01T00:00:00Z");
  const d3 = new Date("2024-01-02T00:00:00Z");
  assert.equal(deepEqual(d1, d2), true);
  assert.equal(deepEqual(d1, d3), false);
});

test("shallowEqual returns true only when same keys + === values", () => {
  assert.equal(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 3 }), false);
  // Nested object compared by reference, not deeply.
  const nested = { x: 1 };
  assert.equal(shallowEqual({ a: nested }, { a: nested }), true);
  assert.equal(shallowEqual({ a: { x: 1 } }, { a: { x: 1 } }), false);
});

test("shallowEqual handles null/undefined inputs", () => {
  assert.equal(shallowEqual(null, null), true);
  assert.equal(shallowEqual(undefined, undefined), true);
  assert.equal(shallowEqual(null, {}), false);
});

test("compareVersions orders numeric segments", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("2.0", "1.99.99"), 1);
});

test("compareVersions sorts pre-release versions before their release", () => {
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-beta"), -1);
  assert.equal(compareVersions("1.0.0-beta", "1.0.0-alpha"), 1);
});

test("compareVersions throws on non-string inputs", () => {
  // @ts-expect-error testing runtime guard
  assert.throws(() => compareVersions(1, "1.0.0"), /expects two strings/);
});

test("compareDates orders dates and accepts Date|number|string", () => {
  assert.equal(compareDates("2024-01-01", "2024-01-02"), -1);
  assert.equal(compareDates(new Date("2024-01-01"), new Date("2024-01-01")), 0);
  assert.equal(
    compareDates(Date.UTC(2024, 5, 15), Date.UTC(2024, 5, 14)),
    1,
  );
});

test("compareDates throws on invalid date input", () => {
  assert.throws(() => compareDates("not a date", "2024-01-01"), /invalid date/);
});

test("sortByField sorts ascending by default and descending when asked", () => {
  const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
  assert.deepEqual(
    sortByField(items, "n").map((x) => x.n),
    [1, 2, 3],
  );
  assert.deepEqual(
    sortByField(items, "n", "desc").map((x) => x.n),
    [3, 2, 1],
  );
});

test("sortByField does not mutate the input array and pushes nullish last", () => {
  const items = [{ v: 2 }, { v: undefined as unknown as number }, { v: 1 }];
  const sorted = sortByField(items, "v");
  assert.deepEqual(sorted.map((x) => x.v), [1, 2, undefined]);
  // Original untouched.
  assert.deepEqual(items.map((x) => x.v), [2, undefined, 1]);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  unique,
  chunk,
  partition,
  groupBy,
  sortBy,
  difference,
  intersection,
  flatten,
} from "../lib/array-utils-pure";

test("unique removes duplicates preserving insertion order", () => {
  assert.deepEqual(unique([1, 2, 2, 3, 1]), [1, 2, 3]);
  assert.deepEqual(unique(["a", "b", "a", "c"]), ["a", "b", "c"]);
  assert.deepEqual(unique([]), []);
});

test("unique handles mixed types and object identities correctly", () => {
  assert.deepEqual(unique([1, "1", 1]), [1, "1"]);
  const obj = { x: 1 };
  assert.deepEqual(unique([obj, obj, { x: 1 }]), [obj, { x: 1 }]);
});

test("chunk splits an array into groups of the requested size", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  assert.deepEqual(chunk([], 3), []);
});

test("chunk throws for non-positive or non-integer sizes", () => {
  assert.throws(() => chunk([1, 2], 0));
  assert.throws(() => chunk([1, 2], -1));
  assert.throws(() => chunk([1, 2], 1.5));
});

test("partition splits items by a predicate", () => {
  const [even, odd] = partition([1, 2, 3, 4, 5], (n) => n % 2 === 0);
  assert.deepEqual(even, [2, 4]);
  assert.deepEqual(odd, [1, 3, 5]);
});

test("partition passes the index to the predicate", () => {
  const [evens, odds] = partition(["a", "b", "c", "d"], (_x, i) => i % 2 === 0);
  assert.deepEqual(evens, ["a", "c"]);
  assert.deepEqual(odds, ["b", "d"]);
});

test("groupBy groups items by a derived string key", () => {
  const groups = groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? "even" : "odd"));
  assert.deepEqual(groups, { odd: [1, 3], even: [2, 4] });
});

test("groupBy returns an empty object for an empty input", () => {
  assert.deepEqual(groupBy([], () => "x"), {});
});

test("sortBy returns a stable ascending sort by a derived key", () => {
  const input = [{ a: 2 }, { a: 1 }, { a: 3 }];
  const sorted = sortBy(input, (x) => x.a);
  assert.deepEqual(sorted, [{ a: 1 }, { a: 2 }, { a: 3 }]);
  // Original array is unchanged.
  assert.deepEqual(input, [{ a: 2 }, { a: 1 }, { a: 3 }]);
});

test("sortBy supports descending order", () => {
  assert.deepEqual(sortBy([3, 1, 2], (n) => n, "desc"), [3, 2, 1]);
});

test("sortBy is stable for equal keys", () => {
  const input = [
    { k: 1, v: "a" },
    { k: 1, v: "b" },
    { k: 1, v: "c" },
  ];
  const sorted = sortBy(input, (x) => x.k);
  assert.deepEqual(sorted.map((x) => x.v), ["a", "b", "c"]);
});

test("difference returns items in `a` not present in `b`", () => {
  assert.deepEqual(difference([1, 2, 3, 4], [2, 4]), [1, 3]);
  assert.deepEqual(difference([1, 2, 3], []), [1, 2, 3]);
  assert.deepEqual(difference([], [1, 2]), []);
});

test("intersection returns items common to both arrays preserving `a`'s order and duplicates", () => {
  assert.deepEqual(intersection([1, 2, 3, 4], [2, 4]), [2, 4]);
  assert.deepEqual(intersection([4, 3, 2, 1], [1, 2]), [2, 1]);
  assert.deepEqual(intersection([], [1, 2]), []);
  // Duplicates in `a` are preserved when they also appear in `b`.
  assert.deepEqual(intersection([2, 2, 3], [2, 4]), [2, 2]);
});

test("flatten flattens to the specified depth", () => {
  assert.deepEqual(flatten([1, [2, [3, [4]]]]), [1, 2, [3, [4]]]);
  assert.deepEqual(flatten([1, [2, [3, [4]]]], 2), [1, 2, 3, [4]]);
  assert.deepEqual(flatten([1, [2, [3, [4]]]], Infinity), [1, 2, 3, 4]);
  assert.deepEqual(flatten([]), []);
});

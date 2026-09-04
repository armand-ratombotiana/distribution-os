import { test } from "node:test";
import assert from "node:assert/strict";

import {
  topologicalSort,
  detectCycles,
  findShortestPath,
  getNeighbors,
} from "../lib/graph-utils-pure.ts";

test("getNeighbors returns a copy of the adjacency list", () => {
  const g = { a: ["b", "c"], b: ["c"] };
  const neighbors = getNeighbors(g, "a");
  assert.deepEqual(neighbors, ["b", "c"]);
  // Mutating the returned array must not affect the graph.
  neighbors.push("zzz");
  assert.deepEqual(g.a, ["b", "c"]);
});

test("getNeighbors returns [] for unknown nodes or non-string input", () => {
  const g = { a: ["b"] };
  assert.deepEqual(getNeighbors(g, "missing"), []);
  // @ts-expect-error runtime guard
  assert.deepEqual(getNeighbors(g, 42), []);
});

test("topologicalSort orders dependencies before dependents (DAG)", () => {
  // a → b → c, a → c
  const g = { a: ["b", "c"], b: ["c"], c: [] };
  const sorted = topologicalSort(g);
  assert.equal(sorted[0], "a");
  assert.equal(sorted[sorted.length - 1], "c");
  // b must come before c.
  assert.ok(sorted.indexOf("b") < sorted.indexOf("c"));
});

test("topologicalSort throws when the graph contains a cycle", () => {
  const cyclic = { a: ["b"], b: ["c"], c: ["a"] };
  assert.throws(() => topologicalSort(cyclic), /cycle/);
});

test("topologicalSort handles a single-node graph", () => {
  assert.deepEqual(topologicalSort({ x: [] }), ["x"]);
});

test("topologicalSort handles a disconnected graph", () => {
  const g = { a: ["b"], b: [], c: ["d"], d: [] };
  const sorted = topologicalSort(g);
  // Each dependency precedes its dependent.
  assert.ok(sorted.indexOf("a") < sorted.indexOf("b"));
  assert.ok(sorted.indexOf("c") < sorted.indexOf("d"));
  assert.equal(sorted.length, 4);
});

test("detectCycles returns false for an acyclic graph", () => {
  assert.equal(detectCycles({ a: ["b"], b: ["c"], c: [] }), false);
});

test("detectCycles returns true when a cycle exists", () => {
  assert.equal(detectCycles({ a: ["b"], b: ["c"], c: ["a"] }), true);
});

test("detectCycles returns false for self-contained disconnected nodes", () => {
  assert.equal(detectCycles({ a: [], b: [], c: [] }), false);
});

test("findShortestPath returns the BFS shortest path between two nodes", () => {
  const g = {
    a: ["b", "c"],
    b: ["d"],
    c: ["d"],
    d: ["e"],
    e: [],
  };
  assert.deepEqual(findShortestPath(g, "a", "e"), ["a", "b", "d", "e"]);
  // Direct neighbor path.
  assert.deepEqual(findShortestPath(g, "a", "c"), ["a", "c"]);
});

test("findShortestPath returns undefined when no path exists", () => {
  const g = { a: ["b"], b: [], c: ["d"], d: [] };
  assert.equal(findShortestPath(g, "a", "d"), undefined);
});

test("findShortestPath returns [start] when start === target", () => {
  const g = { a: ["b"], b: [] };
  assert.deepEqual(findShortestPath(g, "a", "a"), ["a"]);
});

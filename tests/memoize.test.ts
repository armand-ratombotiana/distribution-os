import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cacheKey,
  createMemoCache,
  memoize,
  shouldRecalculate,
  type MemoEntry,
} from "../lib/memoize-pure.ts";

const NOW = 1_700_000_000_000;

test("cacheKey serializes primitive args deterministically", () => {
  assert.equal(cacheKey([1, "a"]), '[1,"a"]');
  assert.equal(cacheKey([true, null]), '[true,null]');
  assert.equal(cacheKey([]), "[]");
});

test("cacheKey orders object keys so key order doesn't matter", () => {
  assert.equal(
    cacheKey([{ a: 1, b: 2 }]),
    cacheKey([{ b: 2, a: 1 }]),
  );
  // Different values still produce different keys.
  assert.notEqual(cacheKey([{ a: 1 }]), cacheKey([{ a: 2 }]));
  // Array order is preserved.
  assert.notEqual(cacheKey([1, 2]), cacheKey([2, 1]));
});

test("shouldRecalculate returns true for missing entries", () => {
  assert.equal(shouldRecalculate(undefined, NOW, 1000), true);
});

test("shouldRecalculate returns false for fresh entries within their TTL", () => {
  const entry: MemoEntry<number> = {
    key: "k",
    result: 42,
    createdAtMs: NOW,
    accessedAtMs: NOW,
    hits: 0,
  };
  assert.equal(shouldRecalculate(entry, NOW + 999, 1000), false);
});

test("shouldRecalculate returns true once TTL has elapsed", () => {
  const entry: MemoEntry<number> = {
    key: "k",
    result: 42,
    createdAtMs: NOW,
    accessedAtMs: NOW,
    hits: 0,
  };
  assert.equal(shouldRecalculate(entry, NOW + 1000, 1000), true);
  assert.equal(shouldRecalculate(entry, NOW + 5000, 1000), true);
  // ttlMs=0 disables expiry.
  assert.equal(shouldRecalculate(entry, NOW + 1_000_000, 0), false);
});

test("shouldRecalculate returns true when the deps hash changes", () => {
  const entry: MemoEntry<number> = {
    key: "k",
    result: 42,
    createdAtMs: NOW,
    accessedAtMs: NOW,
    hits: 0,
    depsHash: "aaaa",
  };
  assert.equal(shouldRecalculate(entry, NOW, 0, "aaaa"), false);
  assert.equal(shouldRecalculate(entry, NOW, 0, "bbbb"), true);
});

test("memoize computes and caches on the first call", () => {
  let calls = 0;
  const fn = memoize((x: number) => {
    calls += 1;
    return x * 2;
  });
  const cache = createMemoCache<number>();
  const { result, cache: nextCache } = fn(cache, [21], NOW);
  assert.equal(result, 42);
  assert.equal(calls, 1);
  assert.equal(nextCache.entries.size, 1);
  assert.equal(nextCache.entries.get(cacheKey([21]))?.result, 42);
});

test("memoize returns the cached result on a second call without recomputing", () => {
  let calls = 0;
  const fn = memoize((x: number) => {
    calls += 1;
    return x + 1;
  });
  const cache = createMemoCache<number>();
  const r1 = fn(cache, [10], NOW);
  const r2 = fn(r1.cache, [10], NOW + 100);
  assert.equal(r1.result, 11);
  assert.equal(r2.result, 11);
  assert.equal(calls, 1);
});

test("memoize bumps hits and accessedAtMs on cache hits", () => {
  const fn = memoize((x: number) => x * 3);
  let cache = createMemoCache<number>();
  cache = fn(cache, [5], NOW).cache;
  cache = fn(cache, [5], NOW + 500).cache;
  const entry = cache.entries.get(cacheKey([5]))!;
  assert.equal(entry.hits, 1);
  assert.equal(entry.accessedAtMs, NOW + 500);
  assert.equal(entry.createdAtMs, NOW);
});

test("memoize invalidates when TTL elapses between calls", () => {
  let calls = 0;
  const fn = memoize(
    (x: number) => {
      calls += 1;
      return x + 100;
    },
    { ttlMs: 1000 },
  );
  let cache = createMemoCache<number>();
  cache = fn(cache, [1], NOW).cache;
  assert.equal(calls, 1);
  // Within TTL → no recompute.
  cache = fn(cache, [1], NOW + 500).cache;
  assert.equal(calls, 1);
  // Past TTL → recompute.
  fn(cache, [1], NOW + 1000);
  assert.equal(calls, 2);
});

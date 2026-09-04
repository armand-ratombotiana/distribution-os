import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateSize,
  DEFAULT_CACHE_CONFIG,
  evictToLimit,
  getExpiredKeys,
  isExpired,
  selectLRUVictim,
  shouldEvict,
  totalCacheSize,
  touchEntry,
  type CacheEntry,
  type CacheConfig,
} from "../lib/cache-pure.ts";

const NOW = 1_700_000_000_000; // 2023-11-14T22:13:20Z

function makeEntry<V>(
  overrides: Partial<CacheEntry<V>> & { key: string },
): CacheEntry<V> {
  return {
    value: undefined as V,
    createdAtMs: NOW,
    accessedAtMs: NOW,
    expiresAtMs: Infinity,
    hits: 0,
    sizeBytes: 100,
    ...overrides,
  } as CacheEntry<V>;
}

test("isExpired returns false for never-expiring entries and true once nowMs reaches expiresAtMs", () => {
  const never = makeEntry({ key: "a" });
  assert.equal(isExpired(never, NOW), false);
  assert.equal(isExpired(never, NOW + 1_000_000), false);

  const ttl = makeEntry({ key: "b", expiresAtMs: NOW + 1000 });
  assert.equal(isExpired(ttl, NOW), false);
  assert.equal(isExpired(ttl, NOW + 999), false);
  assert.equal(isExpired(ttl, NOW + 1000), true);
  assert.equal(isExpired(ttl, NOW + 5000), true);
});

test("isExpired treats non-finite nowMs as not expired so a broken clock can't purge the cache", () => {
  const e = makeEntry({ key: "a", expiresAtMs: NOW + 1000 });
  assert.equal(isExpired(e, NaN), false);
  assert.equal(isExpired(e, Infinity), false);
  assert.equal(isExpired(e, -Infinity), false);
});

test("shouldEvict returns true for expired entries and when the cache is over capacity", () => {
  const expired = makeEntry({ key: "a", expiresAtMs: NOW + 1000 });
  assert.equal(shouldEvict(expired, 0, DEFAULT_CACHE_CONFIG, NOW + 2000), true);

  const fresh = makeEntry({ key: "b" });
  const smallCfg: CacheConfig = { maxSizeBytes: 100, defaultTtlMs: 1000 };
  assert.equal(shouldEvict(fresh, 200, smallCfg, NOW), true);
  assert.equal(shouldEvict(fresh, 100, smallCfg, NOW), false);
  assert.equal(shouldEvict(fresh, 50, smallCfg, NOW), false);
});

test("calculateSize measures UTF-8 byte length of strings, objects, null, and undefined", () => {
  assert.equal(calculateSize("hello"), 5);
  assert.equal(calculateSize(""), 0);
  // "héllo" → h(1) + é(2) + l(1) + l(1) + o(1) = 6 bytes in UTF-8.
  assert.equal(calculateSize("héllo"), 6);
  assert.equal(calculateSize({ a: 1 }), Buffer.byteLength('{"a":1}', "utf8"));
  assert.equal(calculateSize([1, 2, 3]), Buffer.byteLength("[1,2,3]", "utf8"));
  assert.equal(calculateSize(null), 4);
  assert.equal(calculateSize(undefined), 0);
});

test("selectLRUVictim returns null for an empty cache", () => {
  assert.equal(selectLRUVictim([]), null);
});

test("selectLRUVictim picks the entry with the oldest accessedAtMs", () => {
  const entries = [
    makeEntry({ key: "a", accessedAtMs: 300 }),
    makeEntry({ key: "b", accessedAtMs: 100 }),
    makeEntry({ key: "c", accessedAtMs: 200 }),
  ];
  assert.equal(selectLRUVictim(entries), "b");
});

test("selectLRUVictim breaks ties by createdAtMs, then by lexicographic key", () => {
  // Three entries with the same accessedAtMs=100; smallest createdAtMs wins.
  const entries = [
    makeEntry({ key: "z", accessedAtMs: 100, createdAtMs: 50 }),
    makeEntry({ key: "a", accessedAtMs: 100, createdAtMs: 10 }),
    makeEntry({ key: "m", accessedAtMs: 100, createdAtMs: 50 }),
  ];
  assert.equal(selectLRUVictim(entries), "a");
  // Tie on both accessedAtMs and createdAtMs → smallest key wins.
  const tied = [
    makeEntry({ key: "z", accessedAtMs: 100, createdAtMs: 50 }),
    makeEntry({ key: "m", accessedAtMs: 100, createdAtMs: 50 }),
  ];
  assert.equal(selectLRUVictim(tied), "m");
});

test("totalCacheSize sums sizeBytes across entries", () => {
  const entries = [
    makeEntry({ key: "a", sizeBytes: 100 }),
    makeEntry({ key: "b", sizeBytes: 250 }),
    makeEntry({ key: "c", sizeBytes: 50 }),
  ];
  assert.equal(totalCacheSize(entries), 400);
  assert.equal(totalCacheSize([]), 0);
});

test("evictToLimit drops expired entries first, before considering LRU victims", () => {
  const cfg: CacheConfig = { maxSizeBytes: 250, defaultTtlMs: 1000 };
  const entries = [
    makeEntry({ key: "fresh-recent", accessedAtMs: 500, expiresAtMs: NOW + 9999, sizeBytes: 100 }),
    makeEntry({ key: "fresh-old", accessedAtMs: 100, expiresAtMs: NOW + 9999, sizeBytes: 100 }),
    makeEntry({ key: "expired-1", accessedAtMs: 50, expiresAtMs: NOW - 1, sizeBytes: 100 }),
    makeEntry({ key: "expired-2", accessedAtMs: 200, expiresAtMs: NOW - 100, sizeBytes: 100 }),
  ];
  // Total 400 bytes; limit 250. Dropping the two expired entries leaves 200
  // bytes (under the limit) so no LRU trim should happen.
  const { entries: survivors, evictedKeys } = evictToLimit(entries, cfg, NOW);
  assert.equal(survivors.length, 2);
  assert.deepEqual(evictedKeys.sort(), ["expired-1", "expired-2"]);
  assert.equal(totalCacheSize(survivors), 200);
});

test("evictToLimit trims LRU victims until the cache fits when no entries are expired", () => {
  const cfg: CacheConfig = { maxSizeBytes: 250, defaultTtlMs: 1000 };
  const entries = [
    makeEntry({ key: "a", accessedAtMs: 100, expiresAtMs: Infinity, sizeBytes: 100 }),
    makeEntry({ key: "b", accessedAtMs: 200, expiresAtMs: Infinity, sizeBytes: 100 }),
    makeEntry({ key: "c", accessedAtMs: 300, expiresAtMs: Infinity, sizeBytes: 100 }),
  ];
  // 300 bytes vs 250-byte limit → drop one entry. LRU victim is "a".
  const { entries: survivors, evictedKeys } = evictToLimit(entries, cfg, NOW);
  assert.equal(survivors.length, 2);
  assert.deepEqual(evictedKeys, ["a"]);
  assert.equal(totalCacheSize(survivors), 200);
});

test("touchEntry returns a new entry with bumped accessedAtMs and hits, leaving the original unchanged", () => {
  const e = makeEntry({ key: "a", accessedAtMs: NOW, hits: 3 });
  const touched = touchEntry(e, NOW + 1000);
  assert.notEqual(touched, e, "should return a new object");
  assert.equal(touched.accessedAtMs, NOW + 1000);
  assert.equal(touched.hits, 4);
  assert.equal(e.hits, 3, "original entry should be unchanged");
  assert.equal(e.accessedAtMs, NOW, "original accessedAtMs should be unchanged");
});

test("getExpiredKeys lists keys of all expired entries in input order", () => {
  const entries = [
    makeEntry({ key: "a", expiresAtMs: NOW + 1000 }),
    makeEntry({ key: "b", expiresAtMs: NOW - 1 }),
    makeEntry({ key: "c", expiresAtMs: Infinity }),
    makeEntry({ key: "d", expiresAtMs: NOW - 100 }),
    makeEntry({ key: "e", expiresAtMs: NOW + 5000 }),
  ];
  assert.deepEqual(getExpiredKeys(entries, NOW), ["b", "d"]);
  assert.deepEqual(getExpiredKeys([], NOW), []);
});

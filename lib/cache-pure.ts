/**
 * Pure in-memory cache utilities (LRU-aware).
 *
 * Every function is deterministic given its inputs: `nowMs` is always an
 * explicit parameter so callers can drive the cache from the wall clock or
 * from a deterministic test clock. No I/O, no D1, no globals.
 */

/**
 * A single cache entry. `value` is opaque to this module — callers decide
 * what to store. `expiresAtMs` of `Infinity` means the entry never expires.
 */
export interface CacheEntry<V = unknown> {
  key: string;
  value: V;
  createdAtMs: number;
  accessedAtMs: number;
  /** Epoch ms when the entry expires. `Infinity` means "never expires". */
  expiresAtMs: number;
  hits: number;
  /** Estimated size in bytes. See {@link calculateSize}. */
  sizeBytes: number;
  tags?: string[];
}

export interface CacheConfig {
  /** Max total bytes the cache should hold. */
  maxSizeBytes: number;
  /** Default TTL applied when an entry is created without one. */
  defaultTtlMs: number;
}

/**
 * Default cache config: 10 MiB capacity, 5-minute default TTL.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSizeBytes: 10 * 1024 * 1024,
  defaultTtlMs: 5 * 60 * 1000,
};

/**
 * Return `true` when `entry` has aged past its `expiresAtMs`. Entries with
 * `expiresAtMs === Infinity` never expire. Non-finite `nowMs` (NaN) is
 * treated as "not expired" so a broken clock can't purge the cache.
 */
export function isExpired<V>(entry: CacheEntry<V>, nowMs: number): boolean {
  if (!Number.isFinite(nowMs)) return false;
  if (!Number.isFinite(entry.expiresAtMs)) return false;
  return nowMs >= entry.expiresAtMs;
}

/**
 * Decide whether a given entry should be evicted. Eviction happens when:
 *   - the entry is expired, OR
 *   - the running cache size is over `config.maxSizeBytes`.
 */
export function shouldEvict<V>(
  entry: CacheEntry<V>,
  cacheSizeBytes: number,
  config: CacheConfig,
  nowMs: number,
): boolean {
  if (isExpired(entry, nowMs)) return true;
  return cacheSizeBytes > config.maxSizeBytes;
}

/**
 * Estimate the byte size of a value. Strings use UTF-8 byte length;
 * everything else falls back to `JSON.stringify` byte length. `undefined`
 * is treated as zero bytes; `null` as 4 bytes (`"null"`).
 */
export function calculateSize(value: unknown): number {
  if (value === undefined) return 0;
  if (value === null) return 4;
  if (typeof value === "string") {
    return Buffer.byteLength(value, "utf8");
  }
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

/**
 * Pick the cache key of the LRU victim: the entry with the smallest
 * `accessedAtMs`. Ties are broken by smallest `createdAtMs` (oldest entry
 * wins), then by lexicographic key for full determinism. Returns `null`
 * for an empty cache.
 */
export function selectLRUVictim<V>(
  entries: ReadonlyArray<CacheEntry<V>>,
): string | null {
  if (entries.length === 0) return null;
  let victim = entries[0];
  for (let i = 1; i < entries.length; i += 1) {
    const e = entries[i]!;
    if (e.accessedAtMs < victim.accessedAtMs) {
      victim = e;
    } else if (
      e.accessedAtMs === victim.accessedAtMs &&
      e.createdAtMs < victim.createdAtMs
    ) {
      victim = e;
    } else if (
      e.accessedAtMs === victim.accessedAtMs &&
      e.createdAtMs === victim.createdAtMs &&
      e.key < victim.key
    ) {
      victim = e;
    }
  }
  return victim.key;
}

/**
 * Total byte size of a list of cache entries (sum of `sizeBytes`).
 */
export function totalCacheSize<V>(
  entries: ReadonlyArray<CacheEntry<V>>,
): number {
  let total = 0;
  for (const e of entries) total += e.sizeBytes;
  return total;
}

/**
 * Evict entries until the cache fits within `config.maxSizeBytes`. Strategy:
 *   1. Drop all expired entries first.
 *   2. If still over capacity, repeatedly drop the LRU victim until the
 *      cache fits or is empty.
 *
 * Returns a new array; the input is not mutated. The second tuple element
 * is the list of evicted keys (in eviction order).
 */
export function evictToLimit<V>(
  entries: ReadonlyArray<CacheEntry<V>>,
  config: CacheConfig,
  nowMs: number,
): { entries: CacheEntry<V>[]; evictedKeys: string[] } {
  const evictedKeys: string[] = [];
  const survivors: CacheEntry<V>[] = [];
  for (const e of entries) {
    if (isExpired(e, nowMs)) {
      evictedKeys.push(e.key);
    } else {
      survivors.push(e);
    }
  }
  while (
    totalCacheSize(survivors) > config.maxSizeBytes &&
    survivors.length > 0
  ) {
    const victimKey = selectLRUVictim(survivors);
    if (victimKey === null) break;
    const idx = survivors.findIndex((e) => e.key === victimKey);
    if (idx < 0) break;
    survivors.splice(idx, 1);
    evictedKeys.push(victimKey);
  }
  return { entries: survivors, evictedKeys };
}

/**
 * Return a new entry with the `accessedAtMs` bumped to `nowMs` and `hits`
 * incremented. Pure — does not mutate the input.
 */
export function touchEntry<V>(
  entry: CacheEntry<V>,
  nowMs: number,
): CacheEntry<V> {
  return {
    ...entry,
    accessedAtMs: nowMs,
    hits: entry.hits + 1,
  };
}

/**
 * Return the keys (in input order) whose entries are expired at `nowMs`.
 */
export function getExpiredKeys<V>(
  entries: ReadonlyArray<CacheEntry<V>>,
  nowMs: number,
): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (isExpired(e, nowMs)) out.push(e.key);
  }
  return out;
}

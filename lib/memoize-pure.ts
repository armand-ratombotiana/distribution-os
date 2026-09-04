/**
 * Pure memoization helpers.
 *
 * The memo cache is returned alongside the result so callers can persist it.
 * No closures hide mutable state — every call is a pure function of its
 * inputs.
 */

import { createHash } from "node:crypto";

export interface MemoEntry<R> {
  /** Serialized arguments key. */
  key: string;
  result: R;
  createdAtMs: number;
  accessedAtMs: number;
  hits: number;
  /** Optional dependency fingerprint; changing it invalidates the cache. */
  depsHash?: string;
}

export interface MemoCache<R> {
  entries: Map<string, MemoEntry<R>>;
}

export interface MemoOptions {
  /** TTL in milliseconds; 0 disables expiry. */
  ttlMs?: number;
  /** Optional dependency fingerprint; changing it invalidates the cache. */
  deps?: unknown;
}

/**
 * Build a deterministic cache key from a list of arguments. Object keys are
 * sorted so `{a:1,b:2}` and `{b:2,a:1}` produce the same key. Arrays keep
 * their order.
 */
export function cacheKey(args: ReadonlyArray<unknown>): string {
  return stableStringify(args);
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * Return `true` when the cached entry should be recomputed: either it's
 * missing, past its TTL, or its dependency fingerprint has changed.
 */
export function shouldRecalculate<R>(
  entry: MemoEntry<R> | undefined,
  nowMs: number,
  ttlMs: number,
  depsHash?: string,
): boolean {
  if (!entry) return true;
  if (ttlMs > 0 && nowMs - entry.createdAtMs >= ttlMs) return true;
  if (depsHash !== undefined && entry.depsHash !== depsHash) return true;
  return false;
}

function hashDeps(deps: unknown): string | undefined {
  if (deps === undefined) return undefined;
  return createHash("sha256")
    .update(stableStringify(deps), "utf8")
    .digest("hex")
    .slice(0, 16);
}

/**
 * Memoize a pure function. Returns a new function that takes a `MemoCache`,
 * a list of arguments, and the current time, and returns
 * `{ result, cache }`. The cache is never mutated; a new Map is returned
 * on every call.
 */
export function memoize<A extends ReadonlyArray<unknown>, R>(
  fn: (...args: A) => R,
  options: MemoOptions = {},
): (
  cache: MemoCache<R>,
  args: A,
  nowMs: number,
) => { result: R; cache: MemoCache<R> } {
  const ttlMs = options.ttlMs ?? 0;
  const depsHash = hashDeps(options.deps);
  return (cache, args, nowMs) => {
    const key = cacheKey(args);
    const existing = cache.entries.get(key);
    if (!shouldRecalculate(existing, nowMs, ttlMs, depsHash)) {
      const touched: MemoEntry<R> = {
        ...existing!,
        accessedAtMs: nowMs,
        hits: existing!.hits + 1,
      };
      const nextMap = new Map(cache.entries);
      nextMap.set(key, touched);
      return { result: touched.result, cache: { entries: nextMap } };
    }
    const result = fn(...args);
    const entry: MemoEntry<R> = {
      key,
      result,
      createdAtMs: nowMs,
      accessedAtMs: nowMs,
      hits: 0,
      depsHash,
    };
    const nextMap = new Map(cache.entries);
    nextMap.set(key, entry);
    return { result, cache: { entries: nextMap } };
  };
}

/**
 * Create an empty memo cache.
 */
export function createMemoCache<R>(): MemoCache<R> {
  return { entries: new Map() };
}

/**
 * Pure array utility functions. All functions are side-effect free and
 * do not mutate their inputs unless explicitly noted.
 */

/**
 * Return a new array with duplicate elements removed. Equality is
 * determined by `SameValueZero` (the same algorithm used by `Set`).
 *
 *   unique([1, 2, 2, 3, 1]) // [1, 2, 3]
 */
export function unique<T>(items: readonly T[]): T[] {
  if (!Array.isArray(items)) return [];
  return Array.from(new Set(items));
}

/**
 * Split `items` into chunks of at most `size` elements. The final chunk
 * may be shorter. Returns `[]` for an empty input.
 *
 *   chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Array.isArray(items)) return [];
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("chunk: size must be a positive integer");
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Partition an array into two arrays: items for which `predicate`
 * returned `true`, and items for which it returned `false`. Order is
 * preserved within each partition.
 *
 *   partition([1, 2, 3, 4], (n) => n % 2 === 0) // [[2, 4], [1, 3]]
 */
export function partition<T>(
  items: readonly T[],
  predicate: (item: T, index: number) => boolean,
): [T[], T[]] {
  if (!Array.isArray(items)) return [[], []];
  const pass: T[] = [];
  const fail: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (predicate(item, i)) pass.push(item);
    else fail.push(item);
  }
  return [pass, fail];
}

/**
 * Group items by a key derived from `keyFn`. Returns a plain object
 * whose keys are the stringified group keys and whose values are arrays
 * of items, in insertion order.
 *
 *   groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? "even" : "odd"))
 *   // { odd: [1, 3], even: [2, 4] }
 */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T, index: number) => K,
): Record<string, T[]> {
  if (!Array.isArray(items)) return {};
  const out: Record<string, T[]> = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = String(keyFn(item, i));
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].push(item);
  }
  return out;
}

/**
 * Stable sort by a key derived from `keyFn`. Returns a new array; the
 * input is not mutated. Accepts an optional `order` of `"asc"` (default)
 * or `"desc"`.
 */
export function sortBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string | number,
  order: "asc" | "desc" = "asc",
): T[] {
  if (!Array.isArray(items)) return [];
  const sign = order === "desc" ? -1 : 1;
  const decorated = items.map((item, index) => ({ item, key: keyFn(item), index }));
  decorated.sort((a, b) => {
    if (a.key < b.key) return -1 * sign;
    if (a.key > b.key) return 1 * sign;
    return a.index - b.index; // stable tiebreak
  });
  return decorated.map((d) => d.item);
}

/**
 * Return the elements of `a` that are not present in `b`. Equality is
 * determined by `SameValueZero`.
 *
 *   difference([1, 2, 3, 4], [2, 4]) // [1, 3]
 */
export function difference<T>(a: readonly T[], b: readonly T[]): T[] {
  if (!Array.isArray(a)) return [];
  if (!Array.isArray(b)) return a.slice();
  const exclude = new Set(b);
  return a.filter((x) => !exclude.has(x));
}

/**
 * Return the elements present in both `a` and `b`, preserving the order
 * of `a`. Duplicates in `a` are preserved if they also appear in `b`.
 *
 *   intersection([1, 2, 3, 2], [2, 4]) // [2, 2]
 */
export function intersection<T>(a: readonly T[], b: readonly T[]): T[] {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

/**
 * Recursively flatten nested arrays to the specified `depth` (default 1).
 *   flatten([1, [2, [3, [4]]]])             // [1, 2, [3, [4]]]
 *   flatten([1, [2, [3, [4]]]], Infinity)   // [1, 2, 3, 4]
 */
export function flatten(items: readonly unknown[], depth: number = 1): unknown[] {
  if (!Array.isArray(items)) return [];
  // `Array.prototype.flat` accepts Infinity and any non-negative integer.
  return items.flat(Math.max(0, depth));
}

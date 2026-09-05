/**
 * Pure comparison helpers — deep equality, shallow equality, version and date
 * comparison, and a small `sortByField` utility. No dependencies.
 */

/** Strict deep equality that handles primitives, arrays, plain objects and Dates. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  // Different NaN-aware primitive equality
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  return false;
}

/** Reference-and-shallow-field equality for plain objects. */
export function shallowEqual(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Compares two semver-like strings ("1.2.3", "1.2", "1.2.3-beta").
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Pre-release suffixes sort
 * before their release counterparts (per semver rules).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  if (typeof a !== "string" || typeof b !== "string") {
    throw new TypeError("compareVersions expects two strings");
  }
  const parse = (v: string): { nums: number[]; pre: string | null } => {
    const [main, pre] = v.split("-");
    const nums = main.split(".").map((n) => {
      const num = parseInt(n, 10);
      return Number.isFinite(num) ? num : 0;
    });
    return { nums, pre: pre ?? null };
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.nums.length, pb.nums.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa.nums[i] ?? 0;
    const y = pb.nums[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  // Equal numeric parts: a version with a pre-release sorts before one without.
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && pb.pre) {
    if (pa.pre < pb.pre) return -1;
    if (pa.pre > pb.pre) return 1;
  }
  return 0;
}

type DateIn = Date | number | string;

function toDate(value: DateIn): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Compares two dates. Returns -1 if a < b, 0 if equal, 1 if a > b.
 * Accepts Date objects, epoch ms, or ISO strings.
 */
export function compareDates(a: DateIn, b: DateIn): -1 | 0 | 1 {
  const ta = toDate(a).getTime();
  const tb = toDate(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    throw new Error("compareDates received an invalid date");
  }
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

type SortDirection = "asc" | "desc";

/**
 * Sorts a list of records by a single field, returning a new array.
 * Direction defaults to "asc". Null/undefined values sort to the end.
 */
export function sortByField<T extends Record<string, unknown>>(
  items: readonly T[],
  field: keyof T,
  direction: SortDirection = "asc",
): T[] {
  if (!Array.isArray(items)) {
    throw new TypeError("sortByField expects an array");
  }
  const sign = direction === "desc" ? -1 : 1;
  const copy = items.slice();
  copy.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nullish always last
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * sign;
    }
    const as = String(av);
    const bs = String(bv);
    if (as < bs) return -1 * sign;
    if (as > bs) return 1 * sign;
    return 0;
  });
  return copy;
}

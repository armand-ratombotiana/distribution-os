/**
 * Pure audience-segment utilities.
 *
 * An `AudienceSegment` describes a slice of a targetable population via
 * attribute filters (firmographic or behavioural). `matchSegment` tests
 * whether a given contact matches the segment's filters; `calculateReach`
 * estimates the fraction of a population that the segment covers;
 * `prioritizeSegments` ranks segments by their expected value (size ×
 * match-quality × intent-weight).
 *
 * No I/O, no side effects, deterministic.
 */

export type Comparator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains";

export interface AudienceFilter {
  /** Attribute path on the contact, e.g. `company.size`. */
  field: string;
  op: Comparator;
  /** Comparison value (ignored by `exists`-style ops; here for symmetry). */
  value?: unknown;
}

export interface AudienceSegment {
  /** Stable identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Filters combined with AND semantics. */
  filters: AudienceFilter[];
  /** Estimated segment size (number of matching contacts in the population). */
  size: number;
  /** Total addressable population the segment is drawn from. */
  population: number;
  /** Intent / conversion-weight in `[0, 1]`. Higher means higher-quality matches. */
  intentWeight?: number;
}

export interface RankedSegment {
  segment: AudienceSegment;
  /** Composite priority score in `[0, ∞)`. */
  score: number;
  /** 1-based rank. */
  rank: number;
}

function readPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) return undefined;
  const parts = path.split(".");
  let cur: unknown = source;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Test a single `filter` against a `contact`. Returns `true` when the
 * filter passes. Unknown operators always return `false`.
 */
export function matchFilter(
  filter: AudienceFilter,
  contact: Record<string, unknown>,
): boolean {
  if (!filter || typeof filter !== "object") return false;
  const actual = readPath(contact, filter.field);
  switch (filter.op) {
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = asNumber(actual);
      const b = asNumber(filter.value);
      if (a === undefined || b === undefined) return false;
      switch (filter.op) {
        case "gt": return a > b;
        case "gte": return a >= b;
        case "lt": return a < b;
        case "lte": return a <= b;
      }
      return false;
    }
    case "in":
      return Array.isArray(filter.value) && filter.value.some((v) => v === actual);
    case "not_in":
      return Array.isArray(filter.value) && !filter.value.some((v) => v === actual);
    case "contains": {
      if (typeof actual !== "string" || typeof filter.value !== "string") return false;
      return actual.includes(filter.value);
    }
    default:
      return false;
  }
}

/**
 * Test whether a `contact` matches every filter in `segment.filters`
 * (AND semantics). A segment with no filters matches every contact.
 */
export function matchSegment(
  segment: AudienceSegment,
  contact: Record<string, unknown>,
): boolean {
  if (!segment || !Array.isArray(segment.filters)) return false;
  if (segment.filters.length === 0) return true;
  return segment.filters.every((f) => matchFilter(f, contact));
}

/**
 * Estimate the fraction of the population that the segment covers. Uses
 * the segment's own `size` / `population` fields and clamps the result
 * to `[0, 1]`. Returns `0` for invalid inputs.
 */
export function calculateReach(segment: AudienceSegment): number {
  if (!segment) return 0;
  const size = asNumber(segment.size) ?? 0;
  const population = asNumber(segment.population) ?? 0;
  if (size < 0 || population <= 0) return 0;
  if (size >= population) return 1;
  return size / population;
}

/**
 * Rank segments by composite priority score:
 *
 *   score = size × intentWeight × reach
 *
 * Higher scores rank first. Ties are broken by segment id (ascending)
 * for stable ordering. Returns an array of `{ segment, score, rank }`
 * where `rank` starts at 1.
 */
export function prioritizeSegments(segments: AudienceSegment[]): RankedSegment[] {
  const safe = Array.isArray(segments) ? segments : [];
  const scored = safe.map((segment) => {
    const intent = asNumber(segment?.intentWeight);
    const w = intent === undefined ? 1 : Math.max(0, Math.min(1, intent));
    const reach = calculateReach(segment);
    const size = Math.max(0, asNumber(segment?.size) ?? 0);
    return { segment, score: size * w * reach };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.segment?.id ?? "").localeCompare(String(b.segment?.id ?? ""));
  });
  return scored.map((entry, i) => ({
    segment: entry.segment,
    score: entry.score,
    rank: i + 1,
  }));
}

/**
 * Return the top-ranked segment, or `null` when the list is empty.
 */
export function getTopSegment(segments: AudienceSegment[]): AudienceSegment | null {
  const ranked = prioritizeSegments(segments);
  return ranked.length === 0 ? null : ranked[0].segment;
}

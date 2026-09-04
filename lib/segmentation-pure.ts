/**
 * Pure segmentation utilities.
 *
 * Segments are rules that match a contact against attribute predicates.
 * A `SegmentRule` is a single attribute test; `evaluateSegment` combines a
 * list of rules with AND/OR semantics; `combineSegments` merges the results
 * of multiple segment evaluations according to a combining operator.
 *
 * No I/O, no side effects, deterministic.
 */

export type SegmentOperator = "and" | "or";

export type SegmentRuleOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "exists"
  | "missing";

export interface SegmentRule {
  /** Dotted path into the contact, e.g. `attributes.country`. */
  field: string;
  op: SegmentRuleOp;
  /** Comparison value (ignored for `exists`/`missing`). */
  value?: unknown;
}

export type Contact = Record<string, unknown>;

export interface SegmentEvaluation {
  /** Whether the contact matches the segment. */
  matched: boolean;
  /** Per-rule pass/fail trace, in the same order as the input rules. */
  results: boolean[];
}

function readPath(source: unknown, path: string): unknown {
  if (source === null || source === undefined) return undefined;
  const parts = path.split(".");
  let cur: unknown = source;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
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
 * Evaluate a single rule against a contact. Returns `true` when the rule
 * passes. Unknown operators always return `false`.
 */
export function evaluateRule(rule: SegmentRule, contact: Contact): boolean {
  const actual = readPath(contact, rule.field);
  switch (rule.op) {
    case "exists":
      return actual !== undefined && actual !== null;
    case "missing":
      return actual === undefined || actual === null;
    case "eq":
      return actual === rule.value;
    case "neq":
      return actual !== rule.value;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = asNumber(actual);
      const b = asNumber(rule.value);
      if (a === undefined || b === undefined) return false;
      switch (rule.op) {
        case "gt": return a > b;
        case "gte": return a >= b;
        case "lt": return a < b;
        case "lte": return a <= b;
      }
      return false;
    }
    case "in": {
      if (!Array.isArray(rule.value)) return false;
      return rule.value.some((v) => v === actual);
    }
    case "not_in": {
      if (!Array.isArray(rule.value)) return true;
      return !rule.value.some((v) => v === actual);
    }
    case "contains": {
      if (typeof actual !== "string" || typeof rule.value !== "string") return false;
      return actual.includes(rule.value);
    }
    case "starts_with": {
      if (typeof actual !== "string" || typeof rule.value !== "string") return false;
      return actual.startsWith(rule.value);
    }
    case "ends_with": {
      if (typeof actual !== "string" || typeof rule.value !== "string") return false;
      return actual.endsWith(rule.value);
    }
    default:
      return false;
  }
}

/**
 * Evaluate a list of `rules` against a `contact`, combining results with
 * `operator` (default `"and"`). An empty rule list matches every contact.
 */
export function evaluateSegment(
  rules: SegmentRule[],
  contact: Contact,
  operator: SegmentOperator = "and",
): SegmentEvaluation {
  const results = rules.map((r) => evaluateRule(r, contact));
  let matched: boolean;
  if (rules.length === 0) {
    matched = true;
  } else if (operator === "or") {
    matched = results.some(Boolean);
  } else {
    matched = results.every(Boolean);
  }
  return { matched, results };
}

export interface CombinedSegmentResult {
  matched: boolean;
  /** Indices of segments that matched (into the input `evaluations`). */
  matchedSegmentIndices: number[];
}

/**
 * Combine the results of multiple segment evaluations according to `operator`:
 *   - `"and"` → matched only when every evaluation matched
 *   - `"or"`  → matched when at least one evaluation matched
 *
 * Returns the indices of the matching segments so callers can see *which*
 * segments contributed to a positive `or` result.
 */
export function combineSegments(
  evaluations: SegmentEvaluation[],
  operator: SegmentOperator = "or",
): CombinedSegmentResult {
  const matchedSegmentIndices = evaluations
    .map((e, i) => (e.matched ? i : -1))
    .filter((i) => i >= 0);
  let matched: boolean;
  if (evaluations.length === 0) {
    matched = operator === "and"; // empty AND is vacuously true; empty OR false
  } else if (operator === "and") {
    matched = matchedSegmentIndices.length === evaluations.length;
  } else {
    matched = matchedSegmentIndices.length > 0;
  }
  return { matched, matchedSegmentIndices };
}

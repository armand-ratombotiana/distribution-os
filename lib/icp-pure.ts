/**
 * Pure ideal-customer-profile (ICP) utilities.
 *
 * An `ICP` describes the firmographic and behavioural attributes of an
 * ideal customer. `scoreFit` computes a 0–100 fit score for a prospect by
 * comparing each prospect attribute against the ICP's target band;
 * `getExclusionCriteria` returns the list of hard-exclusion rules;
 * `validateICP` checks that an ICP is well-formed.
 *
 * No I/O, no side effects, deterministic.
 */

export interface ICPAttribute {
  /** Attribute name (e.g. "employeeCount"). */
  name: string;
  /** Minimum acceptable value (inclusive). */
  min?: number;
  /** Maximum acceptable value (inclusive). */
  max?: number;
  /** Specific allowed values (whitelist). */
  allowed?: unknown[];
  /** Weight applied to the fit contribution. Defaults to 1. */
  weight?: number;
  /** If true, a non-matching prospect gets a fit score of 0 (hard exclusion). */
  required?: boolean;
}

export interface ICP {
  /** Stable identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Industry whitelist (empty array = any industry). */
  industries?: string[];
  /** Attribute specifications. */
  attributes: ICPAttribute[];
  /** Hard-exclusion rules; a prospect matching any rule is score 0. */
  exclusions?: ExclusionRule[];
}

export interface ExclusionRule {
  /** Attribute name on the prospect. */
  field: string;
  /** Operator. */
  op: "eq" | "in" | "lt" | "gt";
  /** Comparison value. */
  value?: unknown;
}

export interface Prospect {
  /** Prospect attribute bag. */
  attributes: Record<string, unknown>;
}

export interface ICPValidation {
  valid: boolean;
  errors: string[];
}

function safeNum(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readAttr(prospect: Prospect, name: string): unknown {
  if (!prospect || typeof prospect !== "object") return undefined;
  const attrs = prospect.attributes;
  if (!attrs || typeof attrs !== "object") return undefined;
  return (attrs as Record<string, unknown>)[name];
}

function scoreAttribute(spec: ICPAttribute, prospectValue: unknown): { fit: number; hard: boolean } {
  const weight = Math.max(0, safeNum(spec?.weight, 1));
  // required with a hard-exclusion pattern
  if (spec?.required) {
    const inBand = isInBand(spec, prospectValue);
    if (!inBand) return { fit: 0, hard: true };
  }
  if (isInBand(spec, prospectValue)) {
    return { fit: weight, hard: false };
  }
  // Partial credit for "close" numeric values: within 25% of the band edge.
  const partial = partialCredit(spec, prospectValue);
  return { fit: weight * partial, hard: false };
}

function isInBand(spec: ICPAttribute, v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(spec.allowed) && spec.allowed.length > 0) {
    return spec.allowed.some((a) => a === v);
  }
  const n = asNumber(v);
  if (n === undefined) return false;
  const min = spec.min;
  const max = spec.max;
  if (typeof min === "number" && Number.isFinite(min) && n < min) return false;
  if (typeof max === "number" && Number.isFinite(max) && n > max) return false;
  if (typeof min !== "number" || !Number.isFinite(min)) {
    if (typeof max !== "number" || !Number.isFinite(max)) return false;
  }
  return true;
}

function partialCredit(spec: ICPAttribute, v: unknown): number {
  const n = asNumber(v);
  if (n === undefined) return 0;
  const min = typeof spec.min === "number" && Number.isFinite(spec.min) ? spec.min : null;
  const max = typeof spec.max === "number" && Number.isFinite(spec.max) ? spec.max : null;
  if (min === null && max === null) return 0;
  if (min !== null && n < min) {
    // within 25% below the min → partial credit proportional to closeness
    const tolerance = Math.abs(min) * 0.25 + 1;
    if (n >= min - tolerance) return 1 - (min - n) / tolerance;
    return 0;
  }
  if (max !== null && n > max) {
    const tolerance = Math.abs(max) * 0.25 + 1;
    if (n <= max + tolerance) return 1 - (n - max) / tolerance;
    return 0;
  }
  return 0;
}

/**
 * Compute a 0–100 fit score for `prospect` against `icp`. The score is
 * the weighted fraction of matched attributes (with partial credit for
 * near-misses on numeric attributes), scaled to 100. If any exclusion
 * rule matches, or any required attribute fails, the score is 0.
 */
export function scoreFit(icp: ICP, prospect: Prospect): number {
  if (!icp || !prospect) return 0;
  // Hard exclusions first.
  for (const rule of icp.exclusions ?? []) {
    if (matchesExclusion(rule, prospect)) return 0;
  }
  // Industry whitelist.
  if (Array.isArray(icp.industries) && icp.industries.length > 0) {
    const ind = readAttr(prospect, "industry");
    if (!icp.industries.includes(ind as string)) return 0;
  }
  const attrs = Array.isArray(icp.attributes) ? icp.attributes : [];
  if (attrs.length === 0) return 0;
  let earned = 0;
  let possible = 0;
  for (const spec of attrs) {
    const v = readAttr(prospect, spec.name);
    const { fit, hard } = scoreAttribute(spec, v);
    if (hard) return 0;
    const weight = Math.max(0, safeNum(spec.weight, 1));
    possible += weight;
    earned += fit;
  }
  if (possible <= 0) return 0;
  return Math.max(0, Math.min(100, (earned / possible) * 100));
}

function matchesExclusion(rule: ExclusionRule, prospect: Prospect): boolean {
  if (!rule) return false;
  const v = readAttr(prospect, rule.field);
  switch (rule.op) {
    case "eq":
      return v === rule.value;
    case "in":
      return Array.isArray(rule.value) && rule.value.some((x) => x === v);
    case "lt": {
      const n = asNumber(v);
      const t = asNumber(rule.value);
      return n !== undefined && t !== undefined && n < t;
    }
    case "gt": {
      const n = asNumber(v);
      const t = asNumber(rule.value);
      return n !== undefined && t !== undefined && n > t;
    }
    default:
      return false;
  }
}

/**
 * Return the list of hard-exclusion rules attached to an ICP. Returns an
 * empty array when the ICP has no exclusions or is invalid.
 */
export function getExclusionCriteria(icp: ICP): ExclusionRule[] {
  if (!icp || !Array.isArray(icp.exclusions)) return [];
  return icp.exclusions.filter(
    (r): r is ExclusionRule =>
      r !== null && typeof r === "object" && typeof r.field === "string",
  );
}

/**
 * Validate an `ICP`:
 *   - `id` and `name` must be non-empty strings
 *   - `attributes` must be a non-empty array of well-formed specs
 *   - each spec must have a `name` and at least one of `min`/`max`/`allowed`
 *   - `industries` (if set) must be an array of strings
 *   - `exclusions` (if set) must be an array of well-formed rules
 *
 * Returns `{ valid, errors }`.
 */
export function validateICP(icp: ICP): ICPValidation {
  const errors: string[] = [];
  if (!icp || typeof icp !== "object") {
    return { valid: false, errors: ["icp must be an object"] };
  }
  if (typeof icp.id !== "string" || icp.id.trim() === "") {
    errors.push("id must be a non-empty string");
  }
  if (typeof icp.name !== "string" || icp.name.trim() === "") {
    errors.push("name must be a non-empty string");
  }
  if (!Array.isArray(icp.attributes) || icp.attributes.length === 0) {
    errors.push("attributes must be a non-empty array");
  } else {
    icp.attributes.forEach((spec, i) => {
      if (!spec || typeof spec !== "object") {
        errors.push(`attribute[${i}] must be an object`);
        return;
      }
      if (typeof spec.name !== "string" || spec.name.trim() === "") {
        errors.push(`attribute[${i}].name must be a non-empty string`);
      }
      const hasMin = typeof spec.min === "number" && Number.isFinite(spec.min);
      const hasMax = typeof spec.max === "number" && Number.isFinite(spec.max);
      const hasAllowed = Array.isArray(spec.allowed);
      if (!hasMin && !hasMax && !hasAllowed) {
        errors.push(`attribute[${i}] must have at least one of min, max, or allowed`);
      }
    });
  }
  if (icp.industries !== undefined) {
    if (!Array.isArray(icp.industries) || !icp.industries.every((x) => typeof x === "string")) {
      errors.push("industries must be an array of strings");
    }
  }
  if (icp.exclusions !== undefined) {
    if (!Array.isArray(icp.exclusions)) {
      errors.push("exclusions must be an array");
    } else {
      icp.exclusions.forEach((r, i) => {
        if (!r || typeof r !== "object" || typeof r.field !== "string" || r.field.trim() === "") {
          errors.push(`exclusion[${i}].field must be a non-empty string`);
        }
        if (!["eq", "in", "lt", "gt"].includes(r?.op)) {
          errors.push(`exclusion[${i}].op is invalid`);
        }
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

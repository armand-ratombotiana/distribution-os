/**
 * Pure positioning utilities.
 *
 * A `Positioning` describes a product's promise to a target audience, the
 * evidence supporting that promise, and the differentiators versus
 * competitors. `evaluatePromise` scores the strength of a promise based on
 * how much evidence backs it; `getDifferentiation` returns the list of
 * unique strengths vs. a competitor list; `validatePositioning` checks
 * the structural well-formedness of a positioning record.
 *
 * No I/O, no side effects, deterministic.
 */

export interface PositioningEvidence {
  /** Short label, e.g. "case-study-acme". */
  id: string;
  /** Strength of the evidence in `[0, 1]`. */
  strength: number;
  /** Whether the evidence has been verified by a human. */
  verified?: boolean;
}

export interface Positioning {
  /** Stable identifier. */
  id: string;
  /** The promise statement, e.g. "Cut onboarding time in half". */
  promise: string;
  /** Target audience label. */
  audience: string;
  /** Category / market label, e.g. "AI Sales Tools". */
  category: string;
  /** Supporting evidence items. */
  evidence: PositioningEvidence[];
  /** Differentiation messages vs. competitors. */
  differentiators: string[];
  /** Optional risk flags. */
  risks?: string[];
}

export interface PromiseEvaluation {
  /** Composite promise-strength score in `[0, 100]`. */
  score: number;
  /** Gaps identified during evaluation. */
  gaps: string[];
}

export interface PositioningValidation {
  valid: boolean;
  errors: string[];
}

function safeNum(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

function safeArr<T>(a: unknown): T[] {
  return Array.isArray(a) ? a : [];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Evaluate the strength of a positioning promise. The score combines:
 *   - the average verified-evidence strength (weight 0.6)
 *   - the count of differentiators, capped at 5 → 100 (weight 0.3)
 *   - a risk-adjustment term: 10 - riskCount, clamped to [0, 10] (weight 0.1)
 *
 * Returns `{ score, gaps }` where `gaps` lists missing evidence and
 * differentiators. The score is clamped to `[0, 100]`.
 */
export function evaluatePromise(positioning: Positioning): PromiseEvaluation {
  const empty: PromiseEvaluation = { score: 0, gaps: ["positioning is missing"] };
  if (!positioning || typeof positioning !== "object") return empty;
  const gaps: string[] = [];
  const evidence = safeArr<PositioningEvidence>(positioning.evidence);
  const verified = evidence.filter((e) => e?.verified === true);
  const verifiedStrength = verified.length > 0
    ? verified.reduce((sum, e) => sum + clamp01(safeNum(e.strength, 0)), 0) / verified.length
    : 0;
  if (evidence.length === 0) gaps.push("no supporting evidence");
  if (verified.length === 0) gaps.push("no verified evidence");

  const diffs = safeArr<string>(positioning.differentiators);
  if (diffs.length === 0) gaps.push("no differentiators listed");
  const diffScore = Math.min(diffs.length, 5) / 5;

  const risks = safeArr<string>(positioning.risks);
  const riskAdj = Math.max(0, Math.min(10, 10 - risks.length)) / 10;

  const score = Math.max(
    0,
    Math.min(
      100,
      0.6 * (verifiedStrength * 100) + 0.3 * (diffScore * 100) + 0.1 * (riskAdj * 100),
    ),
  );
  return { score, gaps };
}

/**
 * Return the list of differentiators attached to a positioning record.
 * Returns an empty array when the positioning is invalid or has no
 * differentiators.
 */
export function getDifferentiation(positioning: Positioning): string[] {
  if (!positioning || !Array.isArray(positioning.differentiators)) return [];
  return positioning.differentiators.filter(
    (d): d is string => typeof d === "string" && d.trim() !== "",
  );
}

/**
 * Validate a `Positioning`:
 *   - `id`, `promise`, `audience`, `category` must be non-empty strings
 *   - `evidence` must be an array of well-formed evidence items
 *   - `differentiators` must be an array of non-empty strings
 *   - `risks` (if set) must be an array of strings
 *
 * Returns `{ valid, errors }`.
 */
export function validatePositioning(p: Positioning): PositioningValidation {
  const errors: string[] = [];
  if (!p || typeof p !== "object") {
    return { valid: false, errors: ["positioning must be an object"] };
  }
  for (const field of ["id", "promise", "audience", "category"] as const) {
    if (typeof p[field] !== "string" || p[field].trim() === "") {
      errors.push(`${field} must be a non-empty string`);
    }
  }
  if (!Array.isArray(p.evidence)) {
    errors.push("evidence must be an array");
  } else {
    p.evidence.forEach((e, i) => {
      if (!e || typeof e !== "object") {
        errors.push(`evidence[${i}] must be an object`);
        return;
      }
      if (typeof e.id !== "string" || e.id.trim() === "") {
        errors.push(`evidence[${i}].id must be a non-empty string`);
      }
      if (typeof e.strength !== "number" || !Number.isFinite(e.strength) || e.strength < 0 || e.strength > 1) {
        errors.push(`evidence[${i}].strength must be a number in [0, 1]`);
      }
    });
  }
  if (!Array.isArray(p.differentiators)) {
    errors.push("differentiators must be an array");
  } else {
    p.differentiators.forEach((d, i) => {
      if (typeof d !== "string" || d.trim() === "") {
        errors.push(`differentiators[${i}] must be a non-empty string`);
      }
    });
  }
  if (p.risks !== undefined) {
    if (!Array.isArray(p.risks)) {
      errors.push("risks must be an array");
    } else {
      p.risks.forEach((r, i) => {
        if (typeof r !== "string") {
          errors.push(`risks[${i}] must be a string`);
        }
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

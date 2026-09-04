/**
 * Pure lead-scoring utilities.
 *
 * A lead score is a weighted sum of attribute contributions (e.g. company
 * size, engagement recency, source quality) clamped to `[0, 100]`. The score
 * maps to a letter grade (A/B/C/D) and to a priority (`high`/`medium`/`low`)
 * that downstream systems can route on.
 *
 * No I/O, no side effects, deterministic.
 */

export interface LeadScoreInput {
  /** Stable identifier for the lead. */
  leadId: string;
  /** Attribute contributions; each `weight * value` is added to the total. */
  attributes: LeadScoreAttribute[];
  /** Optional bonus added after weighting (e.g. tier-1 account flag). */
  bonus?: number;
}

export interface LeadScoreAttribute {
  /** Attribute name (for tracing). */
  name: string;
  /** Raw value, typically in `[0, 1]` or `[0, 10]`. */
  value: number;
  /** Weight applied to the value. */
  weight: number;
  /** Optional cap on the contribution of this single attribute. */
  cap?: number;
}

export interface LeadScore {
  leadId: string;
  /** Final score in `[0, 100]`. */
  score: number;
  /** Letter grade A/B/C/D. */
  grade: LeadGrade;
  /** Routing priority derived from the grade. */
  priority: LeadPriority;
  /** Per-attribute contribution trace. */
  contributions: Array<{ name: string; contribution: number }>;
}

export type LeadGrade = "A" | "B" | "C" | "D";
export type LeadPriority = "high" | "medium" | "low";

function safeNumber(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return n;
}

/**
 * Calculate a lead's score by summing `weight * value` per attribute,
 * applying each attribute's optional `cap`, adding the bonus, and clamping
 * the result to `[0, 100]`. Also returns the grade, priority, and a
 * per-attribute contribution trace.
 */
export function calculateScore(input: LeadScoreInput): LeadScore {
  const leadId = input?.leadId ?? "";
  const attributes = Array.isArray(input?.attributes) ? input.attributes : [];
  const bonus = Math.max(0, safeNumber(input?.bonus));
  const contributions: Array<{ name: string; contribution: number }> = [];
  let total = 0;
  for (const attr of attributes) {
    const value = safeNumber(attr?.value);
    const weight = safeNumber(attr?.weight);
    let contribution = value * weight;
    if (typeof attr?.cap === "number" && Number.isFinite(attr.cap)) {
      contribution = Math.min(contribution, attr.cap);
    }
    contributions.push({ name: attr?.name ?? "", contribution });
    total += contribution;
  }
  total += bonus;
  const score = Math.max(0, Math.min(100, total));
  const grade = getGrade(score);
  const priority = getPriority(grade);
  return { leadId, score, grade, priority, contributions };
}

/**
 * Map a numeric score to a letter grade.
 *   A: 80–100, B: 60–79, C: 40–59, D: 0–39
 */
export function getGrade(score: number): LeadGrade {
  const s = safeNumber(score);
  if (s >= 80) return "A";
  if (s >= 60) return "B";
  if (s >= 40) return "C";
  return "D";
}

/**
 * Map a letter grade to a routing priority.
 *   A → high, B → high, C → medium, D → low
 *
 * Accepts either a `LeadGrade` or a numeric score (which is converted via
 * `getGrade`).
 */
export function getPriority(grade: LeadGrade | number): LeadPriority {
  const g: LeadGrade = typeof grade === "number" ? getGrade(grade) : grade;
  switch (g) {
    case "A":
    case "B":
      return "high";
    case "C":
      return "medium";
    case "D":
    default:
      return "low";
  }
}

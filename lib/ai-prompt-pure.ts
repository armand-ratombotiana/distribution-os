/**
 * Pure AI prompt-template utilities.
 *
 * A `PromptTemplate` is a string with `{{variable}}` placeholders plus
 * metadata describing intent and required variables. `buildPrompt` does the
 * Mustache-style substitution; `validatePrompt` checks that every required
 * variable is present in the template and that no unknown placeholders
 * remain; `extractVariables` returns the deduplicated list of placeholders.
 *
 * No I/O, no side effects, deterministic.
 */

export type PromptRole = "system" | "user" | "assistant";

export interface PromptTemplate {
  /** Stable identifier for the template (e.g. "mission-brief"). */
  id: string;
  /** Optional human-readable label. */
  label?: string;
  /** Conversation role the rendered prompt is intended for. */
  role?: PromptRole;
  /** Template string with `{{variable}}` placeholders. */
  template: string;
  /** Variable names the template is expected to consume. */
  variables: string[];
  /** Optional max-length cap on the rendered prompt. */
  maxLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function safeString(s: unknown): string {
  if (typeof s !== "string") return "";
  return s;
}

/**
 * Extract the deduplicated list of `{{variable}}` placeholders from a
 * template string, in first-occurrence order. Returns an empty array for
 * invalid or placeholder-free input.
 */
export function extractVariables(template: string): string[] {
  const t = safeString(template);
  if (!t) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(t)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Render a template by substituting `{{variable}}` placeholders with the
 * values in `variables`. Missing variables are replaced with the empty
 * string. Throws neither on missing variables nor on malformed templates.
 */
export function buildPrompt(
  template: PromptTemplate | string,
  variables: Record<string, unknown> = {},
): string {
  const tpl = typeof template === "string" ? template : safeString(template?.template);
  if (!tpl) return "";
  const vars = (variables && typeof variables === "object") ? variables : {};
  return tpl.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const v = vars[name];
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
      return String(v);
    }
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  });
}

/**
 * Validate a `PromptTemplate`:
 *   - `template` must be a non-empty string
 *   - every declared variable must appear as `{{var}}` in the template
 *   - every `{{var}}` placeholder in the template must be declared
 *   - `id` must be a non-empty string
 *   - if `maxLength` is set, the rendered template must not exceed it
 *     (with an empty variable map)
 *
 * Returns `{ valid, errors }`.
 */
export function validatePrompt(template: PromptTemplate): ValidationResult {
  const errors: string[] = [];
  if (!template || typeof template !== "object") {
    return { valid: false, errors: ["template must be an object"] };
  }
  if (typeof template.id !== "string" || template.id.trim() === "") {
    errors.push("id must be a non-empty string");
  }
  if (typeof template.template !== "string" || template.template.trim() === "") {
    errors.push("template must be a non-empty string");
  } else {
    const declared = Array.isArray(template.variables) ? template.variables : [];
    const declaredSet = new Set<string>();
    for (const v of declared) {
      if (typeof v !== "string" || v.trim() === "") {
        errors.push(`invalid variable name: ${String(v)}`);
        continue;
      }
      declaredSet.add(v);
    }
    const present = new Set(extractVariables(template.template));
    for (const name of declaredSet) {
      if (!present.has(name)) {
        errors.push(`declared variable "${name}" is missing from the template`);
      }
    }
    for (const name of present) {
      if (!declaredSet.has(name)) {
        errors.push(`template variable "${name}" is not declared`);
      }
    }
    if (typeof template.maxLength === "number" && Number.isFinite(template.maxLength)) {
      if (template.maxLength < 0) {
        errors.push("maxLength must be non-negative");
      } else if (template.template.length > template.maxLength) {
        errors.push(
          `template length ${template.template.length} exceeds maxLength ${template.maxLength}`,
        );
      }
    }
  }
  if (template.role !== undefined && !["system", "user", "assistant"].includes(template.role)) {
    errors.push(`invalid role: ${String(template.role)}`);
  }
  return { valid: errors.length === 0, errors };
}

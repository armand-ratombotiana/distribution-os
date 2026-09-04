/**
 * Pure AI response-parsing utilities.
 *
 * Model responses frequently arrive as JSON embedded in markdown code
 * fences with prose around them. `parseJsonResponse` extracts and parses
 * that JSON defensively; `extractCitations` walks the text for `[1]`,
 * `[2]`-style references and returns them as a deduplicated list;
 * `validateStructuredOutput` checks that a parsed payload conforms to a
 * minimal field-shape schema.
 *
 * No I/O, no side effects, deterministic.
 */

export interface ParsedResponse<T = unknown> {
  /** Whether the JSON was successfully extracted and parsed. */
  ok: boolean;
  /** The parsed value when `ok`, otherwise `null`. */
  data: T | null;
  /** Human-readable error message when `!ok`, otherwise `null`. */
  error: string | null;
  /** The raw input string. */
  raw: string;
}

export interface Citation {
  /** 1-based citation index, as it appears in the text. */
  index: number;
  /** Number of times this citation is referenced. */
  count: number;
}

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object";

export interface StructuredFieldSpec {
  type: FieldType;
  required?: boolean;
}

export type StructuredSchema = Record<string, StructuredFieldSpec>;

export interface ValidationOutcome {
  valid: boolean;
  errors: string[];
}

const CODE_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/gi;
const CITATION_RE = /\[(\d{1,4})\]/g;

function safeStr(s: unknown): string {
  return typeof s === "string" ? s : "";
}

/**
 * Strip a single pair of surrounding quotes from a string. Used to clean
 * up `"true"`/`"false"`/`"123"` before coercion to a primitive.
 */
function trimQuotes(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

/**
 * Extract the first JSON-looking substring from `text`. Tries (in order):
 *   1. The first ```json … ``` or ``` … ``` code fence.
 *   2. The first balanced `{ … }` or `[ … ]` substring.
 *
 * Returns the empty string when nothing JSON-shaped is found.
 */
export function extractJsonSubstring(text: string): string {
  const t = safeStr(text);
  if (!t) return "";
  CODE_FENCE_RE.lastIndex = 0;
  const fence = CODE_FENCE_RE.exec(t);
  if (fence && fence[1]) {
    return fence[1].trim();
  }
  // Find the first '{' or '[' and walk to its matching close.
  const start = t.search(/[\[{]/);
  if (start === -1) return "";
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }
  return "";
}

/**
 * Parse a model response into a typed value. Tolerates leading/trailing
 * prose, markdown code fences, and JSON wrapped in extra quotes. Never
 * throws — on any failure it returns `{ ok: false, data: null, error }`.
 */
export function parseJsonResponse<T = unknown>(text: string): ParsedResponse<T> {
  const raw = safeStr(text);
  if (!raw) {
    return { ok: false, data: null, error: "empty input", raw };
  }
  let candidate = extractJsonSubstring(raw);
  if (!candidate) candidate = raw.trim();
  candidate = trimQuotes(candidate);
  try {
    const data = JSON.parse(candidate) as T;
    return { ok: true, data, error: null, raw };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      raw,
    };
  }
}

/**
 * Walk `text` and return every `[n]` citation in order, deduplicated by
 * index. The returned list is sorted ascending by `index`; each entry's
 * `count` records how many times that citation appears in the text.
 */
export function extractCitations(text: string): Citation[] {
  const t = safeStr(text);
  if (!t) return [];
  const counts = new Map<number, number>();
  CITATION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_RE.exec(t)) !== null) {
    const idx = parseInt(m[1], 10);
    if (!Number.isFinite(idx) || idx < 1) continue;
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, count]) => ({ index, count }));
}

function typeOf(v: unknown): FieldType {
  if (Array.isArray(v)) return "array";
  if (v === null) return "object"; // typeof null === "object"; treat as missing-object
  return typeof v as FieldType;
}

/**
 * Validate that `data` conforms to `schema`. For each field, the value
 * must be present (when `required`) and have a type compatible with the
 * spec. Unknown fields are tolerated. Returns `{ valid, errors }`.
 */
export function validateStructuredOutput(
  data: unknown,
  schema: StructuredSchema,
): ValidationOutcome {
  const errors: string[] = [];
  if (!schema || typeof schema !== "object") {
    return { valid: false, errors: ["schema must be an object"] };
  }
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["data must be a non-null object"] };
  }
  const obj = data as Record<string, unknown>;
  for (const [field, spec] of Object.entries(schema)) {
    if (!spec || typeof spec !== "object") {
      errors.push(`invalid spec for field "${field}"`);
      continue;
    }
    const has = Object.prototype.hasOwnProperty.call(obj, field);
    const v = obj[field];
    if (v === undefined || v === null) {
      if (spec.required) {
        errors.push(`required field "${field}" is missing`);
      }
      continue;
    }
    const actual = typeOf(v);
    if (actual !== spec.type) {
      errors.push(
        `field "${field}" has type "${actual}", expected "${spec.type}"`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pure content-template utilities.
 *
 * Provides simple `{{var}}` string interpolation plus helpers to extract
 * referenced variables and validate that a template is well-formed.
 *
 * - No I/O, no side effects, deterministic.
 * - Supports dotted paths (e.g. `{{user.name}}`).
 * - Supports a `{{var|default}}` fallback syntax.
 * - Unknown variables with no default are rendered as the empty string.
 */

export type TemplateContext = Record<string, unknown>;

export interface ValidateTemplateResult {
  ok: boolean;
  /** Distinct variable names referenced in the template (without defaults). */
  variables: string[];
  /** List of malformed placeholder errors. */
  errors: string[];
}

const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

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

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Render a template by replacing every `{{var}}` placeholder with the
 * matching value from `context`. Supports dotted paths and a `|default`
 * fallback. Unknown variables render as the empty string.
 */
export function renderTemplate(
  template: string,
  context: TemplateContext = {},
): string {
  if (typeof template !== "string") return "";
  return template.replace(PLACEHOLDER_RE, (raw: string, body: string) => {
    const [pathPart, ...defaultParts] = body.split("|");
    const path = pathPart.trim();
    if (!path) return "";
    let value = readPath(context, path);
    if (value === undefined && defaultParts.length > 0) {
      value = defaultParts.join("|");
    }
    return stringify(value);
  });
}

/**
 * Extract the distinct variable names referenced by a template. The returned
 * names exclude any `|default` portion. Returns an empty array when the
 * template is empty or contains no placeholders.
 */
export function extractVariables(template: string): string[] {
  if (typeof template !== "string" || template.length === 0) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    const body = m[1];
    const path = body.split("|")[0].trim();
    if (path) out.add(path);
  }
  return Array.from(out);
}

/**
 * Validate that a template is well-formed:
 *   - every `{{` has a matching `}}`
 *   - placeholder bodies are non-empty
 *   - no placeholder uses a key path with whitespace inside a segment
 *
 * Returns `{ ok, variables, errors }`. `ok` is `true` when `errors` is empty.
 */
export function validateTemplate(template: string): ValidateTemplateResult {
  const errors: string[] = [];
  const variables = new Set<string>();
  if (typeof template !== "string") {
    return { ok: false, variables: [], errors: ["Template must be a string"] };
  }
  // Scan for unbalanced braces.
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      // Any trailing single `}}` without an opening pair is malformed.
      if (template.indexOf("}}", i) !== -1) {
        errors.push("Unmatched closing }} at offset " + template.indexOf("}}", i));
      }
      break;
    }
    const close = template.indexOf("}}", open + 2);
    if (close === -1) {
      errors.push(`Unmatched opening {{ at offset ${open}`);
      break;
    }
    const body = template.slice(open + 2, close);
    const trimmed = body.trim();
    if (!trimmed) {
      errors.push(`Empty placeholder at offset ${open}`);
      i = close + 2;
      continue;
    }
    const pathPart = trimmed.split("|")[0].trim();
    if (!pathPart) {
      errors.push(`Placeholder missing variable name at offset ${open}`);
    } else {
      // Disallow whitespace inside a path segment like `user first name`.
      const badSegment = pathPart
        .split(".")
        .some((seg) => seg.length === 0 || /\s/.test(seg));
      if (badSegment) {
        errors.push(`Invalid variable path "${pathPart}" at offset ${open}`);
      } else {
        variables.add(pathPart);
      }
    }
    i = close + 2;
  }
  return {
    ok: errors.length === 0,
    variables: Array.from(variables),
    errors,
  };
}

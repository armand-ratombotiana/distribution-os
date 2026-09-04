/**
 * Pure validation + sanitization helpers. All functions are side-effect free
 * and return either a sanitized value or a structured ValidationResult.
 */

export type ValidationResult<T = unknown> = {
  ok: boolean;
  value?: T;
  error?: string;
};

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail(error: string): ValidationResult<never> {
  return { ok: false, error };
}

export type StringOptions = {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  /** When false, undefined/null values pass as empty string. Default true. */
  required?: boolean;
};

/** Validates a string against length and pattern constraints. */
export function validateString(
  value: unknown,
  options: StringOptions = {},
): ValidationResult<string> {
  if (value === undefined || value === null) {
    if (options.required === false) return ok("");
    return fail("Value is required");
  }
  if (typeof value !== "string") {
    return fail("Value must be a string");
  }
  if (options.minLength !== undefined && value.length < options.minLength) {
    return fail(`String must be at least ${options.minLength} characters`);
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return fail(`String must be at most ${options.maxLength} characters`);
  }
  if (options.pattern !== undefined && !options.pattern.test(value)) {
    return fail("String does not match required pattern");
  }
  return ok(value);
}

export type NumberOptions = {
  min?: number;
  max?: number;
  integer?: boolean;
};

/** Validates a number, optionally accepting numeric strings. */
export function validateNumber(
  value: unknown,
  options: NumberOptions = {},
): ValidationResult<number> {
  let candidate = value;
  if (typeof candidate === "string" && candidate.trim() !== "") {
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed)) candidate = parsed;
  }
  if (typeof candidate !== "number" || Number.isNaN(candidate)) {
    return fail("Value must be a number");
  }
  if (options.integer && !Number.isInteger(candidate)) {
    return fail("Value must be an integer");
  }
  if (options.min !== undefined && candidate < options.min) {
    return fail(`Value must be at least ${options.min}`);
  }
  if (options.max !== undefined && candidate > options.max) {
    return fail(`Value must be at most ${options.max}`);
  }
  return ok(candidate);
}

/** Validates that a value is an integer within optional bounds. */
export function validateInteger(
  value: unknown,
  options: { min?: number; max?: number } = {},
): ValidationResult<number> {
  return validateNumber(value, { ...options, integer: true });
}

/** Validates that a value is one of an allowed set of strings. */
export function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): ValidationResult<T> {
  if (typeof value !== "string") {
    return fail("Value must be a string");
  }
  if (!allowed.includes(value as T)) {
    return fail(`Value must be one of: ${allowed.join(", ")}`);
  }
  return ok(value as T);
}

const URL_PROTOCOLS = new Set(["http:", "https:"]);

/** Validates that a value is an http(s) URL. Returns the normalized href. */
export function validateUrl(value: unknown): ValidationResult<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return fail("Value must be a URL string");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail("Value must be a valid URL");
  }
  if (!URL_PROTOCOLS.has(url.protocol)) {
    return fail("URL must use http or https protocol");
  }
  return ok(url.toString());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates that a value is a syntactically valid email address. */
export function validateEmail(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return fail("Value must be a string");
  }
  if (!EMAIL_RE.test(value)) {
    return fail("Value must be a valid email address");
  }
  return ok(value);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates that a value is a canonical UUID. Returns the lowercased form. */
export function validateUuid(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return fail("Value must be a string");
  }
  if (!UUID_RE.test(value)) {
    return fail("Value must be a valid UUID");
  }
  return ok(value.toLowerCase());
}

/** Validates that `start` and `end` form a coherent date range. */
export function validateDateRange(
  start: unknown,
  end: unknown,
): ValidationResult<{ start: Date; end: Date }> {
  const startDate = coerceDate(start);
  if (startDate === null) return fail("Start must be a valid date");
  const endDate = coerceDate(end);
  if (endDate === null) return fail("End must be a valid date");
  if (startDate.getTime() > endDate.getTime()) {
    return fail("Start date must be before or equal to end date");
  }
  return ok({ start: startDate, end: endDate });
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Validates that a value parses as JSON. Returns the parsed value. */
export function validateJsonString(value: unknown): ValidationResult<unknown> {
  if (typeof value !== "string") {
    return fail("Value must be a string");
  }
  try {
    return ok(JSON.parse(value));
  } catch {
    return fail("Value must be valid JSON");
  }
}

/** Strips control characters and collapses whitespace in a string. */
export function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes HTML-special characters to prevent injection. */
export function sanitizeHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** Truncates a string to `max` characters, appending an ellipsis suffix. */
export function truncate(value: string, max: number, suffix = "…"): string {
  if (typeof value !== "string") return "";
  if (max <= 0) return "";
  if (value.length <= max) return value;
  if (max <= suffix.length) return suffix.slice(0, max);
  return value.slice(0, max - suffix.length) + suffix;
}

/** Converts a string to a URL-safe slug. */
export function slugify(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type MaskOptions = {
  /** Number of characters kept visible at the start. */
  visibleStart?: number;
  /** Number of characters kept visible at the end. */
  visibleEnd?: number;
  /** Character used to mask the sensitive middle section. */
  char?: string;
  /** Minimum number of mask characters emitted. */
  minMaskLength?: number;
};

/** Masks the middle of a sensitive string, leaving start/end visible. */
export function maskSensitive(value: string, options: MaskOptions = {}): string {
  if (typeof value !== "string") return "";
  const {
    visibleStart = 2,
    visibleEnd = 2,
    char = "*",
    minMaskLength = 4,
  } = options;
  if (value.length === 0) return "";
  if (value.length <= visibleStart + visibleEnd) {
    return char.repeat(Math.max(minMaskLength, value.length));
  }
  const start = value.slice(0, visibleStart);
  const end = value.slice(value.length - visibleEnd);
  const maskLen = Math.max(
    minMaskLength,
    value.length - visibleStart - visibleEnd,
  );
  return `${start}${char.repeat(maskLen)}${end}`;
}

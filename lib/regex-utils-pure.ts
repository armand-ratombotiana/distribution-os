/**
 * Pure regex utility helpers. No DOM or runtime dependencies.
 * All regex objects are constructed lazily / cached on the module scope.
 */

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/** Escapes a string so that RegExp(string) matches it literally. */
export function escapeRegex(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`escapeRegex expects a string, received ${typeof input}`);
  }
  return input.replace(REGEX_SPECIAL_CHARS, "\\$&");
}

/**
 * Builds a permissive email-validation regex. Matches the common form
 * `local-part@domain.tld` where the TLD is at least 2 letters.
 */
export function buildEmailRegex(): RegExp {
  // Local part: alphanumeric + . _ % + - ; not starting/ending with dot.
  // Domain: labels of alphanumeric + hyphen, separated by dots; TLD ≥ 2 alpha.
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
}

/**
 * Builds an HTTP(S) URL-validation regex. Requires a scheme, host, and
 * optional port/path/query/fragment.
 */
export function buildUrlRegex(): RegExp {
  return /^https?:\/\/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+(?::\d{1,5})?(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#[^\s]*)?$/;
}

/**
 * Builds a phone-number regex that accepts:
 *   - optional leading +
 *   - digits, spaces, dashes, and parentheses
 *   - 7 to 15 digits total
 */
export function buildPhoneRegex(): RegExp {
  return /^\+?[\d\s().-]{7,22}$/;
}

/**
 * Tests whether `input` fully matches `pattern`. The pattern may be supplied
 * as either a RegExp or a string (which is escaped and anchored).
 */
export function testPattern(pattern: RegExp | string, input: string): boolean {
  if (typeof input !== "string") return false;
  if (pattern instanceof RegExp) {
    const re = pattern.global || pattern.source.startsWith("^")
      ? pattern
      : new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace("g", ""));
    return re.test(input);
  }
  if (typeof pattern === "string") {
    return new RegExp(`^${escapeRegex(pattern)}$`).test(input);
  }
  throw new TypeError("testPattern expects a RegExp or string pattern");
}

/**
 * Returns all matches of `pattern` in `input`. Each entry is the full match
 * string. When `pattern` is a string it is escaped so it matches literally.
 */
export function extractMatches(
  pattern: RegExp | string,
  input: string,
): string[] {
  if (typeof input !== "string") return [];
  const re =
    pattern instanceof RegExp
      ? new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
      : new RegExp(escapeRegex(pattern), "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    out.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

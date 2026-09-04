/**
 * Pure string utility functions. All functions are side-effect free and
 * do not mutate their inputs.
 */

/**
 * Capitalize the first character of `value` and lower-case the rest.
 *   capitalize("hello")  // "Hello"
 *   capitalize("HELLO")  // "Hello"
 *   capitalize("")       // ""
 */
export function capitalize(value: string): string {
  if (typeof value !== "string" || value.length === 0) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * Split `value` into words (camelCase, kebab-case, snake_case, and
 * whitespace/punctuation boundaries) and return the cleaned array.
 */
function splitWords(value: string): string[] {
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    // Insert spaces at camelCase / PascalCase boundaries.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // Insert spaces at consecutive uppercase + lowercase ("HTTPServer" -> "HTTP Server").
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // Replace separators with spaces.
    .replace(/[-_./\\]+/g, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Convert `value` to camelCase.
 *   camelCase("hello world")  // "helloWorld"
 *   camelCase("foo-bar_baz")  // "fooBarBaz"
 *   camelCase("HTTPServer")   // "httpServer"
 */
export function camelCase(value: string): string {
  const words = splitWords(value);
  if (words.length === 0) return "";
  return words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}

/**
 * Convert `value` to kebab-case.
 *   kebabCase("hello world")  // "hello-world"
 *   kebabCase("fooBar")       // "foo-bar"
 */
export function kebabCase(value: string): string {
  return splitWords(value)
    .map((w) => w.toLowerCase())
    .join("-");
}

/**
 * Convert `value` to snake_case.
 *   snakeCase("hello world")  // "hello_world"
 *   snakeCase("foo-bar")      // "foo_bar"
 */
export function snakeCase(value: string): string {
  return splitWords(value)
    .map((w) => w.toLowerCase())
    .join("_");
}

/**
 * Convert `value` to Title Case (every word capitalized).
 *   titleCase("hello world")  // "Hello World"
 *   titleCase("foo-bar_baz")  // "Foo Bar Baz"
 */
export function titleCase(value: string): string {
  return splitWords(value)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Truncate `value` to `max` characters and append `suffix` if truncation
 * occurred. The returned string is never longer than `max` characters.
 *
 *   truncate("hello world", 8)       // "hello w…"
 *   truncate("hello world", 8, "...")// "hello..."
 *   truncate("short", 10)            // "short"
 */
export function truncate(
  value: string,
  max: number,
  suffix: string = "…",
): string {
  if (typeof value !== "string") return "";
  if (!Number.isInteger(max) || max <= 0) return "";
  if (value.length <= max) return value;
  if (max <= suffix.length) return suffix.slice(0, max);
  return value.slice(0, max - suffix.length) + suffix;
}

/**
 * Pad `value` with `char` to reach `length`. When `align` is `"left"` the
 * padding is added on the right (text aligned left); when `"right"` on the
 * left; when `"center"` evenly on both sides. Default `align` is `"left"`.
 *
 *   pad("abc", 6)                 // "abc   "
 *   pad("abc", 6, "0", "right")   // "000abc"
 *   pad("abc", 7, "-", "center")  // "--abc--"
 */
export function pad(
  value: string,
  length: number,
  char: string = " ",
  align: "left" | "right" | "center" = "left",
): string {
  if (typeof value !== "string") return "";
  if (!Number.isInteger(length) || length < 0) return value;
  if (value.length >= length) return value;
  if (char.length !== 1) {
    throw new Error("pad: char must be a single character");
  }
  const missing = length - value.length;
  if (align === "left") {
    return value + char.repeat(missing);
  }
  if (align === "right") {
    return char.repeat(missing) + value;
  }
  const left = Math.floor(missing / 2);
  const right = missing - left;
  return char.repeat(left) + value + char.repeat(right);
}

/**
 * Reverse the characters in `value`. Handles surrogate pairs by reversing
 * code-point-wise so multi-byte characters stay intact.
 *
 *   reverse("hello")  // "olleh"
 *   reverse("ab😊cd")  // "dc😊ba"
 */
export function reverse(value: string): string {
  if (typeof value !== "string" || value.length === 0) return "";
  // Use the iterator on the string, which iterates over code points.
  return Array.from(value).reverse().join("");
}

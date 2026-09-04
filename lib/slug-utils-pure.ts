/**
 * Pure slug utility helpers — convert free-form text to URL-safe slugs,
 * turn a slug back into a readable phrase, ensure uniqueness against an
 * existing set, and validate slug formatting.
 */

const SLUG_SEPARATOR = "-";
const SLUG_VALID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalizes arbitrary text into a URL-safe slug. */
export function slugify(input: string, options: { maxLength?: number } = {}): string {
  if (typeof input !== "string") {
    throw new TypeError(`slugify expects a string, received ${typeof input}`);
  }
  // Decompose accents (NFD) then strip combining marks.
  const decomposed = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = decomposed.toLowerCase().trim();
  // Replace any run of non [a-z0-9] with a single dash.
  let slug = lower.replace(/[^a-z0-9]+/g, SLUG_SEPARATOR);
  // Trim leading/trailing dashes.
  slug = slug.replace(/^-+|-+$/g, "");
  if (options.maxLength && Number.isFinite(options.maxLength) && options.maxLength > 0) {
    slug = slug.slice(0, options.maxLength).replace(/-+$/g, "");
  }
  return slug;
}

/** Converts a slug back into a human-readable, space-separated phrase. */
export function deslugify(slug: string): string {
  if (typeof slug !== "string" || slug.length === 0) return "";
  // Insert a space before each capital that follows a lowercase (for camelCase),
  // then replace dashes/underscores with spaces.
  const spaced = slug
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (spaced.length === 0) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Returns `slug` if it's not already in `existing`. Otherwise appends a
 * numeric suffix (-2, -3, …) until a unique value is found.
 */
export function ensureUniqueSlug(
  slug: string,
  existing: ReadonlySet<string> | ReadonlyArray<string>,
): string {
  if (typeof slug !== "string" || slug.length === 0) {
    throw new Error("ensureUniqueSlug: slug must be a non-empty string");
  }
  const set = existing instanceof Set ? existing : new Set(existing);
  if (!set.has(slug)) return slug;
  let n = 2;
  while (set.has(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

/** Returns true when `slug` matches the strict kebab-case format. */
export function validateSlugFormat(slug: string): boolean {
  if (typeof slug !== "string") return false;
  return SLUG_VALID_RE.test(slug);
}

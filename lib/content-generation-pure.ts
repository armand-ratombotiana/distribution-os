/**
 * Pure content-generation utilities.
 *
 * A `ContentDraft` is a piece of marketing copy with a headline, body,
 * optional hook, CTA, and a list of platforms it is intended for. This
 * module validates drafts, extracts hook sentences (the first sentence of
 * the body or the explicit `hook` field), and reformats a draft for a
 * given platform (truncating to the platform's character limit and
 * appending the CTA when room allows).
 *
 * No I/O, no side effects, deterministic.
 */

export type Platform = "twitter" | "linkedin" | "blog" | "email" | "instagram";

export interface ContentDraft {
  /** Stable identifier. */
  id: string;
  /** Headline / title. */
  headline: string;
  /** Body copy, plain text. */
  body: string;
  /** Optional hook (defaults to the first sentence of `body`). */
  hook?: string;
  /** Call-to-action text. */
  cta?: string;
  /** Platforms this draft is intended for. */
  platforms: Platform[];
}

export interface DraftValidation {
  valid: boolean;
  errors: string[];
}

export interface PlatformLimits {
  /** Maximum body length (in characters) for the platform. */
  body: number;
  /** Maximum headline length (in characters). */
  headline: number;
}

const PLATFORM_LIMITS: Record<Platform, PlatformLimits> = {
  twitter: { body: 280, headline: 280 },
  linkedin: { body: 3000, headline: 220 },
  blog: { body: 50000, headline: 120 },
  email: { body: 20000, headline: 100 },
  instagram: { body: 2200, headline: 125 },
};

const KNOWN_PLATFORMS: ReadonlySet<Platform> = new Set([
  "twitter",
  "linkedin",
  "blog",
  "email",
  "instagram",
]);

function safeStr(s: unknown): string {
  return typeof s === "string" ? s : "";
}

/**
 * Split a body of text into sentences. A sentence ends at `.`, `!`, or `?`
 * followed by whitespace or end-of-string. Returns the trimmed sentences.
 */
function splitSentences(text: string): string[] {
  const t = safeStr(text).trim();
  if (!t) return [];
  // Split on punctuation followed by whitespace or end-of-string.
  const parts = t.split(/(?<=[.!?])\s+/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Extract the hook from a draft — the explicit `hook` field if present,
 * otherwise the first sentence of `body`. Returns the empty string when
 * neither is available.
 */
export function extractHook(draft: ContentDraft): string {
  if (!draft) return "";
  const explicit = safeStr(draft.hook).trim();
  if (explicit) return explicit;
  const first = splitSentences(draft.body)[0];
  return first ?? "";
}

/**
 * Validate a `ContentDraft`:
 *   - `id`, `headline`, `body` must be non-empty strings
 *   - `platforms` must be a non-empty array of known platforms
 *   - `headline` must not exceed the smallest platform's headline limit
 *
 * Returns `{ valid, errors }`.
 */
export function validateDraft(draft: ContentDraft): DraftValidation {
  const errors: string[] = [];
  if (!draft || typeof draft !== "object") {
    return { valid: false, errors: ["draft must be an object"] };
  }
  if (typeof draft.id !== "string" || draft.id.trim() === "") {
    errors.push("id must be a non-empty string");
  }
  if (typeof draft.headline !== "string" || draft.headline.trim() === "") {
    errors.push("headline must be a non-empty string");
  }
  if (typeof draft.body !== "string" || draft.body.trim() === "") {
    errors.push("body must be a non-empty string");
  }
  if (!Array.isArray(draft.platforms) || draft.platforms.length === 0) {
    errors.push("platforms must be a non-empty array");
  } else {
    for (const p of draft.platforms) {
      if (!KNOWN_PLATFORMS.has(p)) {
        errors.push(`unknown platform: ${String(p)}`);
      }
    }
  }
  if (typeof draft.headline === "string" && Array.isArray(draft.platforms) && draft.platforms.length > 0) {
    const minHeadline = Math.min(
      ...draft.platforms.map((p) => PLATFORM_LIMITS[p]?.headline ?? Infinity),
    );
    if (Number.isFinite(minHeadline) && draft.headline.length > minHeadline) {
      errors.push(
        `headline length ${draft.headline.length} exceeds smallest platform limit ${minHeadline}`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Truncate `text` to at most `max` characters, breaking on a word
 * boundary when possible. If truncation occurs, appends the ellipsis
 * character `"…"` (so the returned string is at most `max` chars long,
 * including the ellipsis).
 */
function smartTruncate(text: string, max: number): string {
  const t = safeStr(text);
  if (max <= 0) return "";
  if (t.length <= max) return t;
  if (max === 1) return "…";
  const slice = t.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(max * 0.5) ? slice.slice(0, lastSpace) : slice;
  return cut + "…";
}

/**
 * Format a draft for a specific platform. The output combines the
 * headline and body, separated by a blank line; truncates each to the
 * platform's limit; appends the CTA (on its own line) when there is
 * room. Returns the empty string for unknown platforms.
 */
export function formatForPlatform(
  draft: ContentDraft,
  platform: Platform,
): string {
  if (!draft || !KNOWN_PLATFORMS.has(platform)) return "";
  const limits = PLATFORM_LIMITS[platform];
  const headline = smartTruncate(safeStr(draft.headline).trim(), limits.headline);
  const cta = safeStr(draft.cta).trim();
  const ctaLine = cta ? `\n\n${cta}` : "";
  const ctaBudget = ctaLine.length;
  const bodyBudget = limits.body - headline.length - ctaBudget - 2; // 2 for "\n\n"
  if (bodyBudget <= 0) {
    // headline + cta already use up the budget — return headline only
    return smartTruncate(headline, limits.body);
  }
  const body = smartTruncate(safeStr(draft.body).trim(), bodyBudget);
  const out = body ? `${headline}\n\n${body}${cta ? `\n\n${cta}` : ""}` : `${headline}${ctaLine}`;
  // Final safety clamp: never exceed limits.body
  return out.length > limits.body ? out.slice(0, limits.body) : out;
}

/**
 * Return the per-platform limits for a known platform, or `null` for
 * unknown platforms.
 */
export function getPlatformLimits(platform: Platform): PlatformLimits | null {
  return KNOWN_PLATFORMS.has(platform) ? PLATFORM_LIMITS[platform] : null;
}

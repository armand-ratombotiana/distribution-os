/**
 * Pure (no I/O, no global mutation) helpers for sanitising external content
 * before it is fed into a language model.
 *
 * The goal is twofold:
 *   1. Strip HTML/markup so the model sees clean text.
 *   2. Neutralise the small but high-signal set of prompt-injection /
 *      channel-confusion patterns that have historically been used to smuggle
 *      instructions or active content through scraped pages.
 *
 * Every function here is deterministic and side-effect free so it can be
 * unit-tested in isolation and run inside any runtime (Node, Workers).
 */

interface InjectionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * The twelve injection / smuggling patterns neutralised by
 * {@link sanitizeForModel}. Each entry targets a distinct attack surface so
 * that adding or removing one is a deliberate, reviewable change.
 */
export const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  {
    name: "prompt-injection-ignore-previous",
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/gi,
    replacement: "[redacted]",
  },
  {
    name: "role-markers",
    pattern: /^[ \t]*(?:system|user|assistant|developer|tool)[ \t]*:/gim,
    replacement: "[role]:",
  },
  {
    name: "special-tokens",
    pattern: /<\|[^|>]*\|>/g,
    replacement: "",
  },
  {
    name: "markdown-js-link",
    pattern: /\[([^\]]*)\]\(\s*javascript:[^)]*\)/gi,
    replacement: "[$1]",
  },
  {
    name: "script-tag",
    pattern: /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    replacement: "",
  },
  {
    name: "data-uri",
    pattern: /\bdata:[^\s)"']+/gi,
    replacement: "[data-uri]",
  },
  {
    name: "event-handler-attr",
    pattern: /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    replacement: "",
  },
  {
    name: "javascript-uri",
    pattern: /\bjavascript:[^\s)"']*/gi,
    replacement: "[js-uri]",
  },
  {
    name: "null-bytes",
    pattern: /\u0000/g,
    replacement: "",
  },
  {
    name: "ansi-escape",
    pattern:
      /\x1b\[[0-9;]*[A-Za-z]|\x1b[\]()][^\x1b]*\x07?|\x1b[()][0-9A-Za-z]/g,
    replacement: "",
  },
  {
    name: "unicode-control-rtl",
    pattern:
      /[\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,
    replacement: "",
  },
  {
    name: "iframe-tag",
    pattern: /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    replacement: "",
  },
] as const;

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&copy;": "\u00a9",
  "&reg;": "\u00ae",
  "&trade;": "\u2122",
  "&mdash;": "\u2014",
  "&ndash;": "\u2013",
  "&hellip;": "\u2026",
  "&laquo;": "\u00ab",
  "&raquo;": "\u00bb",
};

/**
 * Convert an HTML fragment to plain text by dropping tags, comments, and
 * script/style/iframe content, then decoding named and numeric entities.
 * Whitespace is collapsed for downstream readability.
 */
export function stripHtml(input: string): string {
  if (typeof input !== "string") return "";
  let out = input;
  // Remove paired script/style/iframe/noscript blocks (with their content).
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, " ");
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  // Remove any leftover opening tags for the same elements (unclosed).
  out = out.replace(/<script\b[^>]*>/gi, " ");
  out = out.replace(/<style\b[^>]*>/gi, " ");
  // Remove HTML comments.
  out = out.replace(/<!--[\s\S]*?-->/g, " ");
  // Remove all remaining tags.
  out = out.replace(/<[^>]+>/g, " ");
  // Decode numeric entities (decimal and hex).
  out = out.replace(/&#(\d+);/g, (_, code: string) => {
    const n = Number(code);
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff
      ? String.fromCodePoint(n)
      : "";
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
    const n = parseInt(hex, 16);
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff
      ? String.fromCodePoint(n)
      : "";
  });
  // Decode named entities.
  out = out.replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (m) => HTML_ENTITY_MAP[m] ?? m);
  // Collapse whitespace.
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Neutralise the twelve known prompt-injection / smuggling patterns and tidy
 * whitespace without otherwise rewriting the text.
 */
export function sanitizeForModel(input: string): string {
  if (typeof input !== "string") return "";
  let out = input;
  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  // Collapse runs of spaces/tabs (preserve newlines as structural separators).
  out = out.replace(/[ \t]+/g, " ");
  // Trim each line, then the whole string.
  out = out
    .split("\n")
    .map((line) => line.replace(/^[ \t]+|[ \t]+$/g, ""))
    .join("\n")
    .trim();
  return out;
}

/**
 * Wrap content in a clearly delimited `<data:label>` section so a model can
 * tell user-authored text apart from fetched external text. The label is
 * sanitised to a slug-safe token.
 */
export function wrapAsDataSection(
  input: string,
  label = "external-content",
): string {
  const safeLabel =
    String(label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "external-content";
  return `<data:${safeLabel}>\n${input}\n</data:${safeLabel}>`;
}

/**
 * Truncate `input` so its UTF-8 byte length does not exceed `maxBytes`.
 *
 * Truncation is byte-accurate: the cut point is walked back to the nearest
 * UTF-8 character boundary so a partial multi-byte sequence is dropped
 * entirely rather than decoded into a U+FFFD replacement character.
 */
export function truncateForModel(input: string, maxBytes: number): string {
  if (typeof input !== "string") return "";
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return "";
  const encoded = new TextEncoder().encode(input);
  if (encoded.length <= maxBytes) return input;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  // Walk `cut` back to the largest character boundary at or before maxBytes.
  // A continuation byte has the bit pattern 10xxxxxx (0x80..0xBF); when the
  // first excluded byte is a continuation byte we are mid-character and must
  // back up until the excluded byte is a leading byte (new character start).
  let cut = maxBytes;
  while (cut > 0 && (encoded[cut] & 0xc0) === 0x80) {
    cut--;
  }
  return decoder.decode(encoded.subarray(0, cut));
}

/** Result of {@link prepareExternalContent}. */
export interface PreparedExternalContent {
  /** Sanitised, truncated plain text ready for the model. */
  text: string;
  /** Byte length of {@link text} (UTF-8). */
  bytes: number;
  /** Whether the original sanitised text exceeded {@link maxBytes}. */
  truncated: boolean;
  /** {@link text} wrapped in a `<data:label>` section. */
  wrapped: string;
  /** The label used when wrapping. */
  label: string;
}

/**
 * Run the full external-content preparation pipeline:
 *   stripHtml → sanitizeForModel → truncateForModel → wrapAsDataSection.
 */
export function prepareExternalContent(
  input: string,
  options: { maxBytes?: number; label?: string } = {},
): PreparedExternalContent {
  const maxBytes = options.maxBytes ?? 8_000;
  const label = options.label ?? "external-content";
  const stripped = stripHtml(input);
  const sanitized = sanitizeForModel(stripped);
  const sanitizedBytes = new TextEncoder().encode(sanitized).length;
  const truncatedText = truncateForModel(sanitized, maxBytes);
  const bytes = new TextEncoder().encode(truncatedText).length;
  return {
    text: truncatedText,
    bytes,
    truncated: sanitizedBytes > maxBytes,
    wrapped: wrapAsDataSection(truncatedText, label),
    label,
  };
}

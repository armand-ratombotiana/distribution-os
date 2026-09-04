/**
 * Pure email validation, normalization and masking helpers.
 *
 * All functions are side-effect free and operate only on their inputs.
 * None of these helpers perform network lookups — "disposable" detection
 * is done against an in-module list of well-known throwaway domains.
 */

export type EmailValidationResult = {
  ok: boolean;
  error?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A non-exhaustive list of well-known disposable / throwaway email
 * providers. Checked case-insensitively against the domain part.
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "maildrop.cc",
  "getnada.com",
  "dispostable.com",
  "mailnesia.com",
  "tempinbox.com",
  "fakeinbox.com",
  "spam4.me",
  "sharklasers.com",
  "guerrillamailblock.com",
  "spam.com",
  "trashymail.com",
  "tmpmail.org",
  "tmpmail.net",
  "moakt.com",
  "burnermail.io",
]);

/**
 * Validate the syntactic format of an email address.
 *
 * Accepts a single `@` separator and requires at least one dot in the
 * domain portion. Does not perform DNS validation.
 */
export function validateEmailFormat(email: unknown): EmailValidationResult {
  if (typeof email !== "string") {
    return { ok: false, error: "Email must be a string" };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Email must not be empty" };
  }
  if (trimmed.length > 254) {
    return { ok: false, error: "Email is too long (max 254 chars)" };
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Email is not a valid address" };
  }
  const at = trimmed.lastIndexOf("@");
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length === 0 || local.length > 64) {
    return { ok: false, error: "Local part must be 1-64 characters" };
  }
  if (domain.length === 0 || domain.length > 253) {
    return { ok: false, error: "Domain part is invalid" };
  }
  return { ok: true };
}

/**
 * Normalize an email address by trimming surrounding whitespace and
 * lowercasing the domain portion. The local part is left untouched
 * (it is case-significant on most providers).
 *
 * Returns `null` for inputs that fail `validateEmailFormat`.
 */
export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  const result = validateEmailFormat(trimmed);
  if (!result.ok) return null;
  const at = trimmed.lastIndexOf("@");
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  return `${local}@${domain}`;
}

/**
 * Extract the (lowercased) domain portion of an email address.
 * Returns `null` for invalid inputs.
 */
export function extractDomain(email: unknown): string | null {
  const normalized = normalizeEmail(email);
  if (normalized === null) return null;
  return normalized.slice(normalized.lastIndexOf("@") + 1);
}

/**
 * Return `true` when the email's domain is on the disposable providers
 * list. Always returns `false` for invalid addresses.
 */
export function isDisposableEmail(email: unknown): boolean {
  const domain = extractDomain(email);
  if (domain === null) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export type MaskEmailOptions = {
  /** Number of characters kept visible at the start of the local part. Default 1. */
  visibleStart?: number;
  /** Number of characters kept visible at the end of the local part. Default 1. */
  visibleEnd?: number;
  /** Mask character. Default `*`. */
  char?: string;
  /** Minimum number of mask characters emitted. Default 3. */
  minMaskLength?: number;
};

/**
 * Mask the local part of an email address while leaving the domain
 * intact. Short local parts collapse to a fully-masked form so that
 * no original character is leaked when the input is too short.
 *
 * Returns `null` for invalid inputs.
 *
 * Examples:
 *   maskEmail("alice@example.com")           // "a***e@example.com"
 *   maskEmail("ab@example.com")              // "***@example.com"
 *   maskEmail("a@example.com")               // "***@example.com"
 */
export function maskEmail(
  email: unknown,
  options: MaskEmailOptions = {},
): string | null {
  const normalized = normalizeEmail(email);
  if (normalized === null) return null;
  const {
    visibleStart = 1,
    visibleEnd = 1,
    char = "*",
    minMaskLength = 3,
  } = options;
  const at = normalized.lastIndexOf("@");
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  if (local.length <= visibleStart + visibleEnd) {
    return `${char.repeat(Math.max(minMaskLength, local.length))}@${domain}`;
  }
  const start = local.slice(0, visibleStart);
  const end = local.slice(local.length - visibleEnd);
  const maskLen = Math.max(minMaskLength, local.length - visibleStart - visibleEnd);
  return `${start}${char.repeat(maskLen)}${end}@${domain}`;
}

/**
 * Pure data-masking helpers. Each function returns a masked version of the
 * input where most of the sensitive characters are replaced with `*`,
 * leaving enough context to identify the kind of value without exposing it.
 */

const MASK_CHAR = "*";

function repeat(ch: string, n: number): string {
  if (n <= 0) return "";
  return ch.repeat(n);
}

/**
 * Masks the local part of an email, leaving the first character and the
 * domain visible. e.g. "alice@example.com" → "a***@example.com".
 */
export function maskEmail(email: string): string {
  if (typeof email !== "string" || email.length === 0) return "";
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    // Not an email-shaped string; fall back to masking all but the first char.
    return email.length <= 1
      ? MASK_CHAR
      : email[0] + repeat(MASK_CHAR, email.length - 1);
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maskedLocal =
    local.length <= 1
      ? repeat(MASK_CHAR, local.length)
      : local[0] + repeat(MASK_CHAR, local.length - 1);
  return `${maskedLocal}@${domain}`;
}

/**
 * Masks a phone number, keeping only the last 4 digits visible.
 * Non-digit characters in the visible suffix are preserved as-is.
 */
export function maskPhone(phone: string): string {
  if (typeof phone !== "string" || phone.length === 0) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) {
    return repeat(MASK_CHAR, phone.length);
  }
  // Walk from the end, keeping the last 4 digits visible (along with their
  // original punctuation), masking everything else as a digit-placeholder.
  let digitsKept = 0;
  const out: string[] = [];
  for (let i = phone.length - 1; i >= 0; i -= 1) {
    const ch = phone[i];
    if (/\d/.test(ch)) {
      if (digitsKept < 4) {
        out.unshift(ch);
        digitsKept += 1;
      } else {
        out.unshift(MASK_CHAR);
      }
    } else {
      // Keep separators only if they sit between visible digits.
      out.unshift(ch);
    }
  }
  return out.join("");
}

/**
 * Masks a credit-card number, showing only the last 4 digits. Non-digit
 * separators are preserved in the masked prefix.
 */
export function maskCreditCard(card: string): string {
  if (typeof card !== "string" || card.length === 0) return "";
  const digits = card.replace(/\D/g, "");
  if (digits.length < 4) return repeat(MASK_CHAR, card.length);
  let digitsKept = 0;
  const out: string[] = [];
  for (let i = card.length - 1; i >= 0; i -= 1) {
    const ch = card[i];
    if (/\d/.test(ch)) {
      if (digitsKept < 4) {
        out.unshift(ch);
        digitsKept += 1;
      } else {
        out.unshift(MASK_CHAR);
      }
    } else {
      out.unshift(ch);
    }
  }
  return out.join("");
}

/**
 * Masks an API key, showing only the first 4 and last 4 characters.
 * Keys shorter than 8 characters are fully masked.
 */
export function maskApiKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) return "";
  if (key.length < 8) return repeat(MASK_CHAR, key.length);
  const head = key.slice(0, 4);
  const tail = key.slice(-4);
  return `${head}${repeat(MASK_CHAR, key.length - 8)}${tail}`;
}

/**
 * Masks a UUID, showing only the first segment and replacing the rest
 * with `*`. e.g. "550e8400-e29b-41d4-a716-446655440000" →
 * "550e8400-****-****-****-************".
 */
export function maskUuid(uuid: string): string {
  if (typeof uuid !== "string" || uuid.length === 0) return "";
  const parts = uuid.split("-");
  if (parts.length !== 5) {
    // Not a UUID-shaped string; mask all but the first 4 characters.
    if (uuid.length <= 4) return repeat(MASK_CHAR, uuid.length);
    return uuid.slice(0, 4) + repeat(MASK_CHAR, uuid.length - 4);
  }
  const [first, ...rest] = parts;
  return [first, ...rest.map((p) => repeat(MASK_CHAR, p.length))].join("-");
}

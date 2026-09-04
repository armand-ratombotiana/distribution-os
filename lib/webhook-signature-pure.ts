/**
 * Pure utilities for verifying provider webhook signatures (Stripe-style).
 *
 * Stripe's webhook signature header has the shape:
 *
 *     t=<unix-seconds>,v1=<hex-hmac>,v1=<hex-hmac>,...
 *
 * The signed payload is the string `<timestamp>.<raw-body>`. Verification:
 *
 *   1. Parse the header into a timestamp + list of v1 signatures.
 *   2. Reject if the timestamp is outside `STRIPE_TOLERANCE_SECONDS` of `now`.
 *   3. Recompute HMAC-SHA256(secret, `${timestamp}.${body}`) and compare
 *      against each v1 signature using a constant-time comparison.
 *
 * All functions are deterministic given their inputs. `verifyStripeSignature`
 * takes `nowSeconds` explicitly so it can be tested without the wall clock.
 */

import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";

/**
 * Stripe's recommended replay-window tolerance: 5 minutes.
 */
export const STRIPE_TOLERANCE_SECONDS = 300;

export interface ParsedStripeSignature {
  timestamp: number;
  signatures: string[];
}

export type WebhookEventClass =
  | "payment"
  | "subscription"
  | "refund"
  | "dispute"
  | "invoice"
  | "customer"
  | "other";

/**
 * Compute the hex-encoded HMAC-SHA256 of `payload` under `secret`.
 *
 * Both inputs are interpreted as UTF-8 strings.
 */
export function computeHmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Compare two strings in constant time.
 *
 * Returns `false` immediately when the lengths differ (as does Node's
 * `crypto.timingSafeEqual`); otherwise performs a length-independent,
 * data-independent comparison so timing side-channels do not leak the
 * matching prefix length.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return nodeTimingSafeEqual(aBuf, bBuf);
}

/**
 * Parse a Stripe-style `Stripe-Signature` header.
 *
 * Returns `null` if the header is missing the `t=` component or has no
 * `v1=` signatures. Extra whitespace and unknown keys (e.g. Stripe's `v0`
 * for legacy signatures) are tolerated.
 */
export function parseStripeSignature(header: string | null | undefined): ParsedStripeSignature | null {
  if (!header || typeof header !== "string") return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const rawPart of header.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!key || !value) continue;
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) timestamp = parsed;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export interface VerifySignatureOptions {
  /** Allowed clock skew in seconds. Defaults to {@link STRIPE_TOLERANCE_SECONDS}. */
  tolerance?: number;
}

export interface VerifySignatureResult {
  valid: boolean;
  reason?: "malformed_header" | "expired" | "future_dated" | "signature_mismatch";
  timestamp: number | null;
  expectedSignature?: string;
}

/**
 * Verify a Stripe-style webhook signature.
 *
 * @param payload         — the raw request body string.
 * @param signatureHeader — the value of the `Stripe-Signature` header.
 * @param secret          — the webhook signing secret (`whsec_...`).
 * @param nowSeconds      — current Unix time in seconds.
 * @param options         — optional `tolerance` override.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowSeconds: number,
  options: VerifySignatureOptions = {},
): VerifySignatureResult {
  const tolerance = options.tolerance ?? STRIPE_TOLERANCE_SECONDS;
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) {
    return { valid: false, reason: "malformed_header", timestamp: null };
  }

  const age = nowSeconds - parsed.timestamp;
  if (age > tolerance) {
    return {
      valid: false,
      reason: "expired",
      timestamp: parsed.timestamp,
    };
  }
  if (age < -tolerance) {
    return {
      valid: false,
      reason: "future_dated",
      timestamp: parsed.timestamp,
    };
  }

  const expected = computeHmacSha256(secret, `${parsed.timestamp}.${payload}`);
  const matched = parsed.signatures.some((sig) => timingSafeEqual(sig, expected));
  if (!matched) {
    return {
      valid: false,
      reason: "signature_mismatch",
      timestamp: parsed.timestamp,
      expectedSignature: expected,
    };
  }
  return { valid: true, timestamp: parsed.timestamp, expectedSignature: expected };
}

/**
 * Build a deduplication cache key for a provider event.
 *
 * The key is namespaced with `wh:` and combines the provider name with the
 * provider-assigned event id so the same event can be detected across
 * redeliveries.
 */
export function buildWebhookDedupKey(provider: string, eventId: string): string {
  return `wh:${provider}:${eventId}`;
}

function isReadonlyStringArray(
  x: ReadonlySet<string> | ReadonlyArray<string>,
): x is ReadonlyArray<string> {
  return Array.isArray(x);
}

/**
 * Return `true` if `eventId` is already present in `seenEventIds`.
 *
 * Accepts either a `Set` or an array for convenience — both are scanned in
 * O(1) / O(n) respectively.
 */
export function isDuplicateEvent(
  eventId: string,
  seenEventIds: ReadonlySet<string> | ReadonlyArray<string>,
): boolean {
  if (!eventId) return false;
  if (isReadonlyStringArray(seenEventIds)) {
    return seenEventIds.includes(eventId);
  }
  return seenEventIds.has(eventId);
}

const EVENT_TYPE_PATTERNS: ReadonlyArray<{ pattern: RegExp; klass: WebhookEventClass }> = [
  { pattern: /refund/i, klass: "refund" },
  { pattern: /dispute/i, klass: "dispute" },
  { pattern: /^subscription\.|^customer\.subscription\./, klass: "subscription" },
  { pattern: /^invoice\./, klass: "invoice" },
  { pattern: /^customer\./, klass: "customer" },
  {
    pattern: /^payment_intent\.|^payment_method\.|^charge\.|^payments\./,
    klass: "payment",
  },
];

/**
 * Classify a webhook event type into a coarse category for routing and
 * metrics. Returns `"other"` for anything unrecognized.
 */
export function classifyWebhookEvent(eventType: string): WebhookEventClass {
  if (!eventType || typeof eventType !== "string") return "other";
  for (const { pattern, klass } of EVENT_TYPE_PATTERNS) {
    if (pattern.test(eventType)) return klass;
  }
  return "other";
}

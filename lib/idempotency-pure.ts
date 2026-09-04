/**
 * Pure idempotency utilities.
 *
 * The idempotency key namespace lets a distributor safely retry provider
 * callbacks without double-processing. The model:
 *
 *   key = `idem:<provider>:<providerEventId>`
 *
 * Records are stored with a TTL; a retry that arrives after expiry is treated
 * as a fresh attempt. The functions in this module are deterministic and have
 * no side effects — persistence is the caller's responsibility.
 */

import { createHash } from "node:crypto";

/**
 * Default record TTL: 24 hours. Long enough to absorb retries from provider
 * queues, short enough to keep the store from growing unbounded.
 */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyRecord {
  key: string;
  status: "pending" | "completed" | "failed";
  createdAtMs: number;
  expiresAtMs: number;
  /** Optional hash of the request payload, used to detect payload drift. */
  payloadHash?: string;
}

/**
 * Build the cache key for an idempotency record.
 *
 *   buildKey("stripe", "evt_1") → "idem:stripe:evt_1"
 */
export function buildKey(provider: string, eventId: string): string {
  return `idem:${provider}:${eventId}`;
}

/**
 * Return `true` when the record is still within its TTL window relative to
 * `nowMs`. A record whose `expiresAtMs` has passed is considered stale and
 * the operation should be allowed to run again.
 */
export function isRecordValid(record: IdempotencyRecord, nowMs: number): boolean {
  if (!record || typeof record !== "object") return false;
  return nowMs < record.expiresAtMs;
}

/**
 * Return the items in `items` whose key (per `keyFn`) appears more than
 * once. Only the second-and-later occurrences are returned; the first
 * occurrence of each key is treated as the canonical one.
 */
export function findDuplicates<T>(
  items: ReadonlyArray<T>,
  keyFn: (item: T) => string,
): T[] {
  const seen = new Map<string, number>();
  const dupes: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    const count = seen.get(key) ?? 0;
    if (count >= 1) dupes.push(item);
    seen.set(key, count + 1);
  }
  return dupes;
}

export interface HasProviderEventId {
  provider: string;
  eventId: string;
}

/**
 * Return a new array containing the first occurrence of each
 * `(provider, eventId)` pair. Subsequent occurrences are dropped.
 */
export function deduplicateByProviderEventId<T extends HasProviderEventId>(
  items: ReadonlyArray<T>,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = buildKey(item.provider, item.eventId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Compute the SHA-256 hex digest of a UTF-8 payload. Used both to fingerprint
 * stored responses and to detect payload drift across retries.
 */
export function computePayloadHash(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export type ErrorClass =
  | "transient"
  | "permanent"
  | "rate_limit"
  | "timeout"
  | "network"
  | "unknown";

export interface ErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Classify a thrown error / API response into a coarse bucket that drives
 * retry behaviour.
 *
 * - `rate_limit`  — HTTP 429.
 * - `transient`   — HTTP 5xx.
 * - `timeout`     — HTTP 408, `ETIMEDOUT`, or message contains "timeout".
 * - `network`     — common DNS / connection error codes.
 * - `permanent`   — any other HTTP 4xx.
 * - `unknown`     — everything else (no status, no recognized code).
 */
export function classifyError(error: ErrorLike): ErrorClass {
  const status = error?.status;
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (status === 429) return "rate_limit";
  if (typeof status === "number" && status >= 500 && status < 600) return "transient";
  if (status === 408) return "timeout";

  const networkCodes = new Set([
    "ECONNRESET",
    "ECONNREFUSED",
    "EAI_AGAIN",
    "ENOTFOUND",
    "EPIPE",
  ]);
  if (networkCodes.has(code)) return "network";

  if (code === "ETIMEDOUT" || /timeout/i.test(message)) return "timeout";

  if (typeof status === "number" && status >= 400 && status < 500) return "permanent";
  return "unknown";
}

/**
 * Return `true` when an error of class `errorClass` is worth retrying.
 *
 * - `permanent` errors are never retried.
 * - `transient`, `rate_limit`, `timeout`, and `network` errors are retried
 *   until `attempt >= maxAttempts`.
 * - `unknown` errors are not retried by default (safer to surface to the
 *   operator than to amplify load).
 */
export function shouldRetry(
  errorClass: ErrorClass,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) return false;
  switch (errorClass) {
    case "transient":
    case "rate_limit":
    case "timeout":
    case "network":
      return true;
    case "permanent":
    case "unknown":
    default:
      return false;
  }
}

export interface BackoffOptions {
  /** Base delay in milliseconds for attempt 0. Defaults to 1000. */
  baseMs?: number;
  /** Maximum delay cap in milliseconds. Defaults to 30,000. */
  maxMs?: number;
  /** When true, multiply by a uniform random in [0, 1) for "full jitter". */
  jitter?: boolean;
  /** Injectable RNG for testability; defaults to `Math.random`. */
  random?: () => number;
}

/**
 * Compute exponential backoff: `baseMs * 2 ** attempt`, capped at `maxMs`.
 *
 * With `jitter: true`, the result is multiplied by a uniform random value in
 * `[0, 1)` (full-jitter strategy) to decorrelate competing retries. The RNG
 * is injectable so tests can assert exact values.
 *
 *   calculateBackoff(0) → 1000
 *   calculateBackoff(3) → 8000
 *   calculateBackoff(5) → 30000  (capped)
 */
export function calculateBackoff(attempt: number, options: BackoffOptions = {}): number {
  const baseMs = options.baseMs ?? 1000;
  const maxMs = options.maxMs ?? 30_000;
  if (attempt < 0) attempt = 0;
  const raw = baseMs * 2 ** attempt;
  const capped = Math.min(maxMs, raw);
  if (options.jitter) {
    const random = options.random ?? Math.random;
    return Math.floor(capped * random());
  }
  return capped;
}

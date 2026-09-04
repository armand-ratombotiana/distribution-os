/**
 * Pure token-bucket rate limiter.
 *
 * All functions are deterministic given their inputs: they take `nowMs` as an
 * explicit parameter so they can be unit-tested without depending on the wall
 * clock. Callers are responsible for persisting the returned `state` between
 * requests (e.g. in KV, Durable Objects, or Redis).
 */

/**
 * Configuration for a single token bucket.
 *
 * - `capacity` is the maximum number of tokens the bucket can hold (burst size).
 * - `refillPerSecond` is the sustained refill rate.
 */
export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

/**
 * Mutable bucket state. Persist this between requests for a given key.
 */
export interface RateLimitState {
  tokens: number;
  lastRefillMs: number;
}

/**
 * Result of a rate-limit check.
 *
 * - `allowed` — whether the request may proceed.
 * - `remaining` — tokens left after this request (can be fractional).
 * - `retryAfterMs` — milliseconds until the next token becomes available
 *   (zero when allowed).
 * - `resetAtMs` — epoch milliseconds when the bucket will be fully refilled.
 * - `state` — the new bucket state to persist.
 * - `limit` — the bucket capacity (for headers).
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAtMs: number;
  state: RateLimitState;
  limit: number;
}

/**
 * Default rate-limit configurations keyed by scope. Values are sized for a
 * typical API gateway fronting a multi-tenant SaaS.
 */
export const DEFAULT_RATE_LIMITS = {
  global: { capacity: 10_000, refillPerSecond: 10_000 / 60 },
  workspace: { capacity: 600, refillPerSecond: 600 / 60 },
  ip: { capacity: 120, refillPerSecond: 120 / 60 },
  authenticated: { capacity: 1_200, refillPerSecond: 1_200 / 60 },
  write: { capacity: 60, refillPerSecond: 60 / 60 },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * Build a deterministic cache key for a rate-limit bucket.
 *
 * Accepts any number of string/number segments. The result is always prefixed
 * with `rl:` so it cannot collide with other namespaces in a shared store.
 *
 * @example
 *   buildRateLimitKey("workspace", "ws_123") // "rl:workspace:ws_123"
 *   buildRateLimitKey("ip", "1.2.3.4", "write") // "rl:ip:1.2.3.4:write"
 */
export function buildRateLimitKey(...parts: ReadonlyArray<string | number>): string {
  return ["rl", ...parts.map((p) => String(p))].join(":");
}

/**
 * Apply the token-bucket algorithm to a single bucket.
 *
 * @param state   — previously persisted state, or `null` for a fresh bucket.
 * @param config  — bucket capacity and refill rate.
 * @param nowMs   — current epoch milliseconds.
 * @param cost    — tokens to consume (default 1).
 */
export function checkRateLimit(
  state: RateLimitState | null,
  config: RateLimitConfig,
  nowMs: number,
  cost: number = 1,
): RateLimitResult {
  const { capacity, refillPerSecond } = config;
  const safeCost = cost > 0 ? cost : 1;

  const previousTokens = state ? state.tokens : capacity;
  const lastRefillMs = state ? state.lastRefillMs : nowMs;

  // Refill: never go backwards in time, never exceed capacity.
  const elapsedSeconds = Math.max(0, (nowMs - lastRefillMs) / 1000);
  const refilled = Math.min(
    capacity,
    previousTokens + elapsedSeconds * Math.max(0, refillPerSecond),
  );

  const limit = capacity;
  const refillRatePerMs = Math.max(0, refillPerSecond) / 1000;

  if (refilled >= safeCost) {
    const newTokens = refilled - safeCost;
    const tokensToFull = Math.max(0, capacity - newTokens);
    const resetAtMs =
      refillRatePerMs > 0 ? nowMs + tokensToFull / refillRatePerMs : nowMs;
    return {
      allowed: true,
      remaining: newTokens,
      retryAfterMs: 0,
      resetAtMs,
      state: { tokens: newTokens, lastRefillMs: nowMs },
      limit,
    };
  }

  // Denied: figure out how long until enough tokens accrue to satisfy cost.
  const deficit = safeCost - refilled;
  const retryAfterMs =
    refillRatePerMs > 0 ? Math.ceil(deficit / refillRatePerMs) : Infinity;
  const safeRetryAfterMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 0;
  return {
    allowed: false,
    remaining: refilled,
    retryAfterMs: safeRetryAfterMs,
    resetAtMs: nowMs + safeRetryAfterMs,
    // We still advance lastRefillMs so accumulated credit isn't recomputed
    // against the ancient timestamp on the next call.
    state: { tokens: refilled, lastRefillMs: nowMs },
    limit,
  };
}

/**
 * Format a retry-after duration (in milliseconds) as an HTTP `Retry-After`
 * header value. Per RFC 7231 the value is a non-negative integer number of
 * seconds; we round up so the client never retries too early.
 */
export function getRetryAfterHeader(retryAfterMs: number): string {
  if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return "0";
  return String(Math.ceil(retryAfterMs / 1000));
}

/**
 * Produce the standard rate-limit response headers (the IETF
 * `RateLimit-*` family plus `Retry-After` when the request was denied).
 *
 * @param result — output of {@link checkRateLimit}.
 * @param nowMs  — optional current epoch milliseconds; defaults to `Date.now()`.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  nowMs: number = Date.now(),
): Record<string, string> {
  const resetSeconds = Math.max(
    0,
    Math.ceil((result.resetAtMs - nowMs) / 1000),
  );
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(Math.max(0, Math.floor(result.remaining))),
    "RateLimit-Reset": String(resetSeconds),
  };
  if (!result.allowed && result.retryAfterMs > 0) {
    headers["Retry-After"] = getRetryAfterHeader(result.retryAfterMs);
  }
  return headers;
}

/**
 * Pure debounce / throttle helpers.
 *
 * All functions take `nowMs` as an explicit parameter so they can be tested
 * deterministically without touching the wall clock. No I/O, no D1.
 */

export interface DebounceConfig {
  /** Minimum gap between executions in milliseconds. */
  delayMs: number;
  /** Maximum gap before the trailing call is forced (milliseconds). */
  maxDelayMs: number;
}

/**
 * Default debounce config: 250 ms delay, 2 s max wait.
 */
export const DEFAULT_DEBOUNCE_CONFIG: DebounceConfig = {
  delayMs: 250,
  maxDelayMs: 2000,
};

/**
 * Return `true` when `nowMs - lastExecutedMs >= delayMs`. A `lastExecutedMs`
 * of `0` means "never executed" and always returns `true`. Out-of-order or
 * non-finite timestamps return `false`.
 */
export function shouldExecute(
  lastExecutedMs: number,
  nowMs: number,
  delayMs: number,
): boolean {
  if (lastExecutedMs === 0) return true;
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastExecutedMs)) return false;
  if (!Number.isFinite(delayMs)) return false;
  if (nowMs < lastExecutedMs) return false;
  return nowMs - lastExecutedMs >= delayMs;
}

/**
 * Compute the actual delay to wait before the next execution. The delay is
 * normally `config.delayMs`, but if the caller has been continuously
 * debouncing for longer than `config.maxDelayMs` (i.e. the trailing call
 * would be delayed past the max), the delay is shortened so the call lands
 * at exactly `maxDelayMs` after `firstPendingMs`.
 *
 *   calculateDelay(100, 200, {delayMs:50, maxDelayMs:2000})  → 50
 *   calculateDelay(100, 2050, {delayMs:50, maxDelayMs:2000}) → 50  (still under max)
 *   calculateDelay(100, 2100, {delayMs:50, maxDelayMs:2000}) → 0   (max elapsed)
 */
export function calculateDelay(
  firstPendingMs: number,
  nowMs: number,
  config: DebounceConfig,
): number {
  if (!Number.isFinite(firstPendingMs) || !Number.isFinite(nowMs)) {
    return Math.max(0, config.delayMs);
  }
  const elapsed = Math.max(0, nowMs - firstPendingMs);
  const remaining = Math.max(0, config.maxDelayMs - elapsed);
  return Math.min(Math.max(0, config.delayMs), remaining);
}

/**
 * Exponential backoff: `baseMs * 2 ** (attempt - 1)`, capped at `maxMs`.
 * Attempt 0 (or any non-positive value) returns 0 — the first attempt
 * needs no backoff. Non-finite inputs return `baseMs` as a safe default.
 *
 *   getBackoffDelay(0, 1000, 30000) → 0      (first attempt)
 *   getBackoffDelay(1, 1000, 30000) → 1000   (first retry)
 *   getBackoffDelay(2, 1000, 30000) → 2000
 *   getBackoffDelay(3, 1000, 30000) → 4000
 *   getBackoffDelay(6, 1000, 30000) → 30000  (capped)
 */
export function getBackoffDelay(
  attempt: number,
  baseMs: number = 1_000,
  maxMs: number = 30_000,
): number {
  if (
    !Number.isFinite(attempt) ||
    !Number.isFinite(baseMs) ||
    !Number.isFinite(maxMs)
  ) {
    return baseMs;
  }
  if (attempt <= 0) return 0;
  const a = Math.floor(attempt);
  const raw = baseMs * 2 ** (a - 1);
  return Math.min(Math.max(0, maxMs), Math.floor(raw));
}

/**
 * Return the next timestamp at which the debounced function should fire,
 * given the first-pending timestamp and the current time.
 */
export function nextExecuteAt(
  firstPendingMs: number,
  nowMs: number,
  config: DebounceConfig,
): number {
  return nowMs + calculateDelay(firstPendingMs, nowMs, config);
}

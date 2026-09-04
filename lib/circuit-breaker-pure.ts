/**
 * Pure circuit-breaker state machine.
 *
 * States:
 *   - closed     — requests flow; failures are counted.
 *   - open       — requests are blocked until the cooldown elapses.
 *   - half_open  — a limited number of trial requests are allowed.
 *
 * All transitions are pure functions of (state, config, nowMs). No I/O.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  /** Last failure timestamp (epoch ms). */
  lastFailureMs: number;
  /** Timestamp when the breaker opened (epoch ms). */
  openedAtMs: number;
  /** Consecutive successes accumulated in half_open. */
  halfOpenSuccesses: number;
}

export interface CircuitBreakerConfig {
  /** Failures required to trip from closed to open. */
  failureThreshold: number;
  /** Consecutive successes in half_open required to close. */
  successThreshold: number;
  /** How long to stay open before transitioning to half_open. */
  cooldownMs: number;
  /** Max trial requests to allow in half_open. */
  halfOpenMaxRequests: number;
}

/**
 * Default config: 5 failures to trip, 3 successes to close, 30 s cooldown.
 */
export const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  cooldownMs: 30_000,
  halfOpenMaxRequests: 1,
};

/**
 * Create a fresh breaker in the closed state.
 */
export function createCircuitBreakerState(): CircuitBreakerState {
  return {
    state: "closed",
    failures: 0,
    successes: 0,
    lastFailureMs: 0,
    openedAtMs: 0,
    halfOpenSuccesses: 0,
  };
}

/**
 * Decide whether a request should be allowed given the breaker state and
 * the current time.
 *
 *   - closed      → always allow
 *   - open        → block until cooldown elapses, then allow (transition to half_open)
 *   - half_open   → allow while trial traffic is below the success threshold
 */
export function shouldAllow(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig,
  nowMs: number,
): boolean {
  if (state.state === "closed") return true;
  if (state.state === "open") {
    return nowMs >= state.openedAtMs + config.cooldownMs;
  }
  // half_open: allow trial traffic until enough successes accrue to close.
  return state.halfOpenSuccesses < config.successThreshold;
}

/**
 * Decide whether the breaker should trip from closed/half_open to open.
 * Trips when `failures >= failureThreshold`. Never trips from open.
 */
export function shouldTrip(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig,
): boolean {
  if (state.state === "open") return false;
  return state.failures >= config.failureThreshold;
}

/**
 * Decide whether the breaker should reset (close or move to half_open).
 *
 *   - in half_open with enough successes → reset to closed
 *   - in open with the cooldown elapsed → reset to half_open
 *   - in closed                          → never reset
 */
export function shouldReset(
  state: CircuitBreakerState,
  config: CircuitBreakerConfig,
  nowMs: number,
): boolean {
  if (state.state === "half_open") {
    return state.halfOpenSuccesses >= config.successThreshold;
  }
  if (state.state === "open") {
    return nowMs >= state.openedAtMs + config.cooldownMs;
  }
  return false;
}

/**
 * Compute exponential backoff for the cooldown when the breaker keeps
 * tripping. `failures` is the failure count; each successive failure
 * doubles the delay starting from `baseMs`, capped at `maxMs`. Returns 0
 * for non-positive failures.
 *
 *   getBackoffDelay(1, 1000, 60000) → 1000
 *   getBackoffDelay(2, 1000, 60000) → 2000
 *   getBackoffDelay(3, 1000, 60000) → 4000
 *   getBackoffDelay(7, 1000, 60000) → 60000  (capped)
 */
export function getBackoffDelay(
  failures: number,
  baseMs: number = 1_000,
  maxMs: number = 60_000,
): number {
  if (!Number.isFinite(failures) || failures <= 0) return 0;
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  if (!Number.isFinite(maxMs) || maxMs <= 0) return 0;
  const attempt = Math.floor(failures) - 1;
  const raw = baseMs * 2 ** Math.max(0, attempt);
  return Math.min(Math.max(0, maxMs), Math.floor(raw));
}

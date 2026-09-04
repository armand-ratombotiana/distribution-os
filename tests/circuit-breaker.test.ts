import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCircuitBreakerState,
  DEFAULT_CB_CONFIG,
  getBackoffDelay,
  shouldAllow,
  shouldReset,
  shouldTrip,
  type CircuitBreakerState,
} from "../lib/circuit-breaker-pure.ts";

const NOW = 1_700_000_000_000;

function openState(openedAtMs: number): CircuitBreakerState {
  return {
    ...createCircuitBreakerState(),
    state: "open",
    failures: 5,
    lastFailureMs: openedAtMs,
    openedAtMs,
  };
}

function halfOpenState(successes: number, failures = 0): CircuitBreakerState {
  return {
    ...createCircuitBreakerState(),
    state: "half_open",
    failures,
    successes,
    halfOpenSuccesses: successes,
  };
}

test("createCircuitBreakerState initializes a closed breaker", () => {
  const s = createCircuitBreakerState();
  assert.equal(s.state, "closed");
  assert.equal(s.failures, 0);
  assert.equal(s.successes, 0);
  assert.equal(s.lastFailureMs, 0);
  assert.equal(s.openedAtMs, 0);
  assert.equal(s.halfOpenSuccesses, 0);
});

test("shouldAllow always returns true in the closed state", () => {
  const s = createCircuitBreakerState();
  assert.equal(shouldAllow(s, DEFAULT_CB_CONFIG, NOW), true);
  assert.equal(shouldAllow(s, DEFAULT_CB_CONFIG, NOW + 1_000_000), true);
});

test("shouldAllow returns false in the open state during cooldown", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, cooldownMs: 30_000 };
  const s = openState(NOW);
  assert.equal(shouldAllow(s, cfg, NOW), false);
  assert.equal(shouldAllow(s, cfg, NOW + 29_999), false);
});

test("shouldAllow returns true once cooldown elapses (transition to half_open)", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, cooldownMs: 30_000 };
  const s = openState(NOW);
  assert.equal(shouldAllow(s, cfg, NOW + 30_000), true);
  assert.equal(shouldAllow(s, cfg, NOW + 60_000), true);
});

test("shouldAllow limits trial traffic in the half_open state", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, successThreshold: 3 };
  // 0 successes so far → allow.
  assert.equal(shouldAllow(halfOpenState(0), cfg, NOW), true);
  // 2 successes (below threshold of 3) → still allow.
  assert.equal(shouldAllow(halfOpenState(2), cfg, NOW), true);
  // 3 successes (meets threshold) → block; breaker should close instead.
  assert.equal(shouldAllow(halfOpenState(3), cfg, NOW), false);
});

test("shouldTrip returns true when failures reach the threshold", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, failureThreshold: 5 };
  const s = { ...createCircuitBreakerState(), failures: 5 };
  assert.equal(shouldTrip(s, cfg), true);
  // Strict inequality: exactly at threshold trips.
  const s2 = { ...createCircuitBreakerState(), failures: 4 };
  assert.equal(shouldTrip(s2, cfg), false);
});

test("shouldTrip returns false when failures are below the threshold", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, failureThreshold: 5 };
  assert.equal(shouldTrip({ ...createCircuitBreakerState(), failures: 0 }, cfg), false);
  assert.equal(shouldTrip({ ...createCircuitBreakerState(), failures: 1 }, cfg), false);
});

test("shouldTrip returns false in the open state regardless of failures", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, failureThreshold: 5 };
  assert.equal(shouldTrip(openState(NOW), cfg), false);
});

test("shouldReset returns true in half_open once successes hit the threshold", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, successThreshold: 3 };
  assert.equal(shouldReset(halfOpenState(2), cfg, NOW), false);
  assert.equal(shouldReset(halfOpenState(3), cfg, NOW), true);
  assert.equal(shouldReset(halfOpenState(5), cfg, NOW), true);
});

test("shouldReset returns true in open once cooldown elapses", () => {
  const cfg = { ...DEFAULT_CB_CONFIG, cooldownMs: 30_000 };
  assert.equal(shouldReset(openState(NOW), cfg, NOW + 29_999), false);
  assert.equal(shouldReset(openState(NOW), cfg, NOW + 30_000), true);
});

test("shouldReset returns false in the closed state", () => {
  const s = createCircuitBreakerState();
  assert.equal(shouldReset(s, DEFAULT_CB_CONFIG, NOW), false);
  assert.equal(shouldReset(s, DEFAULT_CB_CONFIG, NOW + 1_000_000), false);
});

test("getBackoffDelay grows exponentially, caps at maxMs, and returns 0 for non-positive or non-finite inputs", () => {
  assert.equal(getBackoffDelay(1, 1000, 60_000), 1000);
  assert.equal(getBackoffDelay(2, 1000, 60_000), 2000);
  assert.equal(getBackoffDelay(3, 1000, 60_000), 4000);
  assert.equal(getBackoffDelay(4, 1000, 60_000), 8000);
  // 2^6 * 1000 = 64000 → capped at 60000.
  assert.equal(getBackoffDelay(7, 1000, 60_000), 60_000);
  // Non-positive failures return 0 (no backoff before any failure).
  assert.equal(getBackoffDelay(0, 1000, 60_000), 0);
  assert.equal(getBackoffDelay(-3, 1000, 60_000), 0);
  // Non-finite inputs return 0.
  assert.equal(getBackoffDelay(NaN, 1000, 60_000), 0);
  assert.equal(getBackoffDelay(2, 0, 60_000), 0);
  assert.equal(getBackoffDelay(2, 1000, 0), 0);
});

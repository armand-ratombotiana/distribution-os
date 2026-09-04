import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRateLimitKey,
  checkRateLimit,
  DEFAULT_RATE_LIMITS,
  getRateLimitHeaders,
  getRetryAfterHeader,
  type RateLimitState,
} from "../lib/rate-limit-pure.ts";

const FIXED_NOW = 1_700_000_000_000; // 2023-11-14T22:13:20Z

test("checkRateLimit allows the first request against a fresh bucket", () => {
  const result = checkRateLimit(null, DEFAULT_RATE_LIMITS.workspace, FIXED_NOW);
  assert.equal(result.allowed, true);
  assert.equal(result.limit, DEFAULT_RATE_LIMITS.workspace.capacity);
  assert.equal(result.retryAfterMs, 0);
  assert.equal(result.state.lastRefillMs, FIXED_NOW);
  assert.equal(result.state.tokens, DEFAULT_RATE_LIMITS.workspace.capacity - 1);
});

test("checkRateLimit deducts one token per request when cost is omitted", () => {
  // refillPerSecond = 0 so each call is a pure drain (no floating-point drift
  // from fractional token accrual).
  const cfg = { capacity: 600, refillPerSecond: 0 };
  let state: RateLimitState | null = null;
  for (let i = 0; i < 5; i += 1) {
    const result = checkRateLimit(state, cfg, FIXED_NOW + i);
    state = result.state;
  }
  assert.ok(state, "state should be set after loop");
  assert.equal(state.tokens, cfg.capacity - 5);
});

test("checkRateLimit denies the request once the bucket is exhausted", () => {
  const exhausted: RateLimitState = {
    tokens: 0,
    lastRefillMs: FIXED_NOW,
  };
  const result = checkRateLimit(exhausted, DEFAULT_RATE_LIMITS.workspace, FIXED_NOW);
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs > 0, "retryAfterMs should be positive when denied");
});

test("checkRateLimit reports a positive retryAfterMs when denied", () => {
  const cfg = { capacity: 10, refillPerSecond: 1 };
  const result = checkRateLimit({ tokens: 0, lastRefillMs: FIXED_NOW }, cfg, FIXED_NOW);
  assert.equal(result.allowed, false);
  // Need 1 token at 1 token/sec → 1000 ms.
  assert.equal(result.retryAfterMs, 1000);
});

test("checkRateLimit refills tokens as wall time advances", () => {
  const cfg = { capacity: 10, refillPerSecond: 2 }; // 2 tokens/sec
  const after = checkRateLimit({ tokens: 0, lastRefillMs: FIXED_NOW }, cfg, FIXED_NOW + 500);
  // 500 ms * 2 tokens/sec = 1 token refilled → request costs 1 → 0 left.
  assert.equal(after.allowed, true);
  assert.equal(after.state.tokens, 0);
  const after2 = checkRateLimit(after.state, cfg, FIXED_NOW + 1500);
  // Another 1000 ms elapsed → 2 more tokens; cost 1 → 1 left.
  assert.equal(after2.allowed, true);
  assert.ok(Math.abs(after2.state.tokens - 1) < 1e-9);
});

test("checkRateLimit never refills beyond capacity", () => {
  const cfg = { capacity: 5, refillPerSecond: 100 };
  // A huge gap in wall-clock time would naively produce a gigantic token count,
  // but the cap should clamp it to capacity. After consuming 1 token we expect
  // exactly capacity - 1 remaining.
  const full = checkRateLimit({ tokens: 4, lastRefillMs: 0 }, cfg, FIXED_NOW);
  assert.ok(full.state.tokens <= cfg.capacity, "tokens must not exceed capacity");
  assert.equal(full.state.tokens, cfg.capacity - 1);
  assert.equal(full.remaining, cfg.capacity - 1);
});

test("checkRateLimit supports multi-token costs", () => {
  const cfg = { capacity: 10, refillPerSecond: 1 };
  const result = checkRateLimit(null, cfg, FIXED_NOW, 4);
  assert.equal(result.allowed, true);
  assert.equal(result.state.tokens, 6);
});

test("checkRateLimit resetAtMs lies in the future when the bucket is partially full", () => {
  const cfg = { capacity: 10, refillPerSecond: 1 };
  // Drain 9 tokens so the bucket needs 9 seconds to fully refill.
  let state: RateLimitState | null = null;
  for (let i = 0; i < 9; i += 1) {
    const result = checkRateLimit(state, cfg, FIXED_NOW);
    state = result.state;
  }
  const result = checkRateLimit(state, cfg, FIXED_NOW);
  assert.equal(result.state.tokens, 0);
  assert.ok(result.resetAtMs > FIXED_NOW, "resetAtMs should be in the future");
  // 10 tokens missing at 1 token/sec → ~10 seconds.
  assert.ok(Math.abs(result.resetAtMs - (FIXED_NOW + 10_000)) < 5);
});

test("checkRateLimit state round-trips across sequential calls", () => {
  // No refill: a pure drain so the bucket exhausts deterministically.
  const cfg = { capacity: 3, refillPerSecond: 0 };
  let state: RateLimitState | null = null;
  const allowed: boolean[] = [];
  for (let i = 0; i < 5; i += 1) {
    const result = checkRateLimit(state, cfg, FIXED_NOW + i);
    state = result.state;
    allowed.push(result.allowed);
  }
  assert.ok(state, "state should be set after loop");
  assert.deepEqual(allowed, [true, true, true, false, false]);
  assert.equal(state.tokens, 0);

  // After enough wall-clock time has elapsed with a refilling bucket, the
  // persisted state from the final denied call should let a new call succeed.
  const refillCfg = { capacity: 3, refillPerSecond: 1 };
  const recovered = checkRateLimit(state, refillCfg, FIXED_NOW + 5_000);
  assert.equal(recovered.allowed, true);
  // 5 seconds × 1 token/sec = 5 tokens, capped at 3, minus cost 1 → 2 left.
  assert.equal(recovered.state.tokens, 2);
});

test("DEFAULT_RATE_LIMITS exposes the expected scopes", () => {
  assert.ok("global" in DEFAULT_RATE_LIMITS);
  assert.ok("workspace" in DEFAULT_RATE_LIMITS);
  assert.ok("ip" in DEFAULT_RATE_LIMITS);
  assert.ok("authenticated" in DEFAULT_RATE_LIMITS);
  assert.ok(DEFAULT_RATE_LIMITS.global.capacity > DEFAULT_RATE_LIMITS.workspace.capacity);
  assert.ok(DEFAULT_RATE_LIMITS.workspace.capacity > DEFAULT_RATE_LIMITS.ip.capacity);
  for (const key of Object.keys(DEFAULT_RATE_LIMITS) as Array<keyof typeof DEFAULT_RATE_LIMITS>) {
    assert.ok(DEFAULT_RATE_LIMITS[key].capacity > 0);
    assert.ok(DEFAULT_RATE_LIMITS[key].refillPerSecond > 0);
  }
});

test("buildRateLimitKey prefixes with rl: and joins segments", () => {
  assert.equal(buildRateLimitKey("workspace", "ws_123"), "rl:workspace:ws_123");
  assert.equal(buildRateLimitKey("ip", "1.2.3.4", "write"), "rl:ip:1.2.3.4:write");
  assert.equal(buildRateLimitKey("user", 42), "rl:user:42");
});

test("getRetryAfterHeader ceil-rounds milliseconds to seconds", () => {
  assert.equal(getRetryAfterHeader(0), "0");
  assert.equal(getRetryAfterHeader(1), "1");
  assert.equal(getRetryAfterHeader(1000), "1");
  assert.equal(getRetryAfterHeader(1001), "2");
  assert.equal(getRetryAfterHeader(2500), "3");
  assert.equal(getRetryAfterHeader(-5), "0");
});

test("getRateLimitHeaders emits the standard RateLimit-* family", () => {
  const result = checkRateLimit(null, DEFAULT_RATE_LIMITS.workspace, FIXED_NOW);
  const headers = getRateLimitHeaders(result, FIXED_NOW);
  assert.equal(headers["RateLimit-Limit"], String(DEFAULT_RATE_LIMITS.workspace.capacity));
  assert.equal(
    headers["RateLimit-Remaining"],
    String(DEFAULT_RATE_LIMITS.workspace.capacity - 1),
  );
  assert.ok(Number(headers["RateLimit-Reset"]) > 0);
  assert.equal(headers["Retry-After"], undefined, "no Retry-After when allowed");
});

test("getRateLimitHeaders adds Retry-After only when the request is denied", () => {
  const cfg = { capacity: 1, refillPerSecond: 1 };
  const first = checkRateLimit(null, cfg, FIXED_NOW);
  const second = checkRateLimit(first.state, cfg, FIXED_NOW);
  assert.equal(second.allowed, false);
  const headers = getRateLimitHeaders(second, FIXED_NOW);
  assert.equal(headers["RateLimit-Limit"], "1");
  assert.equal(headers["RateLimit-Remaining"], "0");
  assert.equal(headers["Retry-After"], "1");
  // Allowed requests should never carry Retry-After.
  const okHeaders = getRateLimitHeaders(first, FIXED_NOW);
  assert.equal(okHeaders["Retry-After"], undefined);
});

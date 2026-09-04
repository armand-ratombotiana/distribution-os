/**
 * Comprehensive idempotency coverage. Crosses the generic idempotency helpers
 * (`lib/idempotency-pure.ts`) with the per-domain key builders in
 * `actions-pure`, `attribution-pure`, `webhook-signature-pure`, and
 * `rate-limit-pure`.
 *
 * 15 tests, all pure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_IDEMPOTENCY_TTL_MS,
  buildKey,
  isRecordValid,
  findDuplicates,
  deduplicateByProviderEventId,
  computePayloadHash,
  classifyError,
  shouldRetry,
  calculateBackoff,
  type IdempotencyRecord,
  type ErrorClass,
} from "../lib/idempotency-pure.ts";
import { buildIdempotencyKey } from "../db/actions-pure.ts";
import { buildPaymentIdempotencyKey } from "../db/attribution-pure.ts";
import { buildWebhookDedupKey } from "../lib/webhook-signature-pure.ts";
import { buildRateLimitKey } from "../lib/rate-limit-pure.ts";

const FIXED_NOW = 1_700_000_000_000;

// ─── buildKey + TTL ───────────────────────────────────────────────────────

test("idempotency/buildKey: produces idem:provider:eventId for any provider/eventId pair", () => {
  assert.equal(buildKey("stripe", "evt_1"), "idem:stripe:evt_1");
  assert.equal(buildKey("github", "123"), "idem:github:123");
  assert.equal(buildKey("internal", "abc-def"), "idem:internal:abc-def");
  assert.equal(buildKey("", ""), "idem::");
});

test("idempotency/DEFAULT_IDEMPOTENCY_TTL_MS: is exactly 24 hours", () => {
  assert.equal(DEFAULT_IDEMPOTENCY_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(DEFAULT_IDEMPOTENCY_TTL_MS, 86_400_000);
});

test("idempotency/isRecordValid: true while now < expiresAtMs, false at or after expiry", () => {
  const record: IdempotencyRecord = {
    key: "idem:stripe:evt_1",
    status: "completed",
    createdAtMs: FIXED_NOW,
    expiresAtMs: FIXED_NOW + 60_000,
  };
  assert.equal(isRecordValid(record, FIXED_NOW), true);
  assert.equal(isRecordValid(record, FIXED_NOW + 59_999), true);
  assert.equal(isRecordValid(record, FIXED_NOW + 60_000), false);
  assert.equal(isRecordValid(record, FIXED_NOW + 120_000), false);
  // Defensive: invalid object → false.
  assert.equal(isRecordValid(null as never, FIXED_NOW), false);
});

// ─── findDuplicates + deduplicateByProviderEventId ────────────────────────

test("idempotency/findDuplicates: returns the second and later occurrences by key, preserving order", () => {
  const items = ["a", "b", "a", "c", "b", "a"];
  const dupes = findDuplicates(items, (s) => s);
  assert.deepEqual(dupes, ["a", "b", "a"]);
});

test("idempotency/findDuplicates: returns an empty array for unique items", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const dupes = findDuplicates(items, (x) => String(x.id));
  assert.deepEqual(dupes, []);
});

test("idempotency/deduplicateByProviderEventId: keeps first occurrence; same eventId across providers is NOT a dupe", () => {
  const items = [
    { provider: "stripe", eventId: "a", n: 1 },
    { provider: "stripe", eventId: "a", n: 2 },
    { provider: "stripe", eventId: "b", n: 3 },
    { provider: "github", eventId: "a", n: 4 },
    { provider: "stripe", eventId: "b", n: 5 },
  ];
  const out = deduplicateByProviderEventId(items);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((x) => x.n),
    [1, 3, 4],
  );
  // Returns a new array even when input is already unique.
  const unique = [
    { provider: "stripe", eventId: "a" },
    { provider: "stripe", eventId: "b" },
  ];
  const out2 = deduplicateByProviderEventId(unique);
  assert.equal(out2.length, 2);
  assert.notEqual(out2, unique);
});

// ─── computePayloadHash ───────────────────────────────────────────────────

test("idempotency/computePayloadHash: matches known SHA-256 vector, deterministic, sensitive to whitespace and content", () => {
  // SHA-256("hello") reference.
  assert.equal(
    computePayloadHash("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
  assert.equal(computePayloadHash("hello").length, 64);
  // Determinism + sensitivity.
  const a = computePayloadHash('{"id":1}');
  const b = computePayloadHash('{"id":1}');
  assert.equal(a, b);
  assert.notEqual(computePayloadHash('{"id":2}'), a);
  assert.notEqual(computePayloadHash('{"id": 1}'), a);
  assert.notEqual(computePayloadHash('{"id":1 }'), a);
});

// ─── classifyError ────────────────────────────────────────────────────────

test("idempotency/classifyError: HTTP 429, 5xx, 4xx, 408, network codes, timeout messages", () => {
  const cases: Array<{ input: { status?: number; code?: string; message?: string }; expected: ErrorClass }> = [
    { input: { status: 429 }, expected: "rate_limit" },
    { input: { status: 500 }, expected: "transient" },
    { input: { status: 502 }, expected: "transient" },
    { input: { status: 503 }, expected: "transient" },
    { input: { status: 400 }, expected: "permanent" },
    { input: { status: 404 }, expected: "permanent" },
    { input: { status: 422 }, expected: "permanent" },
    { input: { status: 408 }, expected: "timeout" },
    { input: { code: "ECONNREFUSED" }, expected: "network" },
    { input: { code: "ENOTFOUND" }, expected: "network" },
    { input: { code: "ECONNRESET" }, expected: "network" },
    { input: { code: "EAI_AGAIN" }, expected: "network" },
    { input: { code: "EPIPE" }, expected: "network" },
    { input: { code: "ETIMEDOUT" }, expected: "timeout" },
    { input: { message: "Request timeout exceeded" }, expected: "timeout" },
    { input: { message: "something broke" }, expected: "unknown" },
    { input: {}, expected: "unknown" },
  ];
  for (const { input, expected } of cases) {
    assert.equal(classifyError(input), expected, `expected ${JSON.stringify(input)} → ${expected}`);
  }
});

// ─── shouldRetry ──────────────────────────────────────────────────────────

test("idempotency/shouldRetry: retries transient/rate_limit/timeout/network; never permanent/unknown; stops at maxAttempts", () => {
  assert.equal(shouldRetry("transient", 0, 3), true);
  assert.equal(shouldRetry("rate_limit", 0, 3), true);
  assert.equal(shouldRetry("timeout", 0, 3), true);
  assert.equal(shouldRetry("network", 0, 3), true);
  assert.equal(shouldRetry("permanent", 0, 3), false);
  assert.equal(shouldRetry("unknown", 0, 3), false);
  // Stops at maxAttempts (attempt < maxAttempts).
  assert.equal(shouldRetry("transient", 2, 3), true);
  assert.equal(shouldRetry("transient", 3, 3), false);
  assert.equal(shouldRetry("rate_limit", 10, 10), false);
});

// ─── calculateBackoff ─────────────────────────────────────────────────────

test("idempotency/calculateBackoff: grows exponentially, caps at maxMs, and respects custom base/cap", () => {
  assert.equal(calculateBackoff(0), 1000);
  assert.equal(calculateBackoff(1), 2000);
  assert.equal(calculateBackoff(2), 4000);
  assert.equal(calculateBackoff(3), 8000);
  // 2^5 * 1000 = 32000 → capped at default max 30000.
  assert.equal(calculateBackoff(5), 30_000);
  assert.equal(calculateBackoff(10), 30_000);
  // Custom cap.
  assert.equal(calculateBackoff(10, { maxMs: 5000 }), 5000);
  // Custom base.
  assert.equal(calculateBackoff(0, { baseMs: 500 }), 500);
  assert.equal(calculateBackoff(2, { baseMs: 500 }), 2000);
});

test("idempotency/calculateBackoff: jitter multiplies by random in [0,1) (full-jitter)", () => {
  // With random=0.5, jittered value = floor(capped * 0.5).
  assert.equal(
    calculateBackoff(2, { jitter: true, random: () => 0.5 }),
    Math.floor(4000 * 0.5),
  );
  assert.equal(calculateBackoff(0, { jitter: true, random: () => 0 }), 0);
  assert.equal(calculateBackoff(1, { jitter: true, random: () => 1 }), 2000);
});

// ─── per-domain key builders ──────────────────────────────────────────────

test("idempotency/buildIdempotencyKey (actions): workspace:mission:payloadHash format", () => {
  const k = buildIdempotencyKey("ws_1", "mis_1", "abc123");
  assert.equal(k, "ws_1:mis_1:abc123");
  // Tenant-isolated (workspaceId is leading segment).
  const otherWs = buildIdempotencyKey("ws_2", "mis_1", "abc123");
  assert.notEqual(k, otherWs);
  // Mission-scoped.
  const otherMis = buildIdempotencyKey("ws_1", "mis_2", "abc123");
  assert.notEqual(k, otherMis);
  // Content-bound (different hash → different key).
  const otherHash = buildIdempotencyKey("ws_1", "mis_1", "def456");
  assert.notEqual(k, otherHash);
});

test("idempotency/buildPaymentIdempotencyKey: pay:workspace:provider:paymentId, lowercases provider, deterministic", () => {
  const a = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "Stripe",
    providerPaymentId: "pi_abc",
  });
  const b = buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "stripe",
    providerPaymentId: "pi_abc",
  });
  assert.equal(a, b);
  assert.equal(a, "pay:ws_1:stripe:pi_abc");
  // Different workspace, provider, or paymentId → different key.
  assert.notEqual(a, buildPaymentIdempotencyKey({
    workspaceId: "ws_2",
    provider: "stripe",
    providerPaymentId: "pi_abc",
  }));
  assert.notEqual(a, buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "paypal",
    providerPaymentId: "pi_abc",
  }));
  assert.notEqual(a, buildPaymentIdempotencyKey({
    workspaceId: "ws_1",
    provider: "stripe",
    providerPaymentId: "pi_xyz",
  }));
});

test("idempotency/buildWebhookDedupKey + buildRateLimitKey: both prefixed to avoid cache namespace collisions", () => {
  assert.equal(buildWebhookDedupKey("stripe", "evt_1"), "wh:stripe:evt_1");
  assert.equal(buildWebhookDedupKey("github", "123"), "wh:github:123");
  assert.equal(buildRateLimitKey("workspace", "ws_1"), "rl:workspace:ws_1");
  assert.equal(buildRateLimitKey("ip", "1.2.3.4", "write"), "rl:ip:1.2.3.4:write");
  // The prefixes are distinct so a webhook key cannot collide with a
  // rate-limit key (or an idempotency-record key).
  const wh = buildWebhookDedupKey("stripe", "evt_1");
  const rl = buildRateLimitKey("stripe", "evt_1");
  const idem = buildKey("stripe", "evt_1");
  assert.notEqual(wh, rl);
  assert.notEqual(wh, idem);
  assert.notEqual(rl, idem);
});

// ─── cross-module invariant ───────────────────────────────────────────────

test("idempotency/cross-module: every key builder returns a non-empty, namespaced string", () => {
  const keys = [
    buildKey("stripe", "evt_1"),
    buildIdempotencyKey("ws_1", "mis_1", "abc"),
    buildPaymentIdempotencyKey({ workspaceId: "ws_1", provider: "stripe", providerPaymentId: "pi_1" }),
    buildWebhookDedupKey("stripe", "evt_1"),
    buildRateLimitKey("ip", "1.2.3.4"),
  ];
  for (const k of keys) {
    assert.ok(typeof k === "string" && k.length > 0, `key ${k} should be a non-empty string`);
    assert.ok(k.includes(":"), `key ${k} should be namespaced (contain ':')`);
  }
  // Each prefix is distinct.
  assert.ok(keys[0].startsWith("idem:"));
  assert.ok(!keys[1].startsWith("idem:") && !keys[1].startsWith("pay:"));
  assert.ok(keys[2].startsWith("pay:"));
  assert.ok(keys[3].startsWith("wh:"));
  assert.ok(keys[4].startsWith("rl:"));
});

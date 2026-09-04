import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildKey,
  calculateBackoff,
  classifyError,
  computePayloadHash,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  deduplicateByProviderEventId,
  findDuplicates,
  isRecordValid,
  shouldRetry,
  type IdempotencyRecord,
} from "../lib/idempotency-pure.ts";

const FIXED_NOW = 1_700_000_000_000;

test("DEFAULT_IDEMPOTENCY_TTL_MS is exactly 24 hours", () => {
  assert.equal(DEFAULT_IDEMPOTENCY_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(DEFAULT_IDEMPOTENCY_TTL_MS, 86_400_000);
});

test("buildKey produces an idem:provider:eventId string", () => {
  assert.equal(buildKey("stripe", "evt_1"), "idem:stripe:evt_1");
  assert.equal(buildKey("github", "123"), "idem:github:123");
});

test("isRecordValid returns true while now < expiresAtMs", () => {
  const record: IdempotencyRecord = {
    key: "idem:stripe:evt_1",
    status: "completed",
    createdAtMs: FIXED_NOW,
    expiresAtMs: FIXED_NOW + 60_000,
  };
  assert.equal(isRecordValid(record, FIXED_NOW), true);
  assert.equal(isRecordValid(record, FIXED_NOW + 59_999), true);
});

test("isRecordValid returns false once now >= expiresAtMs", () => {
  const record: IdempotencyRecord = {
    key: "idem:stripe:evt_1",
    status: "completed",
    createdAtMs: FIXED_NOW,
    expiresAtMs: FIXED_NOW + 60_000,
  };
  assert.equal(isRecordValid(record, FIXED_NOW + 60_000), false);
  assert.equal(isRecordValid(record, FIXED_NOW + 120_000), false);
});

test("findDuplicates returns the second and later occurrences by key", () => {
  const items = ["a", "b", "a", "c", "b", "a"];
  const dupes = findDuplicates(items, (s) => s);
  assert.deepEqual(dupes, ["a", "b", "a"]);
});

test("findDuplicates returns an empty array when there are no duplicates", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const dupes = findDuplicates(items, (x) => String(x.id));
  assert.deepEqual(dupes, []);
  assert.equal(dupes.length, 0);
});

test("deduplicateByProviderEventId keeps the first occurrence of each pair", () => {
  const items = [
    { provider: "stripe", eventId: "a", n: 1 },
    { provider: "stripe", eventId: "a", n: 2 },
    { provider: "stripe", eventId: "b", n: 3 },
    { provider: "github", eventId: "a", n: 4 }, // different provider → not a dupe
    { provider: "stripe", eventId: "b", n: 5 },
  ];
  const out = deduplicateByProviderEventId(items);
  assert.equal(out.length, 3);
  assert.deepEqual(
    out.map((x) => x.n),
    [1, 3, 4],
  );
});

test("deduplicateByProviderEventId returns the input unchanged when unique", () => {
  const items = [
    { provider: "stripe", eventId: "a" },
    { provider: "stripe", eventId: "b" },
  ];
  const out = deduplicateByProviderEventId(items);
  assert.equal(out.length, 2);
  assert.notEqual(out, items, "should return a new array");
});

test("computePayloadHash matches the known SHA-256 vector for 'hello'", () => {
  // SHA-256("hello") — well-known reference digest.
  assert.equal(
    computePayloadHash("hello"),
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

test("computePayloadHash is deterministic and sensitive to input changes", () => {
  const a = computePayloadHash('{"id":1}');
  const b = computePayloadHash('{"id":1}');
  assert.equal(a, b);
  assert.notEqual(computePayloadHash('{"id":2}'), a);
  assert.notEqual(computePayloadHash('{"id":1 }'), a);
  assert.equal(computePayloadHash("").length, 64);
});

test("classifyError maps HTTP 429, 5xx, 4xx, and network codes", () => {
  assert.equal(classifyError({ status: 429 }), "rate_limit");
  assert.equal(classifyError({ status: 500 }), "transient");
  assert.equal(classifyError({ status: 503 }), "transient");
  assert.equal(classifyError({ status: 400 }), "permanent");
  assert.equal(classifyError({ status: 404 }), "permanent");
  assert.equal(classifyError({ status: 422 }), "permanent");
  assert.equal(classifyError({ code: "ECONNREFUSED" }), "network");
  assert.equal(classifyError({ code: "ENOTFOUND" }), "network");
  assert.equal(classifyError({ code: "ECONNRESET" }), "network");
  assert.equal(classifyError({ code: "ETIMEDOUT" }), "timeout");
  assert.equal(classifyError({ status: 408 }), "timeout");
  assert.equal(classifyError({ message: "Request timeout exceeded" }), "timeout");
  assert.equal(classifyError({ message: "something broke" }), "unknown");
  assert.equal(classifyError({}), "unknown");
});

test("shouldRetry retries transient, rate_limit, timeout, and network errors", () => {
  assert.equal(shouldRetry("transient", 0, 3), true);
  assert.equal(shouldRetry("rate_limit", 1, 3), true);
  assert.equal(shouldRetry("timeout", 2, 3), true);
  assert.equal(shouldRetry("network", 0, 3), true);
  // Up to but not including maxAttempts.
  assert.equal(shouldRetry("transient", 2, 3), true);
  assert.equal(shouldRetry("transient", 3, 3), false);
});

test("shouldRetry never retries permanent or unknown errors", () => {
  assert.equal(shouldRetry("permanent", 0, 3), false);
  assert.equal(shouldRetry("unknown", 0, 3), false);
  // Even with attempts remaining.
  assert.equal(shouldRetry("permanent", 1, 5), false);
});

test("calculateBackoff grows exponentially and caps at maxMs", () => {
  assert.equal(calculateBackoff(0), 1000);
  assert.equal(calculateBackoff(1), 2000);
  assert.equal(calculateBackoff(2), 4000);
  assert.equal(calculateBackoff(3), 8000);
  // 2^5 * 1000 = 32000 → capped at default max 30000.
  assert.equal(calculateBackoff(5), 30_000);
  assert.equal(calculateBackoff(10), 30_000);
  // Custom cap.
  assert.equal(calculateBackoff(10, { maxMs: 5000 }), 5000);
});

test("calculateBackoff applies full jitter using the injected RNG", () => {
  // With random=0.5, jittered value = floor(capped * 0.5).
  assert.equal(
    calculateBackoff(2, { jitter: true, random: () => 0.5 }),
    Math.floor(4000 * 0.5),
  );
  assert.equal(calculateBackoff(0, { jitter: true, random: () => 0 }), 0);
  assert.equal(
    calculateBackoff(1, { jitter: true, random: () => 1 }),
    // random()=1 → floor(2000 * 1) = 2000 (but capped, then * 1)
    2000,
  );
  // Custom base propagates through.
  assert.equal(
    calculateBackoff(0, { baseMs: 500, jitter: true, random: () => 0.5 }),
    250,
  );
});

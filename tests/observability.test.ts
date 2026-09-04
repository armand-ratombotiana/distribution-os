import assert from "node:assert/strict";
import test from "node:test";

import {
  createMetric,
  createLogEntry,
  formatLogLine,
  shouldLog,
  createLatencyBuckets,
  recordLatency,
  calculateP50,
  calculateP99,
  calculateErrorRate,
  generateCorrelationId,
  MISSION_METRICS,
  SLO_TARGETS,
} from "../lib/observability-pure";

test("createMetric returns a metric object with required fields", () => {
  const metric = createMetric({
    name: "missions_created",
    value: 5,
    unit: "missions",
    tags: { workspace: "ws1" },
    timestamp: 123,
  });
  assert.equal(metric.name, "missions_created");
  assert.equal(metric.value, 5);
  assert.equal(metric.unit, "missions");
  assert.deepEqual(metric.tags, { workspace: "ws1" });
  assert.equal(metric.timestamp, 123);

  // Timestamp defaults to Date.now() when not provided.
  const fallback = createMetric({ name: "x", value: 1 });
  assert.ok(fallback.timestamp > 0);
});

test("createLogEntry returns a structured log entry", () => {
  const entry = createLogEntry({
    level: "warn",
    message: "slow query",
    missionId: "m1",
    timestamp: 456,
  });
  assert.equal(entry.level, "warn");
  assert.equal(entry.message, "slow query");
  assert.equal(entry.missionId, "m1");
  assert.equal(entry.timestamp, 456);
});

test("formatLogLine starts with an ISO timestamp", () => {
  const ts = 1_700_000_000_000;
  const entry = createLogEntry({
    level: "info",
    message: "hello",
    timestamp: ts,
  });
  const line = formatLogLine(entry);
  assert.ok(line.startsWith(new Date(ts).toISOString()));
});

test("formatLogLine contains the level uppercased", () => {
  const entry = createLogEntry({
    level: "info",
    message: "hello",
    timestamp: 1,
  });
  assert.match(formatLogLine(entry), /\bINFO\b/);
  const warn = createLogEntry({
    level: "warn",
    message: "careful",
    timestamp: 1,
  });
  assert.match(formatLogLine(warn), /\bWARN\b/);
});

test("formatLogLine includes the correlation id in brackets", () => {
  const entry = createLogEntry({
    level: "info",
    message: "hello",
    correlationId: "abc-123",
    timestamp: 1,
  });
  assert.match(formatLogLine(entry), /\[abc-123\]/);
});

test("shouldLog returns false for debug entries when minLevel is info", () => {
  const entry = createLogEntry({
    level: "debug",
    message: "trace",
    timestamp: 1,
  });
  assert.equal(shouldLog(entry, { minLevel: "info" }), false);
});

test("shouldLog returns true for warn entries when minLevel is info", () => {
  const entry = createLogEntry({
    level: "warn",
    message: "watch out",
    timestamp: 1,
  });
  assert.equal(shouldLog(entry, { minLevel: "info" }), true);
  // Default minLevel is info.
  assert.equal(shouldLog(entry, {}), true);
});

test("shouldLog filters by correlation id when provided", () => {
  const entry = createLogEntry({
    level: "info",
    message: "x",
    correlationId: "abc",
    timestamp: 1,
  });
  assert.equal(shouldLog(entry, { correlationId: "abc" }), true);
  assert.equal(shouldLog(entry, { correlationId: "xyz" }), false);
});

test("createLatencyBuckets initializes empty buckets", () => {
  const buckets = createLatencyBuckets();
  assert.equal(buckets.count, 0);
  assert.equal(buckets.sum, 0);
  assert.equal(buckets.values.length, 0);
  assert.equal(buckets.buckets["+Inf"], 0);
  assert.ok("<=50" in buckets.buckets);
  assert.ok("<=10000" in buckets.buckets);
});

test("recordLatency increments count and places each value in the right bucket", () => {
  let buckets = createLatencyBuckets();
  buckets = recordLatency(buckets, 30);
  buckets = recordLatency(buckets, 200);
  buckets = recordLatency(buckets, 20000);
  assert.equal(buckets.count, 3);
  assert.equal(buckets.sum, 30 + 200 + 20000);
  assert.equal(buckets.buckets["<=50"], 1);
  assert.equal(buckets.buckets["<=250"], 1);
  assert.equal(buckets.buckets["+Inf"], 1);
  assert.deepEqual(buckets.values, [30, 200, 20000]);
});

test("calculateP50 returns the median value", () => {
  assert.equal(calculateP50([10, 20, 30, 40, 50]), 30);
  assert.equal(calculateP50([5]), 5);
  assert.equal(calculateP50([]), 0);
});

test("calculateP99 returns the 99th percentile value", () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(calculateP99(values), 99);
  assert.equal(calculateP99([10, 20, 30]), 30);
});

test("calculateErrorRate returns the ratio and 0 when there are no requests", () => {
  assert.equal(calculateErrorRate(100, 5), 0.05);
  assert.equal(calculateErrorRate(0, 0), 0);
  assert.equal(calculateErrorRate(50, 0), 0);
});

test("generateCorrelationId returns unique values", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    ids.add(generateCorrelationId());
  }
  assert.equal(ids.size, 100);

  const prefixed = generateCorrelationId("mission");
  assert.ok(prefixed.startsWith("mission-"));
});

test("MISSION_METRICS and SLO_TARGETS expose expected keys", () => {
  assert.ok("missions_created" in MISSION_METRICS);
  assert.ok("first_payment_latency_ms" in MISSION_METRICS);
  assert.ok("payments_confirmed" in MISSION_METRICS);
  assert.ok("api_p99_latency_ms" in SLO_TARGETS);
  assert.ok("api_error_rate" in SLO_TARGETS);
  assert.equal(SLO_TARGETS.api_error_rate, 0.01);
  assert.equal(SLO_TARGETS.api_p99_latency_ms, 1000);
});

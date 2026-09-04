import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateUptime,
  DEFAULT_HEALTH_THRESHOLDS,
  getHealthScore,
  scoreToStatus,
  shouldAlert,
  type HealthCheckResult,
  type HealthMetrics,
} from "../lib/health-check-pure.ts";

function check(status: HealthCheckResult["status"], latencyMs = 50): HealthCheckResult {
  return { name: "x", status, latencyMs, atMs: 0 };
}

test("calculateUptime returns 1 for an empty list (no failures observed)", () => {
  assert.equal(calculateUptime([]), 1);
});

test("calculateUptime counts both healthy and degraded as up", () => {
  const checks = [
    check("healthy"),
    check("degraded"),
    check("healthy"),
    check("degraded"),
  ];
  assert.equal(calculateUptime(checks), 1);
});

test("calculateUptime excludes unhealthy checks from the up count", () => {
  const checks = [
    check("healthy"),
    check("unhealthy"),
    check("healthy"),
    check("unhealthy"),
  ];
  assert.equal(calculateUptime(checks), 0.5);
  // Three unhealthy of ten → 0.7 uptime.
  const many: HealthCheckResult[] = [
    ...Array.from({ length: 7 }, () => check("healthy")),
    ...Array.from({ length: 3 }, () => check("unhealthy")),
  ];
  assert.equal(calculateUptime(many), 0.7);
});

test("getHealthScore returns 100 when everything is healthy with low latency", () => {
  const metrics: HealthMetrics = {
    healthyRatio: 1,
    degradedRatio: 0,
    avgLatencyMs: 50,
    p95LatencyMs: 80,
    staleChecks: 0,
  };
  assert.equal(getHealthScore(metrics), 100);
});

test("getHealthScore drops as the healthy ratio drops", () => {
  const full: HealthMetrics = {
    healthyRatio: 1,
    degradedRatio: 0,
    avgLatencyMs: 50,
    p95LatencyMs: 80,
    staleChecks: 0,
  };
  const half: HealthMetrics = { ...full, healthyRatio: 0.5 };
  // 50% weight on availability + 20% weight on healthy purity: a 50% drop
  // in healthy ratio costs 25 (availability) + 10 (purity) = 35 points.
  assert.equal(getHealthScore(full), 100);
  assert.equal(getHealthScore(half), 65);
});

test("getHealthScore drops as average latency grows", () => {
  const base: HealthMetrics = {
    healthyRatio: 1,
    degradedRatio: 0,
    avgLatencyMs: 50,
    p95LatencyMs: 80,
    staleChecks: 0,
  };
  const slow: HealthMetrics = { ...base, avgLatencyMs: 550 };
  // At 550ms latency, latency score = 1 - (550-50)/500 = 0 → lose 20 points.
  assert.equal(getHealthScore(slow), 80);
  const mid: HealthMetrics = { ...base, avgLatencyMs: 300 };
  // 1 - (300-50)/500 = 0.5 → 10 of 20 points → score = 90.
  assert.equal(getHealthScore(mid), 90);
});

test("getHealthScore drops with stale checks", () => {
  const base: HealthMetrics = {
    healthyRatio: 1,
    degradedRatio: 0,
    avgLatencyMs: 50,
    p95LatencyMs: 80,
    staleChecks: 0,
  };
  const stale5: HealthMetrics = { ...base, staleChecks: 5 };
  // 5 stale checks × 10% = 50% freshness loss → lose 5 of 10 points.
  assert.equal(getHealthScore(stale5), 95);
  // 10+ stale checks → freshness = 0 → lose all 10 points.
  const stale10: HealthMetrics = { ...base, staleChecks: 10 };
  assert.equal(getHealthScore(stale10), 90);
});

test("scoreToStatus maps scores to healthy / degraded / unhealthy", () => {
  assert.equal(scoreToStatus(100), "healthy");
  assert.equal(scoreToStatus(80), "healthy");
  assert.equal(scoreToStatus(79), "degraded");
  assert.equal(scoreToStatus(40), "degraded");
  assert.equal(scoreToStatus(39), "unhealthy");
  assert.equal(scoreToStatus(0), "unhealthy");
});

test("shouldAlert returns true for unhealthy status regardless of score", () => {
  assert.equal(shouldAlert("unhealthy", 90, 60), true);
  assert.equal(shouldAlert("unhealthy", 0, 60), true);
});

test("shouldAlert returns true for degraded status below the alert threshold (and false otherwise)", () => {
  // Degraded + score below threshold → alert.
  assert.equal(shouldAlert("degraded", 50, 60), true);
  // Degraded + score at or above threshold → no alert.
  assert.equal(shouldAlert("degraded", 60, 60), false);
  assert.equal(shouldAlert("degraded", 75, 60), false);
  // Healthy never alerts.
  assert.equal(shouldAlert("healthy", 90, 60), false);
  assert.equal(shouldAlert("healthy", 10, 60), false);
  // DEFAULT_HEALTH_THRESHOLDS exposes the expected defaults.
  assert.equal(DEFAULT_HEALTH_THRESHOLDS.alertScore, 60);
  assert.equal(DEFAULT_HEALTH_THRESHOLDS.healthyScore, 80);
  assert.equal(DEFAULT_HEALTH_THRESHOLDS.unhealthyScore, 40);
  assert.ok(DEFAULT_HEALTH_THRESHOLDS.healthyScore > DEFAULT_HEALTH_THRESHOLDS.unhealthyScore);
});

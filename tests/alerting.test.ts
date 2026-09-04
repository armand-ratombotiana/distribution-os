import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareAlertLevels,
  dedupeKeyFor,
  getAlertMessage,
  isCritical,
  shouldAlert,
  sortBySeverity,
  type Alert,
  type AlertContext,
} from "../lib/alerting-pure.ts";

const NOW = 1_700_000_000_000;

function baseAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "a1",
    kind: "high-latency",
    level: "warning",
    title: "Latency spike",
    message: "p99 latency exceeded 1s",
    source: "api",
    createdAtMs: NOW,
    ...overrides,
  };
}

function baseContext(overrides: Partial<AlertContext> = {}): AlertContext {
  return {
    alert: baseAlert(),
    minLevel: "info",
    nowMs: NOW,
    suppressionWindowMs: 60_000,
    ...overrides,
  };
}

test("shouldAlert returns true when level is at or above threshold", () => {
  const result = shouldAlert(baseContext({ alert: baseAlert({ level: "error" }), minLevel: "warning" }));
  assert.equal(result.shouldAlert, true);
});

test("shouldAlert returns false when level is below threshold", () => {
  const result = shouldAlert(baseContext({ alert: baseAlert({ level: "debug" }), minLevel: "info" }));
  assert.equal(result.shouldAlert, false);
  assert.match((result as { reason: string }).reason, /below threshold/);
});

test("shouldAlert suppresses when the same kind+source fired within the window", () => {
  const result = shouldAlert(
    baseContext({
      lastFiredAtMs: NOW - 30_000,
      suppressionWindowMs: 60_000,
    }),
  );
  assert.equal(result.shouldAlert, false);
  assert.match((result as { reason: string }).reason, /suppression window/);
});

test("shouldAlert fires when the suppression window has elapsed", () => {
  const result = shouldAlert(
    baseContext({
      lastFiredAtMs: NOW - 90_000,
      suppressionWindowMs: 60_000,
    }),
  );
  assert.equal(result.shouldAlert, true);
});

test("shouldAlert suppresses when the dedupe key is already active", () => {
  const result = shouldAlert(
    baseContext({
      activeDedupeKeys: new Set(["high-latency:api"]),
    }),
  );
  assert.equal(result.shouldAlert, false);
  assert.match((result as { reason: string }).reason, /dedupe key/);
});

test("dedupeKeyFor combines kind and source", () => {
  assert.equal(dedupeKeyFor(baseAlert()), "high-latency:api");
  assert.equal(
    dedupeKeyFor({ kind: "disk-full", source: "host-1" }),
    "disk-full:host-1",
  );
});

test("getAlertMessage includes level, title, source/kind, message", () => {
  const msg = getAlertMessage(baseAlert());
  assert.match(msg, /^\[WARNING\]/);
  assert.ok(msg.includes("Latency spike"));
  assert.ok(msg.includes("(api/high-latency)"));
  assert.ok(msg.includes("p99 latency exceeded 1s"));
});

test("getAlertMessage includes the value and labels when present", () => {
  const msg = getAlertMessage(
    baseAlert({
      level: "critical",
      value: 1.42,
      labels: { region: "us-east", host: "h1" },
    }),
  );
  assert.match(msg, /^\[CRITICAL\]/);
  assert.ok(msg.includes("value=1.42"));
  assert.ok(msg.includes("[region=us-east,host=h1]"));
});

test("isCritical returns true only for the critical level", () => {
  assert.equal(isCritical(baseAlert({ level: "critical" })), true);
  assert.equal(isCritical(baseAlert({ level: "error" })), false);
  assert.equal(isCritical(baseAlert({ level: "info" })), false);
});

test("compareAlertLevels and sortBySeverity order by severity desc", () => {
  assert.equal(compareAlertLevels("debug", "critical") < 0, true);
  assert.equal(compareAlertLevels("critical", "critical"), 0);
  assert.equal(compareAlertLevels("error", "warning") > 0, true);

  const alerts: Alert[] = [
    baseAlert({ id: "1", level: "info", createdAtMs: NOW }),
    baseAlert({ id: "2", level: "critical", createdAtMs: NOW - 1000 }),
    baseAlert({ id: "3", level: "warning", createdAtMs: NOW + 1000 }),
  ];
  const sorted = sortBySeverity(alerts);
  assert.deepEqual(
    sorted.map((a) => a.id),
    ["2", "3", "1"],
  );
});


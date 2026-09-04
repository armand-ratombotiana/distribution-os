import assert from "node:assert/strict";
import test from "node:test";

import {
  windowToMs,
  startOffsetToMs,
  isWithinWindow,
  calculateWindowStats,
  type AttributionWindow,
  type WindowStatsInput,
} from "../lib/attribution-window-pure.ts";

const DAY = 86_400_000;

test("windowToMs converts each supported unit to milliseconds", () => {
  assert.equal(windowToMs({ length: 1, unit: "ms" }), 1);
  assert.equal(windowToMs({ length: 1, unit: "second" }), 1_000);
  assert.equal(windowToMs({ length: 1, unit: "minute" }), 60_000);
  assert.equal(windowToMs({ length: 1, unit: "hour" }), 3_600_000);
  assert.equal(windowToMs({ length: 1, unit: "day" }), DAY);
  assert.equal(windowToMs({ length: 1, unit: "week" }), 7 * DAY);
});

test("windowToMs defaults to days and returns 0 for invalid input", () => {
  assert.equal(windowToMs({ length: 7 }), 7 * DAY);
  assert.equal(windowToMs({ length: -1 }), 0);
  assert.equal(windowToMs({ length: NaN }), 0);
  assert.equal(windowToMs(null as unknown as AttributionWindow), 0);
});

test("startOffsetToMs returns 0 by default and respects the same unit", () => {
  assert.equal(startOffsetToMs({ length: 7, unit: "day" }), 0);
  assert.equal(startOffsetToMs({ length: 7, unit: "hour", startOffset: 1 }), 3_600_000);
});

test("isWithinWindow returns true for a conversion that falls inside the window", () => {
  const w: AttributionWindow = { length: 7, unit: "day" };
  assert.equal(isWithinWindow(0, 3 * DAY, w), true);
  assert.equal(isWithinWindow(1000, 1000 + 6 * DAY, w), true);
});

test("isWithinWindow returns false for a conversion before the touchpoint", () => {
  const w: AttributionWindow = { length: 7, unit: "day" };
  assert.equal(isWithinWindow(10 * DAY, 5 * DAY, w), false);
});

test("isWithinWindow returns false for a conversion past the window length", () => {
  const w: AttributionWindow = { length: 7, unit: "day" };
  assert.equal(isWithinWindow(0, 8 * DAY, w), false);
});

test("isWithinWindow respects a startOffset (delayed window)", () => {
  const w: AttributionWindow = { length: 7, unit: "day", startOffset: 1 };
  // During the first day → not yet within the window
  assert.equal(isWithinWindow(0, 0.5 * DAY, w), false);
  // After the offset, inside the window
  assert.equal(isWithinWindow(0, 2 * DAY, w), true);
});

test("isWithinWindow returns false for non-finite timestamps or zero-length windows", () => {
  assert.equal(isWithinWindow(NaN, 100, { length: 1, unit: "day" }), false);
  assert.equal(isWithinWindow(0, 100, { length: 0, unit: "day" }), false);
});

test("calculateWindowStats aggregates attributed vs unattributed conversions", () => {
  const w: AttributionWindow = { length: 7, unit: "day" };
  const inputs: WindowStatsInput[] = [
    { touchpointMs: 0, conversionMs: 1 * DAY, window: w },
    { touchpointMs: 0, conversionMs: 3 * DAY, window: w },
    { touchpointMs: 0, conversionMs: 30 * DAY, window: w },
    { touchpointMs: 0, conversionMs: -1 * DAY, window: w },
  ];
  const stats = calculateWindowStats(inputs);
  assert.equal(stats.attributed, 2);
  assert.equal(stats.unattributed, 2);
  assert.equal(stats.total, 4);
  assert.ok(Math.abs(stats.attributionRate - 0.5) < 1e-9);
  // average lag = (1 + 3) / 2 = 2 days in ms
  assert.equal(stats.averageLagMs, 2 * DAY);
});

test("calculateWindowStats returns zeros for an empty input list", () => {
  const stats = calculateWindowStats([]);
  assert.equal(stats.attributed, 0);
  assert.equal(stats.unattributed, 0);
  assert.equal(stats.total, 0);
  assert.equal(stats.attributionRate, 0);
  assert.equal(stats.averageLagMs, 0);
});

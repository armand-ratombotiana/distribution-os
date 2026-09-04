import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  subtractDays,
  isWeekend,
  isToday,
  getWeekNumber,
  formatDuration,
  parseDateRange,
} from "../lib/date-utils-pure";

test("addDays adds whole days to a date (including month rollover)", () => {
  const next = addDays(new Date(2024, 0, 1), 5);
  assert.equal(next.getFullYear(), 2024);
  assert.equal(next.getMonth(), 0);
  assert.equal(next.getDate(), 6);
  // 2024-01-31 + 1 day → 2024-02-01.
  const rolled = addDays(new Date(2024, 0, 31), 1);
  assert.equal(rolled.getMonth(), 1);
  assert.equal(rolled.getDate(), 1);
});

test("addDays accepts strings/epoch numbers and returns Invalid Date for bad input", () => {
  const fromStr = addDays("2024-01-10T00:00:00Z", 1);
  assert.ok(fromStr instanceof Date);
  assert.ok(!Number.isNaN(fromStr.getTime()));
  assert.ok(Number.isNaN(addDays("not-a-date", 1).getTime()));
  assert.ok(Number.isNaN(addDays(new Date(2024, 0, 1), NaN).getTime()));
});

test("subtractDays removes whole days from a date (including month underflow)", () => {
  const next = subtractDays(new Date(2024, 0, 10), 5);
  assert.equal(next.getDate(), 5);
  assert.equal(next.getMonth(), 0);
  // 2024-02-01 - 1 day → 2024-01-31.
  const under = subtractDays(new Date(2024, 1, 1), 1);
  assert.equal(under.getMonth(), 0);
  assert.equal(under.getDate(), 31);
});

test("isWeekend returns true for Saturday/Sunday and false for weekdays", () => {
  // 2024-01-06 is a Saturday, 2024-01-07 is a Sunday.
  assert.equal(isWeekend(new Date(2024, 0, 6)), true);
  assert.equal(isWeekend(new Date(2024, 0, 7)), true);
  // 2024-01-01 is a Monday, 2024-01-05 is a Friday.
  assert.equal(isWeekend(new Date(2024, 0, 1)), false);
  assert.equal(isWeekend(new Date(2024, 0, 5)), false);
  assert.equal(isWeekend("not-a-date"), false);
});

test("isToday returns true for the current date and false for a different day", () => {
  const now = new Date(2024, 5, 15, 12, 0, 0);
  assert.equal(isToday(new Date(2024, 5, 15, 0, 0, 0), now), true);
  assert.equal(isToday(new Date(2024, 5, 14, 23, 59, 59), now), false);
  assert.equal(isToday(new Date(2024, 6, 15), now), false);
});

test("getWeekNumber returns the ISO week for known dates", () => {
  // 2024-01-01 is a Monday — ISO week 1 of 2024.
  assert.equal(getWeekNumber(new Date(2024, 0, 1)), 1);
  // 2023-01-01 is a Sunday, ISO week 52 of 2022.
  assert.equal(getWeekNumber(new Date(2023, 0, 1)), 52);
  // 2024-12-31 is a Tuesday, ISO week 1 of 2025.
  assert.equal(getWeekNumber(new Date(2024, 11, 31)), 1);
});

test("getWeekNumber returns NaN for invalid dates", () => {
  assert.ok(Number.isNaN(getWeekNumber("not-a-date")));
});

test("formatDuration formats milliseconds as h/m/s and clamps bad inputs to 0s", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(5_000), "5s");
  assert.equal(formatDuration(65_000), "1m 5s");
  assert.equal(formatDuration(3_661_000), "1h 1m 1s");
  assert.equal(formatDuration(-5), "0s");
  assert.equal(formatDuration(Infinity), "0s");
  assert.equal(formatDuration(NaN), "0s");
});

test("parseDateRange returns ok for a valid range", () => {
  const r = parseDateRange("2024-01-01", "2024-01-31");
  assert.equal(r.ok, true);
  assert.ok(r.start.getTime() <= r.end.getTime());
});

test("parseDateRange accepts Date and epoch inputs and preserves their times", () => {
  const start = new Date(2024, 5, 15, 9, 0, 0);
  const end = new Date(2024, 5, 20, 17, 30, 0);
  const r = parseDateRange(start, end.getTime());
  assert.equal(r.ok, true);
  assert.equal(r.start.getTime(), start.getTime());
  assert.equal(r.end.getTime(), end.getTime());
});

test("parseDateRange rejects ranges where start is after end", () => {
  const r = parseDateRange("2024-02-01", "2024-01-01");
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /before/);
});

test("parseDateRange rejects invalid inputs", () => {
  const r = parseDateRange("garbage", "2024-01-01");
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /start/i);
});

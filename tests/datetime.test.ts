import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SECOND_MS,
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  WEEK_MS,
  MONTH_MS,
  YEAR_MS,
  formatRelativeTime,
  formatDuration,
  formatExpiry,
  formatDate,
  formatDateTime,
  isExpired,
  isExpiringSoon,
  getStartOfDay,
  getEndOfDay,
  getDaysBetween,
  parseIsoDate,
  toIsoString,
} from "../lib/datetime-pure.js";

const NOW = new Date("2024-06-15T12:00:00.000Z");

test("millisecond constants relate to each other correctly", () => {
  assert.equal(SECOND_MS, 1000);
  assert.equal(MINUTE_MS, 60 * SECOND_MS);
  assert.equal(HOUR_MS, 60 * MINUTE_MS);
  assert.equal(DAY_MS, 24 * HOUR_MS);
  assert.equal(WEEK_MS, 7 * DAY_MS);
  assert.equal(MONTH_MS, 30 * DAY_MS);
  assert.equal(YEAR_MS, 365 * DAY_MS);
});

test('formatRelativeTime returns "just now" for very recent moments', () => {
  assert.equal(formatRelativeTime(new Date(NOW.getTime() + 5_000), NOW), "just now");
  assert.equal(formatRelativeTime(new Date(NOW.getTime() - 30_000), NOW), "just now");
});

test("formatRelativeTime uses past tense for earlier dates", () => {
  const fiveMinutesAgo = new Date(NOW.getTime() - 5 * MINUTE_MS);
  assert.equal(formatRelativeTime(fiveMinutesAgo, NOW), "5 minutes ago");
});

test("formatRelativeTime uses future tense for later dates", () => {
  const inThreeHours = new Date(NOW.getTime() + 3 * HOUR_MS);
  assert.equal(formatRelativeTime(inThreeHours, NOW), "in 3 hours");
});

test("formatDuration collapses hours, minutes and seconds into a compact string", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(45 * 1000), "45s");
  assert.equal(formatDuration(2 * 60 * 1000 + 5 * 1000), "2m 5s");
  assert.equal(formatDuration(3 * 3600_000 + 2 * 60_000), "3h 2m");
});

test('formatExpiry returns "expired" for past dates', () => {
  assert.equal(formatExpiry(new Date(NOW.getTime() - 10_000), NOW), "expired");
});

test("formatExpiry describes a future expiry window", () => {
  const inFiveMinutes = new Date(NOW.getTime() + 5 * MINUTE_MS);
  assert.equal(formatExpiry(inFiveMinutes, NOW), "expires in 5 minutes");
  const inTwoDays = new Date(NOW.getTime() + 2 * DAY_MS);
  assert.equal(formatExpiry(inTwoDays, NOW), "expires in 2 days");
});

test("formatDate returns a YYYY-MM-DD string in UTC", () => {
  assert.equal(formatDate("2024-06-15T12:00:00.000Z"), "2024-06-15");
});

test("formatDateTime and toIsoString both return the full ISO 8601 string", () => {
  const iso = "2024-06-15T12:00:00.000Z";
  assert.equal(formatDateTime(iso), iso);
  assert.equal(toIsoString(new Date(iso)), iso);
});

test("isExpired returns true for past dates and false for future dates", () => {
  assert.equal(isExpired(new Date(NOW.getTime() - 1000), NOW), true);
  assert.equal(isExpired(new Date(NOW.getTime() + 1000), NOW), false);
});

test("isExpiringSoon returns true when within the threshold and not yet expired", () => {
  const soon = new Date(NOW.getTime() + 6 * HOUR_MS);
  assert.equal(isExpiringSoon(soon, DAY_MS, NOW), true);
  const far = new Date(NOW.getTime() + 10 * DAY_MS);
  assert.equal(isExpiringSoon(far, DAY_MS, NOW), false);
  const past = new Date(NOW.getTime() - 1000);
  assert.equal(isExpiringSoon(past, DAY_MS, NOW), false);
});

test("getStartOfDay returns local midnight for the given date", () => {
  const start = getStartOfDay(new Date("2024-06-15T12:34:56.789Z"));
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(start.getSeconds(), 0);
  assert.equal(start.getMilliseconds(), 0);
});

test("getEndOfDay returns local 23:59:59.999 for the given date", () => {
  const end = getEndOfDay(new Date("2024-06-15T12:34:56.789Z"));
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
  assert.equal(end.getMilliseconds(), 999);
});

test("getDaysBetween counts whole calendar days between two dates", () => {
  assert.equal(
    getDaysBetween("2024-06-10T12:00:00Z", "2024-06-15T08:00:00Z"),
    5,
  );
  assert.equal(
    getDaysBetween("2024-06-15T00:00:00Z", "2024-06-15T23:59:59Z"),
    0,
  );
});

test("parseIsoDate throws when given a non-date string", () => {
  assert.throws(() => parseIsoDate("not a date"), /Invalid ISO date/);
});

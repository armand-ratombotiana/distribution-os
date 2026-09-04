/**
 * Pure date utility functions. All functions are side-effect free;
 * `now` is accepted as an explicit parameter where it matters so that
 * time-based checks are deterministic in tests.
 *
 * Day arithmetic operates on local time (matching `Date.getDate`) so the
 * results are stable across DST boundaries when the unit is whole days.
 */

type DateInput = Date | number | string;

function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Add `days` calendar days to `value` and return a new Date. Negative
 * values subtract days. Time-of-day is preserved.
 *
 *   addDays("2024-01-01", 5) // 2024-01-06
 */
export function addDays(value: DateInput, days: number): Date {
  const date = toDate(value);
  if (!isValidDate(date) || !Number.isFinite(days)) {
    return new Date(NaN);
  }
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  return next;
}

/**
 * Subtract `days` calendar days from `value` and return a new Date.
 * Equivalent to `addDays(value, -days)`.
 */
export function subtractDays(value: DateInput, days: number): Date {
  return addDays(value, -days);
}

/**
 * Return `true` when `value` falls on a Saturday or Sunday (local time).
 */
export function isWeekend(value: DateInput): boolean {
  const date = toDate(value);
  if (!isValidDate(date)) return false;
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Return `true` when `value` falls on the same calendar day as `now`
 * (default: the current date).
 */
export function isToday(value: DateInput, now: Date | number = Date.now()): boolean {
  const date = toDate(value);
  const nowDate = toDate(now);
  if (!isValidDate(date) || !isValidDate(nowDate)) return false;
  return (
    date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth() &&
    date.getDate() === nowDate.getDate()
  );
}

/**
 * Return the ISO 8601 week number (1-53) for `value`.
 *
 * ISO weeks start on Monday, and the first week of the year is the one
 * that contains the first Thursday (equivalently, the week containing
 * January 4th).
 */
export function getWeekNumber(value: DateInput): number {
  const date = toDate(value);
  if (!isValidDate(date)) return NaN;
  // Copy the date so we don't mutate the input.
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7; // make Sunday 7, not 0
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return weekNo;
}

/**
 * Format a duration in milliseconds as a `1h 2m 3s`-style string.
 *
 *   formatDuration(0)                  // "0s"
 *   formatDuration(65_000)             // "1m 5s"
 *   formatDuration(3_661_000)          // "1h 1m 1s"
 *   formatDuration(-1)                 // "0s"
 */
export function formatDuration(ms: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export type ParsedDateRange = {
  start: Date;
  end: Date;
  ok: boolean;
  error?: string;
};

/**
 * Parse a pair of date inputs into a `{ start, end }` range.
 *
 * - Accepts `Date`, epoch milliseconds, or ISO date strings.
 * - `start` must be earlier than or equal to `end`.
 * - Returns `{ ok: false, error }` on invalid input.
 *
 *   parseDateRange("2024-01-01", "2024-01-31")
 */
export function parseDateRange(
  start: DateInput,
  end: DateInput,
): ParsedDateRange {
  const startDate = toDate(start);
  if (!isValidDate(startDate)) {
    return { start: new Date(NaN), end: new Date(NaN), ok: false, error: "Invalid start date" };
  }
  const endDate = toDate(end);
  if (!isValidDate(endDate)) {
    return { start: new Date(NaN), end: new Date(NaN), ok: false, error: "Invalid end date" };
  }
  if (startDate.getTime() > endDate.getTime()) {
    return {
      start: startDate,
      end: endDate,
      ok: false,
      error: "Start date must be before or equal to end date",
    };
  }
  return { start: startDate, end: endDate, ok: true };
}

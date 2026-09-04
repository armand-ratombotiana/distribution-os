/**
 * Pure date/time formatting helpers. Operate on Date, number (epoch ms), or
 * ISO string inputs. All functions are deterministic given their inputs;
 * the default `now` is `Date.now()` but can be overridden for testing.
 */

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
export const MONTH_MS = 30 * DAY_MS;
export const YEAR_MS = 365 * DAY_MS;

type DateInput = Date | number | string;

function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

function toNow(value: Date | number = Date.now()): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Formats a date/time as a human-readable relative phrase. */
export function formatRelativeTime(
  value: DateInput,
  now: Date | number = Date.now(),
): string {
  const date = toDate(value);
  const nowDate = toNow(now);
  const diffMs = date.getTime() - nowDate.getTime();
  const past = diffMs < 0;
  const absMs = Math.abs(diffMs);
  if (absMs < MINUTE_MS) return "just now";
  let amount: number;
  let unit: string;
  if (absMs < HOUR_MS) {
    amount = Math.floor(absMs / MINUTE_MS);
    unit = "minute";
  } else if (absMs < DAY_MS) {
    amount = Math.floor(absMs / HOUR_MS);
    unit = "hour";
  } else if (absMs < WEEK_MS) {
    amount = Math.floor(absMs / DAY_MS);
    unit = "day";
  } else if (absMs < MONTH_MS) {
    amount = Math.floor(absMs / WEEK_MS);
    unit = "week";
  } else if (absMs < YEAR_MS) {
    amount = Math.floor(absMs / MONTH_MS);
    unit = "month";
  } else {
    amount = Math.floor(absMs / YEAR_MS);
    unit = "year";
  }
  const plural = amount === 1 ? "" : "s";
  return past
    ? `${amount} ${unit}${plural} ago`
    : `in ${amount} ${unit}${plural}`;
}

/** Formats a duration in milliseconds as `1h 2m 3s` style. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / SECOND_MS);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** Formats a future or past date as an "expires in …" / "expired" string. */
export function formatExpiry(
  value: DateInput,
  now: Date | number = Date.now(),
): string {
  const date = toDate(value);
  const nowDate = toNow(now);
  const diffMs = date.getTime() - nowDate.getTime();
  if (diffMs <= 0) return "expired";
  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `expires in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.floor(diffMs / DAY_MS);
  return `expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** Formats a date as `YYYY-MM-DD` (UTC). */
export function formatDate(value: DateInput): string {
  return toDate(value).toISOString().slice(0, 10);
}

/** Formats a date as a full ISO 8601 string (UTC). */
export function formatDateTime(value: DateInput): string {
  return toDate(value).toISOString();
}

/** Returns true when `value` is in the past (or exactly now). */
export function isExpired(
  value: DateInput,
  now: Date | number = Date.now(),
): boolean {
  const date = toDate(value);
  const nowDate = toNow(now);
  return date.getTime() <= nowDate.getTime();
}

/** Returns true when `value` is in the future but within `thresholdMs`. */
export function isExpiringSoon(
  value: DateInput,
  thresholdMs: number = DAY_MS,
  now: Date | number = Date.now(),
): boolean {
  const date = toDate(value);
  const nowDate = toNow(now);
  const diff = date.getTime() - nowDate.getTime();
  return diff > 0 && diff <= thresholdMs;
}

/** Returns a new Date set to local midnight at the start of the given day. */
export function getStartOfDay(value: DateInput): Date {
  const date = toDate(value);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

/** Returns a new Date set to local end-of-day (23:59:59.999) for the input. */
export function getEndOfDay(value: DateInput): Date {
  const date = toDate(value);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/** Returns the number of whole calendar days between two dates. */
export function getDaysBetween(start: DateInput, end: DateInput): number {
  const startDate = getStartOfDay(start);
  const endDate = getStartOfDay(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.round(diff / DAY_MS);
}

/** Parses an ISO date string, throwing on invalid input. */
export function parseIsoDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return date;
}

/** Returns the ISO 8601 UTC string for a date input. */
export function toIsoString(value: DateInput): string {
  return toDate(value).toISOString();
}

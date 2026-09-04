/**
 * Pure retention-policy utilities.
 *
 * A retention policy decides when an inactive record (contact, lead,
 * evidence blob, ...) should be deleted. The policy is described by a
 * duration plus a basis ("last_activity" or "created") and an optional
 * soft-delete grace period. All time values are epoch milliseconds.
 *
 * No I/O, no side effects, deterministic.
 */

export type RetentionBasis = "last_activity" | "created";

export type RetentionUnit = "day" | "week" | "month" | "year";

export interface RetentionPolicy {
  /** Length of the retention period, in `unit`s. */
  period: number;
  /** Unit for `period`. Defaults to `"month"`. */
  unit?: RetentionUnit;
  /**
   * Basis field that the policy is measured from. Defaults to
   * `"last_activity"`.
   */
  basis?: RetentionBasis;
  /**
   * Optional soft-delete grace period (same `unit`) applied after the
   * retention period elapses before the record is hard-deleted. Defaults to 0.
   */
  grace?: number;
}

const MS_PER_UNIT: Record<RetentionUnit, number> = {
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000, // 30 days
  year: 31_536_000_000, // 365 days
};

function periodMs(policy: RetentionPolicy, field: "period" | "grace"): number {
  const unit = policy.unit ?? "month";
  const factor = MS_PER_UNIT[unit] ?? MS_PER_UNIT.month;
  const n = typeof policy[field] === "number" ? (policy[field] as number) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n * factor;
}

function retentionMs(policy: RetentionPolicy): number {
  return periodMs(policy, "period");
}

function graceMs(policy: RetentionPolicy): number {
  return periodMs(policy, "grace");
}

/**
 * Return the epoch-ms timestamp at which a record should be deleted, given
 * its anchor (last-activity or creation) timestamp and the policy. The
 * deletion date is `anchor + retention + grace`.
 */
export function getDeletionDate(
  anchorMs: number,
  policy: RetentionPolicy,
): number {
  if (!Number.isFinite(anchorMs)) return Number.NaN;
  return anchorMs + retentionMs(policy) + graceMs(policy);
}

/**
 * Return `true` when a record has passed its hard-deletion date as of `nowMs`.
 * Records whose anchor is not finite are considered expired.
 */
export function isExpired(
  anchorMs: number,
  policy: RetentionPolicy,
  nowMs: number,
): boolean {
  if (!Number.isFinite(nowMs)) return false;
  if (!Number.isFinite(anchorMs)) return true;
  const deletion = getDeletionDate(anchorMs, policy);
  if (!Number.isFinite(deletion)) return true;
  return nowMs >= deletion;
}

/**
 * Decide whether a record should be deleted as of `nowMs`. Equivalent to
 * `isExpired` but also takes the policy's basis into account by accepting
 * both `createdAt` and `lastActivityAt`. When the basis is `last_activity`
 * but no last-activity timestamp is available, the policy falls back to the
 * creation timestamp.
 */
export function shouldDelete(
  record: {
    createdAt?: number;
    lastActivityAt?: number;
  },
  policy: RetentionPolicy,
  nowMs: number,
): boolean {
  if (!Number.isFinite(nowMs)) return false;
  const basis = policy.basis ?? "last_activity";
  let anchor: number;
  if (basis === "last_activity") {
    anchor =
      Number.isFinite(record?.lastActivityAt) && record.lastActivityAt !== undefined
        ? (record.lastActivityAt as number)
        : (record?.createdAt ?? NaN);
  } else {
    anchor = record?.createdAt ?? NaN;
  }
  return isExpired(anchor, policy, nowMs);
}

/**
 * Return the human-readable label for the retention basis.
 */
export function getRetentionBasisLabel(basis: RetentionBasis): string {
  switch (basis) {
    case "last_activity":
      return "Last Activity";
    case "created":
      return "Created";
    default:
      return "Unknown";
  }
}

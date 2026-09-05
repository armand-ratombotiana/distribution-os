import { AUDIT_CATEGORIES, type AuditCategory } from "./schema";
export type { AuditCategory } from "./schema";

/**
 * Pure helpers for the `audit_events` table.
 *
 * These functions intentionally avoid touching the live D1 binding so they can
 * be unit-tested in isolation and reused by API routes, background workers and
 * export pipelines. Anything that needs to read/write the database should layer
 * on top of these primitives.
 */

export type AuditEventRow = {
  id?: number;
  workspace_id: string;
  actor_user_id: string | null;
  event_category: AuditCategory;
  event_type: string;
  action_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  detail_json: string;
  ip_hash: string | null;
  created_at: number;
};

export type BuildAuditEntryInput = {
  workspaceId: string;
  actorUserId?: string | null;
  eventCategory: AuditCategory;
  eventType: string;
  actionId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  detail?: Record<string, unknown> | null;
  ipHash?: string | null;
  createdAt?: number;
};

/**
 * Normalize an arbitrary input object into a row that is safe to INSERT into
 * `audit_events`. Defaults mirror the column defaults defined in `schema.ts`.
 */
export function buildAuditEntry(input: BuildAuditEntryInput): AuditEventRow {
  const category = validateCategory(input.eventCategory);
  return {
    workspace_id: input.workspaceId,
    actor_user_id: input.actorUserId ?? null,
    event_category: category,
    event_type: input.eventType,
    action_id: input.actionId ?? null,
    resource_type: input.resourceType ?? null,
    resource_id: input.resourceId ?? null,
    detail_json: input.detail ? JSON.stringify(input.detail) : "{}",
    ip_hash: input.ipHash ?? null,
    created_at: input.createdAt ?? Date.now(),
  };
}

/**
 * Hash an IP address with SHA-256 so the audit log can attribute actions to a
 * client without storing the raw address. Runs on the Web Crypto `SubtleCrypto`
 * interface so it works in both Cloudflare Workers and Node.
 */
export async function hashIp(ip: string): Promise<string> {
  const encoded = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Strip the `ip_hash` from a row before returning it to the UI. The
 * `actor_user_id` is preserved so operators can still correlate actions to
 * users — only the network identifier is redacted.
 */
export function summarizeForDisplay(
  row: AuditEventRow,
): Omit<AuditEventRow, "ip_hash"> {
  const rest = { ...row };
  Reflect.deleteProperty(rest, "ip_hash");
  return rest;
}

/**
 * Parse `detail_json` defensively. Invalid JSON collapses to an empty object
 * so downstream consumers never throw on corrupt audit rows.
 */
export function parseDetail(detailJson: string | null | undefined): Record<string, unknown> {
  if (!detailJson) return {};
  try {
    const parsed = JSON.parse(detailJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Filter an in-memory list of audit rows by category. Returns a new array and
 * does not mutate the input.
 */
export function filterByCategory(
  rows: readonly AuditEventRow[],
  category: AuditCategory,
): AuditEventRow[] {
  return rows.filter((row) => row.event_category === category);
}

/**
 * Filter rows to those whose `created_at` falls inside `[startMs, endMs]`
 * inclusive. Bounds are interpreted as epoch milliseconds to match the schema.
 */
export function filterByTimeRange(
  rows: readonly AuditEventRow[],
  startMs: number,
  endMs: number,
): AuditEventRow[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return [];
  }
  return rows.filter((row) => row.created_at >= startMs && row.created_at <= endMs);
}

/**
 * Validate that a category string is part of the `AUDIT_CATEGORIES` enum.
 * Throws on invalid input so callers cannot accidentally persist a typo.
 */
export function validateCategory(category: string): AuditCategory {
  if (!AUDIT_CATEGORIES.includes(category as AuditCategory)) {
    throw new Error(
      `Invalid audit category: ${category}. Expected one of: ${AUDIT_CATEGORIES.join(", ")}`,
    );
  }
  return category as AuditCategory;
}

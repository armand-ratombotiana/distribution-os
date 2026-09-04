/**
 * D1 persistence layer for the `audit_events` table.
 *
 * Tenant-isolated by `workspace_id`. Delegates entry building, IP hashing and
 * display logic to `./audit-pure`. The `id` column is auto-incremented by D1,
 * so inserts do not provide a value. Timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildAuditEntry,
  type AuditEventRow,
  type AuditCategory,
} from "./audit-pure";

export * from "./audit-pure";

export type LogAuditEventInput = {
  actor_user_id?: string | null;
  event_category: AuditCategory;
  event_type: string;
  action_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  detail?: Record<string, unknown> | null;
  ip_hash?: string | null;
  created_at?: number;
};

export type ListAuditEventsOptions = {
  event_category?: AuditCategory;
  action_id?: string;
  resource_type?: string;
  limit?: number;
};

/**
 * Persist an audit event. The input is normalised through `buildAuditEntry`
 * (which validates the category and fills defaults) before being inserted.
 * Returns the newly inserted row, including the auto-generated `id`.
 */
export async function logAuditEvent(
  workspaceId: string,
  input: LogAuditEventInput,
): Promise<AuditEventRow> {
  const db = getRawDb();
  const row = buildAuditEntry({
    workspaceId,
    actorUserId: input.actor_user_id ?? null,
    eventCategory: input.event_category,
    eventType: input.event_type,
    actionId: input.action_id ?? null,
    resourceType: input.resource_type ?? null,
    resourceId: input.resource_id ?? null,
    detail: input.detail ?? null,
    ipHash: input.ip_hash ?? null,
    createdAt: input.created_at ?? Date.now(),
  });

  const result = await db
    .prepare(
      "INSERT INTO audit_events (workspace_id, actor_user_id, event_category, event_type, action_id, resource_type, resource_id, detail_json, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
    )
    .bind(
      row.workspace_id,
      row.actor_user_id,
      row.event_category,
      row.event_type,
      row.action_id,
      row.resource_type,
      row.resource_id,
      row.detail_json,
      row.ip_hash,
      row.created_at,
    )
    .all<AuditEventRow>();

  const inserted = result.results[0];
  if (!inserted) {
    throw new Error("Failed to log audit event");
  }
  return inserted;
}

/**
 * List audit events for a workspace, optionally filtered by category, action,
 * or resource type. Ordered by `created_at DESC, id DESC`, capped at `limit`
 * (default 50, max 200).
 */
export async function listAuditEvents(
  workspaceId: string,
  opts: ListAuditEventsOptions = {},
): Promise<AuditEventRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.event_category && opts.action_id) {
    const result = await db
      .prepare(
        "SELECT * FROM audit_events WHERE workspace_id = ? AND event_category = ? AND action_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .bind(workspaceId, opts.event_category, opts.action_id, limit)
      .all<AuditEventRow>();
    return result.results;
  }
  if (opts.event_category && opts.resource_type) {
    const result = await db
      .prepare(
        "SELECT * FROM audit_events WHERE workspace_id = ? AND event_category = ? AND resource_type = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .bind(workspaceId, opts.event_category, opts.resource_type, limit)
      .all<AuditEventRow>();
    return result.results;
  }
  if (opts.event_category) {
    const result = await db
      .prepare(
        "SELECT * FROM audit_events WHERE workspace_id = ? AND event_category = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .bind(workspaceId, opts.event_category, limit)
      .all<AuditEventRow>();
    return result.results;
  }
  if (opts.action_id) {
    const result = await db
      .prepare(
        "SELECT * FROM audit_events WHERE workspace_id = ? AND action_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .bind(workspaceId, opts.action_id, limit)
      .all<AuditEventRow>();
    return result.results;
  }
  if (opts.resource_type) {
    const result = await db
      .prepare(
        "SELECT * FROM audit_events WHERE workspace_id = ? AND resource_type = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .bind(workspaceId, opts.resource_type, limit)
      .all<AuditEventRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<AuditEventRow>();
  return result.results;
}

/** Fetch a single audit event by id within a workspace. */
export async function getAuditEvent(
  workspaceId: string,
  eventId: number,
): Promise<AuditEventRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM audit_events WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, eventId)
    .first<AuditEventRow>();
}

export type AuditStats = {
  workspace_id: string;
  total_events: number;
  by_category: Record<string, number>;
  generated_at: number;
};

/**
 * Aggregate audit-event counts by category for a workspace.
 *
 * Returns one row per `event_category` plus a `total_events` sum. Categories
 * that have no events are omitted from `by_category` (callers that need a
 * fully-populated shape should merge against `AUDIT_CATEGORIES`). The single
 * `GROUP BY` query is indexed on `(workspace_id, event_category)`.
 */
export async function getAuditStats(
  workspaceId: string,
): Promise<AuditStats> {
  const db = getRawDb();
  const totalResult = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ?",
    )
    .bind(workspaceId)
    .first<{ count: number }>();
  const grouped = await db
    .prepare(
      "SELECT event_category, COUNT(*) AS count FROM audit_events WHERE workspace_id = ? GROUP BY event_category",
    )
    .bind(workspaceId)
    .all<{ event_category: string; count: number }>();

  const byCategory: Record<string, number> = {};
  for (const row of grouped.results) {
    byCategory[row.event_category] = row.count;
  }

  return {
    workspace_id: workspaceId,
    total_events: totalResult?.count ?? 0,
    by_category: byCategory,
    generated_at: Date.now(),
  };
}

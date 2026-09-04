import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import { listAuditEvents, summarizeForDisplay } from "../../../../db/audit";
import { getRawDb } from "../../../../db/index";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type MissionEventRow = {
  id: number;
  mission_id: string;
  event_type: string;
  title: string;
  detail: string;
  actor: string;
  created_at: number;
};

type ActivityItem = {
  kind: "audit_event" | "mission_event";
  id: string;
  occurred_at: number;
  payload: Record<string, unknown>;
};

type ActivityResponse = {
  items: ActivityItem[];
  count: number;
  has_more: boolean;
  next_cursor: number | null;
};

/**
 * Workspace activity feed — a unified, paginated timeline that interleaves
 * audit events (`audit_events` table) with mission events (`mission_events`
 * table, joined through the workspace's missions).
 *
 * Query params (all optional):
 *   - limit  — clamp to [1, 200]; defaults to 50.
 *   - before — exclusive upper bound on `occurred_at` (epoch ms). Used as
 *              the pagination cursor: pass `next_cursor` from the previous
 *              response to fetch the next page.
 *
 * The two underlying tables are queried in parallel with a small overshoot
 * (`limit + 1`) so we can detect `has_more` without an extra `COUNT(*)`.
 * `has_more` is true when the merged stream contains more than `limit`
 * items older than the cursor.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const rawBefore = Number.parseInt(url.searchParams.get("before") ?? "", 10);
    const before =
      Number.isFinite(rawBefore) && rawBefore > 0 ? rawBefore : null;

    const overshoot = limit + 1;

    const [auditRows, missionRows] = await Promise.all([
      listAuditEvents(workspace.id, { limit: overshoot }),
      fetchMissionEvents(workspace.id, overshoot),
    ]);

    const items: ActivityItem[] = [];
    for (const row of auditRows) {
      if (before !== null && row.created_at >= before) continue;
      items.push({
        kind: "audit_event",
        id: `audit:${row.id ?? 0}`,
        occurred_at: row.created_at,
        payload: summarizeForDisplay(row),
      });
    }
    for (const row of missionRows) {
      if (before !== null && row.created_at >= before) continue;
      items.push({
        kind: "mission_event",
        id: `mission:${row.id}`,
        occurred_at: row.created_at,
        payload: {
          id: row.id,
          mission_id: row.mission_id,
          event_type: row.event_type,
          title: row.title,
          detail: row.detail,
          actor: row.actor,
          created_at: row.created_at,
        },
      });
    }

    items.sort((a, b) => b.occurred_at - a.occurred_at);

    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    const nextCursor = hasMore && page.length > 0
      ? page[page.length - 1].occurred_at
      : null;

    const response: ActivityResponse = {
      items: page,
      count: page.length,
      has_more: hasMore,
      next_cursor: nextCursor,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view workspace activity." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workspace activity unavailable.",
      },
      { status: 500 },
    );
  }
}

/**
 * Fetch mission events scoped to the workspace's missions. Uses an
 * `IN (SELECT id FROM missions WHERE workspace_id = ?)` subquery so we do
 * not need a second round-trip to resolve the workspace's mission ids.
 *
 * Cursor filtering by `before` is applied in-memory by the caller rather
 * than in SQL — this keeps the subquery simple at the cost of a small
 * overshoot when the cursor is set. The overshoot is bounded by `limit + 1`
 * so the cost is constant.
 */
async function fetchMissionEvents(
  workspaceId: string,
  limit: number,
): Promise<MissionEventRow[]> {
  const db = getRawDb();
  const result = await db
    .prepare(
      "SELECT id, mission_id, event_type, title, detail, actor, created_at FROM mission_events WHERE mission_id IN (SELECT id FROM missions WHERE workspace_id = ?) ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<MissionEventRow>();
  return result.results;
}

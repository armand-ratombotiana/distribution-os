import { getRawDb } from "../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../db/workspaces";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRING_HORIZON_MS = MS_PER_DAY; // 24 hours
const MAX_EXPIRING_HORIZON_MS = 30 * MS_PER_DAY; // 30 days
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type ActionNotification = {
  id: string;
  mission_id: string;
  title: string;
  action_type: string;
  channel: string;
  status: string;
  risk: string;
  expires_at: number;
  created_at: number;
};

type NotificationsResponse = {
  pending_approvals: ActionNotification[];
  blocked_actions: ActionNotification[];
  expiring_actions: ActionNotification[];
  counts: {
    pending_approvals: number;
    blocked_actions: number;
    expiring_actions: number;
    total: number;
  };
  expiring_horizon_ms: number;
  generated_at: number;
};

/**
 * Workspace notifications.
 *
 * Surfaces three categories of operator-actionable items in a single
 * response so the UI can render a unified notification center:
 *
 * 1. `pending_approvals` — actions in `status = 'prepared'` (the approval-
 *    gated state). These are waiting for a human to either approve or
 *    reject them through the `/api/actions/[id]/approve` or
 *    `/api/actions/[id]/reject` routes.
 *
 * 2. `blocked_actions` — actions in `status = 'blocked'`. The blocker
 *    reason is stored in the `blocker` column; the UI should surface it.
 *
 * 3. `expiring_actions` — actions in `status IN ('prepared', 'approved')`
 *    whose `expires_at` falls within the configured horizon. Defaults to
 *    24 hours; configurable via `?horizon_hours=` (capped at 30 days).
 *
 * Each list is capped at `limit` (default 50, max 200) and ordered so the
 * most urgent items come first (oldest pending approvals, soonest-to-expire
 * actions). Read-only — no rows are mutated.
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
    const rawHorizonHours = Number.parseInt(
      url.searchParams.get("horizon_hours") ?? "",
      10,
    );
    const horizonMs =
      Number.isFinite(rawHorizonHours) && rawHorizonHours > 0
        ? Math.min(
            rawHorizonHours * 60 * 60 * 1000,
            MAX_EXPIRING_HORIZON_MS,
          )
        : DEFAULT_EXPIRING_HORIZON_MS;

    const now = Date.now();
    const horizonEnd = now + horizonMs;

    const db = getRawDb();
    const workspaceId = workspace.id;

    const [pendingResult, blockedResult, expiringResult] = await Promise.all([
      db
        .prepare(
          "SELECT id, mission_id, title, action_type, channel, status, risk, expires_at, created_at FROM action_queue WHERE workspace_id = ? AND status = 'prepared' ORDER BY created_at ASC LIMIT ?",
        )
        .bind(workspaceId, limit)
        .all<ActionNotification>(),
      db
        .prepare(
          "SELECT id, mission_id, title, action_type, channel, status, risk, expires_at, created_at FROM action_queue WHERE workspace_id = ? AND status = 'blocked' ORDER BY created_at ASC LIMIT ?",
        )
        .bind(workspaceId, limit)
        .all<ActionNotification>(),
      db
        .prepare(
          "SELECT id, mission_id, title, action_type, channel, status, risk, expires_at, created_at FROM action_queue WHERE workspace_id = ? AND status IN ('prepared', 'approved') AND expires_at > ? AND expires_at <= ? ORDER BY expires_at ASC LIMIT ?",
        )
        .bind(workspaceId, now, horizonEnd, limit)
        .all<ActionNotification>(),
    ]);

    const pendingApprovals = pendingResult.results;
    const blockedActions = blockedResult.results;
    const expiringActions = expiringResult.results;
    const total =
      pendingApprovals.length + blockedActions.length + expiringActions.length;

    const response: NotificationsResponse = {
      pending_approvals: pendingApprovals,
      blocked_actions: blockedActions,
      expiring_actions: expiringActions,
      counts: {
        pending_approvals: pendingApprovals.length,
        blocked_actions: blockedActions.length,
        expiring_actions: expiringActions.length,
        total,
      },
      expiring_horizon_ms: horizonMs,
      generated_at: now,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view notifications." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Notifications unavailable.",
      },
      { status: 500 },
    );
  }
}

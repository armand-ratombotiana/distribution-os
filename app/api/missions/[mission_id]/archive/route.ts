import { getRawDb } from "../../../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

type ArchiveResponse = {
  mission_id: string;
  status: string;
  archived_at: number;
  previous_status: string;
};

/**
 * Archive a mission.
 *
 * Sets the mission row's `status` column to `"archived"`. The `status`
 * column is a free-text field on the `missions` table (no enum constraint),
 * so `archived` is a soft-state marker — the row remains queryable for
 * history and audit but should be excluded from "active missions" lists by
 * the UI. The mission's child rows (actions, evidence, experiments, payments,
 * touchpoints, mission_events) are NOT cascade-deleted; they remain attached
 * to the archived mission for posterity.
 *
 * Archiving is idempotent: archiving an already-archived mission is a no-op
 * that returns 200 with the current state. An audit_events row with category
 * `action` and type `mission.archived` is logged after a successful state
 * change so operators can track archive/restore cycles.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const previousStatus = mission.state.status;
    const archivedAt = Date.now();

    if (previousStatus === "archived") {
      const response: ArchiveResponse = {
        mission_id,
        status: "archived",
        archived_at: mission.state.updated_at,
        previous_status: previousStatus,
      };
      return Response.json(response);
    }

    const db = getRawDb();
    await db
      .prepare(
        "UPDATE missions SET status = 'archived', updated_at = ? WHERE id = ? AND workspace_id = ?",
      )
      .bind(archivedAt, mission_id, workspace.id)
      .run();

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "mission.archived",
        resource_type: "mission",
        resource_id: mission_id,
        detail: {
          mission_id,
          previous_status: previousStatus,
          archived_at: archivedAt,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    const response: ArchiveResponse = {
      mission_id,
      status: "archived",
      archived_at: archivedAt,
      previous_status: previousStatus,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to archive a mission." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mission could not be archived.",
      },
      { status: 500 },
    );
  }
}

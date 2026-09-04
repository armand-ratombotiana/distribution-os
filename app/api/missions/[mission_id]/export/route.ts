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

/**
 * Export a single mission as a JSON download.
 *
 * Returns a `Content-Disposition: attachment` response whose body is a JSON
 * object containing the mission row, its events, actions, evidence,
 * experiments, payments and touchpoints — all scoped to the current
 * workspace. The export is intended for handoff, archival and offline
 * analysis. It is read-only — no rows are mutated.
 *
 * An `audit_events` row with category `export` is logged after a successful
 * download so operators can track data movement.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const db = getRawDb();
    const workspaceId = workspace.id;
    const exportedAt = Date.now();

    const [
      missionRowResult,
      eventsResult,
      actionsResult,
      evidenceResult,
      experimentsResult,
      paymentsResult,
      touchpointsResult,
    ] = await Promise.all([
      db
        .prepare(
          "SELECT id, workspace_id, website_url, product_name, mode, status, current_stage, cycle_number, payment_count, approved, mission_json, created_at, updated_at FROM missions WHERE id = ? AND workspace_id = ? LIMIT 1",
        )
        .bind(mission_id, workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id, event_type, title, detail, actor, created_at FROM mission_events WHERE mission_id = ? ORDER BY created_at ASC, id ASC",
        )
        .bind(mission_id)
        .all(),
      db
        .prepare(
          "SELECT * FROM action_queue WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at ASC",
        )
        .bind(workspaceId, mission_id)
        .all(),
      db
        .prepare(
          "SELECT * FROM evidence WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at ASC",
        )
        .bind(workspaceId, mission_id)
        .all(),
      db
        .prepare(
          "SELECT * FROM experiments WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at ASC",
        )
        .bind(workspaceId, mission_id)
        .all(),
      db
        .prepare(
          "SELECT * FROM payments WHERE workspace_id = ? AND mission_id = ? ORDER BY received_at ASC",
        )
        .bind(workspaceId, mission_id)
        .all(),
      db
        .prepare(
          "SELECT * FROM touchpoints WHERE workspace_id = ? AND mission_id = ? ORDER BY occurred_at ASC",
        )
        .bind(workspaceId, mission_id)
        .all(),
    ]);

    const payload = {
      workspace_id: workspaceId,
      mission_id,
      exported_at: exportedAt,
      schema_version: 1,
      mission: missionRowResult.results[0] ?? null,
      events: eventsResult.results,
      actions: actionsResult.results,
      evidence: evidenceResult.results,
      experiments: experimentsResult.results,
      payments: paymentsResult.results,
      touchpoints: touchpointsResult.results,
    };

    const body = JSON.stringify(payload, null, 2);
    const filename = `mission-${mission_id}-${new Date(exportedAt)
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    try {
      await logAuditEvent(workspaceId, {
        actor_user_id: workspace.owner_user_id,
        event_category: "export",
        event_type: "mission.exported",
        resource_type: "mission",
        resource_id: mission_id,
        detail: {
          mission_id,
          events: eventsResult.results.length,
          actions: actionsResult.results.length,
          evidence: evidenceResult.results.length,
          experiments: experimentsResult.results.length,
          payments: paymentsResult.results.length,
          touchpoints: touchpointsResult.results.length,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to export mission data." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Mission export failed.",
      },
      { status: 500 },
    );
  }
}

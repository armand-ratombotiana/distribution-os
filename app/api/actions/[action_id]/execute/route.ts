import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getRawDb } from "../../../../../db/index";
import { type ActionRow } from "../../../../../db/actions-pure";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ action_id: string }>;
};

/**
 * Guard the execution boundary for an approved action. Until a real provider
 * adapter can return a verifiable receipt, this endpoint fails closed and
 * leaves the action approved.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { action_id } = await context.params;

    const db = getRawDb();
    const action = await db
      .prepare("SELECT * FROM action_queue WHERE id = ? AND workspace_id = ? LIMIT 1")
      .bind(action_id, workspace.id)
      .first<ActionRow>();
    if (!action) {
      return Response.json({ error: "Action not found." }, { status: 404 });
    }

    if (action.status !== "approved") {
      return Response.json(
        { error: `Action cannot be executed from status '${action.status}'.` },
        { status: 400 }
      );
    }

    if (action.expires_at <= Date.now()) {
      await db
        .prepare("UPDATE action_queue SET status = 'expired', updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'approved'")
        .bind(Date.now(), action_id, workspace.id)
        .run();
      return Response.json(
        { error: "Action approval expired before execution." },
        { status: 409 }
      );
    }

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "action.execution_blocked",
        action_id,
        resource_type: "action",
        resource_id: action_id,
        detail: {
          mission_id: action.mission_id,
          previous_status: action.status,
          next_status: action.status,
          blocker: action.blocker,
          reason: "No real provider execution adapter is installed.",
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(
      {
        error: action.blocker || "No real provider execution adapter is installed for this channel.",
        action,
        executed: false,
      },
      { status: 501 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to execute actions." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Action could not be executed." },
      { status: 500 }
    );
  }
}

import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import {
  approveAction,
  getAction,
  summarizeForDisplay,
} from "../../../../../db/actions";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ action_id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { action_id } = await context.params;

    const action = await getAction(workspace.id, action_id);
    if (!action) {
      return Response.json({ error: "Action not found." }, { status: 404 });
    }

    let updated;
    try {
      updated = await approveAction(workspace.id, action_id, workspace.owner_user_id);
    } catch {
      return Response.json(
        { error: "Action cannot be approved from its current state." },
        { status: 400 }
      );
    }

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "approval",
        event_type: "action.approved",
        action_id: updated.id,
        resource_type: "action",
        resource_id: updated.id,
        detail: {
          mission_id: updated.mission_id,
          previous_status: action.status,
          next_status: updated.status,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ action: summarizeForDisplay(updated) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to approve actions." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Action could not be approved." },
      { status: 500 }
    );
  }
}

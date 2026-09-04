import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getRawDb } from "../../../../../db/index";
import { canTransition, type ActionRow } from "../../../../../db/actions-pure";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ action_id: string }>;
};

/**
 * Execute an approved action. The provider call is simulated — this route is
 * the integration seam where a real provider adapter (Stripe, Resend, LinkedIn,
 * etc.) would be invoked. The simulation generates a deterministic-looking
 * provider result so the rest of the loop (attribution, evidence) can run
 * end-to-end in development.
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

    if (!canTransition(action.status, "executed")) {
      return Response.json(
        { error: "Action state machine refuses execution from this status." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const simulatedResult = {
      ok: true,
      provider: action.channel,
      external_id: `sim_${crypto.randomUUID()}`,
      submitted_at: now,
      note: "Simulated execution result. Connect a provider adapter to capture real outcomes.",
    };

    await db
      .prepare(
        "UPDATE action_queue SET status = 'executed', provider_result_json = ?, decided_at = COALESCE(decided_at, ?), updated_at = ? WHERE id = ? AND workspace_id = ?"
      )
      .bind(JSON.stringify(simulatedResult), now, now, action_id, workspace.id)
      .run();

    const updated = await db
      .prepare("SELECT * FROM action_queue WHERE id = ? AND workspace_id = ? LIMIT 1")
      .bind(action_id, workspace.id)
      .first<ActionRow>();

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "action.executed",
        action_id,
        resource_type: "action",
        resource_id: action_id,
        detail: {
          mission_id: action.mission_id,
          previous_status: action.status,
          next_status: "executed",
          simulated: true,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ action: updated, result: simulatedResult }, { status: 201 });
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

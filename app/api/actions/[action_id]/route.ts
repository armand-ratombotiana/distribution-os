import {
  getLatestExecutionAttempt,
  summarizeExecutionAttempt,
} from "../../../../db/action-execution-attempts";
import { getAction, summarizeForDisplay } from "../../../../db/actions";
import { ensureWorkspace, requireRequestIdentity } from "../../../../db/workspaces";

type RouteContext = { params: Promise<{ action_id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { action_id } = await context.params;
    const action = await getAction(workspace.id, action_id);
    if (!action) return Response.json({ error: "Action not found." }, { status: 404 });
    let payload: unknown = null;
    try { payload = JSON.parse(action.payload_json); } catch { payload = null; }
    const attempt = await getLatestExecutionAttempt(workspace.id, action.id);
    return Response.json({
      action: {
        ...summarizeForDisplay(action),
        payload,
        decided_by: action.decided_by,
        decided_at: action.decided_at,
      },
      attempt: summarizeExecutionAttempt(attempt),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to inspect actions." }, { status: 401 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "Action could not be loaded." }, { status: 500 });
  }
}

import { ensureWorkspace, requireRequestIdentity } from "../../../../../../db/workspaces";
import { getMission } from "../../../../../../db/missions";
import {
  getAction,
  summarizeForDisplay,
} from "../../../../../../db/actions";

type RouteContext = {
  params: Promise<{ mission_id: string; action_id: string }>;
};

/**
 * Single-action lookup for a mission.
 *
 * Returns the action (redacted through `summarizeForDisplay`) when the
 * action belongs to the requested mission and the mission belongs to the
 * caller's workspace. Returns 404 when either the mission or the action is
 * missing, or when the action exists but is associated with a different
 * mission — the path parameter pair is treated as a composite key so leaking
 * an action id across missions does not expose cross-mission data.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id, action_id } = await context.params;

    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const action = await getAction(workspace.id, action_id);
    if (!action || action.mission_id !== mission_id) {
      return Response.json({ error: "Action not found." }, { status: 404 });
    }

    return Response.json({ action: summarizeForDisplay(action) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view mission actions." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Action could not be loaded.",
      },
      { status: 500 },
    );
  }
}

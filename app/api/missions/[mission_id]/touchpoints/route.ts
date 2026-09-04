import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  listTouchpoints,
  summarizeTouchpointForDisplay,
} from "../../../../../db/payments";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const touchpoints = await listTouchpoints(workspace.id, { mission_id });
    return Response.json({ touchpoints: touchpoints.map(summarizeTouchpointForDisplay) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to view touchpoints." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Touchpoints could not be loaded." },
      { status: 500 }
    );
  }
}

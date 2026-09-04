import { ensureWorkspace, requireRequestIdentity } from "../../../../../../db/workspaces";
import { getMission } from "../../../../../../db/missions";
import {
  getEvidence,
  summarizeForDisplay,
} from "../../../../../../db/evidence";

type RouteContext = {
  params: Promise<{ mission_id: string; evidence_id: string }>;
};

/**
 * Single-evidence lookup for a mission.
 *
 * Returns the evidence row (redacted through `summarizeForDisplay`) when the
 * evidence belongs to the requested mission and the mission belongs to the
 * caller's workspace. Returns 404 when either the mission or the evidence is
 * missing, or when the evidence exists but is associated with a different
 * mission — the path parameter pair is treated as a composite key so leaking
 * an evidence id across missions does not expose cross-mission data.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id, evidence_id } = await context.params;

    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const evidence = await getEvidence(workspace.id, evidence_id);
    if (!evidence || evidence.mission_id !== mission_id) {
      return Response.json({ error: "Evidence not found." }, { status: 404 });
    }

    return Response.json({ evidence: summarizeForDisplay(evidence) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view evidence." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Evidence could not be loaded.",
      },
      { status: 500 },
    );
  }
}

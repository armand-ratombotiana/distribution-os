import { ensureWorkspace, requireRequestIdentity } from "../../../../../../db/workspaces";
import { getMission } from "../../../../../../db/missions";
import {
  getExperiment,
  summarizeForDisplay,
} from "../../../../../../db/experiments";

type RouteContext = {
  params: Promise<{ mission_id: string; experiment_id: string }>;
};

/**
 * Single-experiment lookup for a mission.
 *
 * Returns the experiment (redacted through `summarizeForDisplay`) when the
 * experiment belongs to the requested mission and the mission belongs to the
 * caller's workspace. Returns 404 when either the mission or the experiment
 * is missing, or when the experiment exists but is associated with a
 * different mission — the path parameter pair is treated as a composite key
 * so leaking an experiment id across missions does not expose cross-mission
 * data.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id, experiment_id } = await context.params;

    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const experiment = await getExperiment(workspace.id, experiment_id);
    if (!experiment || experiment.mission_id !== mission_id) {
      return Response.json(
        { error: "Experiment not found." },
        { status: 404 },
      );
    }

    return Response.json({ experiment: summarizeForDisplay(experiment) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view experiments." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Experiment could not be loaded.",
      },
      { status: 500 },
    );
  }
}

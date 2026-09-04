import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { getMission, getMissionSummary } from "../../../../../db/missions";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

/**
 * Mission summary — aggregated stats for the mission overview card.
 *
 * Returns the mission stage, cycle, approval state and counts of actions,
 * evidence, experiments and payments, plus a `readiness_score` derived from
 * the mission lifecycle helper (factors in pending approvals and open
 * experiments). The summary is read-only — no rows are mutated.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const summary = await getMissionSummary(mission_id, workspace.id);
    if (!summary) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    return Response.json({ summary });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view the mission summary." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mission summary unavailable.",
      },
      { status: 500 },
    );
  }
}

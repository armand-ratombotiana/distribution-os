import {
  listMissionVersions,
  listStrategyVersions,
  summarizeStrategyVersionForDisplay,
  summarizeVersionForDisplay,
} from "../../../../../db/versions";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

/**
 * List version history for a mission.
 *
 * Returns both mission versions (full mission snapshots) and strategy
 * versions (lighter-weight strategy deltas with confidence scores), newest
 * first. Each row is projected through the pure `summarize*ForDisplay`
 * helpers so the heavy `mission_json` / `strategy_json` payloads are reduced
 * to field counts and metadata.
 *
 * Query params:
 *   - kind  — `mission` (default) or `strategy`. When `strategy`, only
 *             strategy versions are returned.
 *   - limit — clamp to [1, 200]; defaults to 50.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") ?? "mission";
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    if (kind === "strategy") {
      const strategyVersions = await listStrategyVersions(
        workspace.id,
        mission_id,
        { limit },
      );
      return Response.json({
        kind: "strategy",
        versions: strategyVersions.map(summarizeStrategyVersionForDisplay),
      });
    }

    const missionVersions = await listMissionVersions(workspace.id, mission_id, {
      limit,
    });
    return Response.json({
      kind: "mission",
      versions: missionVersions.map(summarizeVersionForDisplay),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view mission versions." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Mission versions unavailable.",
      },
      { status: 500 },
    );
  }
}

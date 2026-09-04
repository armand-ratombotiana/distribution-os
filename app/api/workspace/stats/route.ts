import {
  ensureWorkspace,
  getWorkspaceStats,
  requireRequestIdentity,
} from "../../../../db/workspaces";

/**
 * Workspace statistics — row counts for the seven primary content tables.
 *
 * Returns the count of missions, actions, evidence, experiments, payments,
 * contacts and content assets belonging to the current workspace. Each count
 * is a single indexed `COUNT(*)` query, all seven run in parallel so the
 * endpoint stays cheap even on large workspaces. Read-only — no rows are
 * mutated.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const stats = await getWorkspaceStats(workspace.id);
    return Response.json({ stats });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view workspace statistics." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workspace statistics unavailable.",
      },
      { status: 500 },
    );
  }
}

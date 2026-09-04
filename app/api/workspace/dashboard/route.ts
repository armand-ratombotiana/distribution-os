import {
  ensureWorkspace,
  getWorkspaceDashboard,
  requireRequestIdentity,
} from "../../../../db/workspaces";

/**
 * Workspace dashboard — workspace-wide counts and a recent-activity timeline.
 *
 * Returns the mission count, total actions, total evidence, total experiments,
 * total payments, total touchpoints, total contacts, total content assets,
 * counts of succeeded payments and pending approvals, and a 25-item recent
 * activity feed interleaving the newest rows from every workspace-scoped
 * table. Read-only — no rows are mutated.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const dashboard = await getWorkspaceDashboard(workspace.id);
    if (!dashboard) {
      return Response.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    }
    return Response.json({ dashboard });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view the workspace dashboard." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workspace dashboard unavailable.",
      },
      { status: 500 },
    );
  }
}

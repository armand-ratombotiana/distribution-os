import { ensureWorkspace, getWorkspaceSnapshot, requireRequestIdentity } from "../../../db/workspaces";

export async function GET(request: Request) {
  try {
    const identity = requireRequestIdentity(request);
    const workspace = await ensureWorkspace(identity);
    return Response.json(await getWorkspaceSnapshot(workspace));
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return Response.json({ error: "Sign in to open your workspace." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Workspace unavailable." }, { status: 500 });
  }
}

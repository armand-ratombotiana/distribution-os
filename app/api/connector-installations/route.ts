import { ensureWorkspace, requireRequestIdentity } from "../../../db/workspaces";
import {
  listInstallations,
  summarizeForDisplay,
} from "../../../db/connector-installations";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/**
 * List every connector installation for the current workspace, newest first.
 *
 * Query params:
 *   - status  — filter by connector status (e.g. `connected`, `degraded`).
 *   - limit   — clamp to [1, 200]; defaults to 100.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status") ?? undefined;
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const installations = await listInstallations(workspace.id, {
      status: statusParam as
        | "setup_required"
        | "authorized"
        | "connected"
        | "healthy"
        | "degraded"
        | "disconnected"
        | "revoked"
        | "error"
        | undefined,
      limit,
    });

    return Response.json({
      installations: installations.map(summarizeForDisplay),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view connector installations." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connector installations could not be loaded.",
      },
      { status: 500 },
    );
  }
}

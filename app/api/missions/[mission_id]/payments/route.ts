import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  listPayments,
  summarizePaymentForDisplay,
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

    const payments = await listPayments(workspace.id, { mission_id });
    return Response.json({ payments: payments.map(summarizePaymentForDisplay) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to view payments." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Payments could not be loaded." },
      { status: 500 }
    );
  }
}

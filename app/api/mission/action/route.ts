import { z } from "zod";
import { advanceMission, approveMission } from "../../../../db/missions";
import { ensureWorkspace, requireRequestIdentity } from "../../../../db/workspaces";

const actionSchema = z.object({
  mission_id: z.string().trim().min(1).max(120),
  action: z.enum(["advance", "approve"]),
});

export async function POST(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const input = actionSchema.parse(await request.json());
    const result =
      input.action === "approve"
        ? await approveMission(input.mission_id, workspace.id)
        : await advanceMission(input.mission_id, workspace.id);

    if (!result) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return Response.json({ error: "Sign in to control this mission." }, { status: 401 });
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid mission action." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Mission action failed." },
      { status: 500 }
    );
  }
}

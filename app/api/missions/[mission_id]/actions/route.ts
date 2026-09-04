import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  enqueueAction,
  listActions,
  summarizeForDisplay,
  type ActionRisk,
} from "../../../../../db/actions";
import { logAuditEvent } from "../../../../../db/audit";

const createActionSchema = z.object({
  action_type: z.string().trim().min(1).max(80),
  channel: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  payload: z.record(z.unknown()).default({}),
  risk: z.enum(["low", "medium", "high"]).optional(),
  expires_in_seconds: z.number().int().positive().max(60 * 60 * 24 * 30).optional(),
});

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const input = createActionSchema.parse(await request.json());
    const now = Date.now();
    const expiresAt = now + (input.expires_in_seconds ?? 60 * 60 * 24 * 7) * 1000;
    const action = await enqueueAction(workspace.id, {
      mission_id,
      action_type: input.action_type,
      channel: input.channel,
      title: input.title,
      summary: input.summary,
      payload: input.payload,
      risk: input.risk as ActionRisk | undefined,
      expires_at: expiresAt,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "action.created",
        action_id: action.id,
        resource_type: "action",
        resource_id: action.id,
        detail: {
          mission_id,
          action_type: action.action_type,
          channel: action.channel,
          risk: action.risk,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ action: summarizeForDisplay(action) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to manage mission actions." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid action request." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Action could not be created." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const actions = await listActions(workspace.id, { mission_id });
    return Response.json({ actions: actions.map(summarizeForDisplay) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to view mission actions." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Actions could not be loaded." },
      { status: 500 }
    );
  }
}

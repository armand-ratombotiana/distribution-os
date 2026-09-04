import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  createContentAsset,
  listContentAssets,
  summarizeForDisplay,
} from "../../../../../db/content-assets";
import { logAuditEvent } from "../../../../../db/audit";

const createContentSchema = z.object({
  platform: z.string().trim().min(1).max(60),
  format: z.string().trim().min(1).max(60),
  hook: z.string().trim().min(1).max(280),
  body: z.string().trim().min(1).max(5000),
  cta: z.string().trim().min(1).max(280),
  action_id: z.string().trim().max(120).optional(),
  variant_of_id: z.string().trim().max(120).optional(),
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

    const input = createContentSchema.parse(await request.json());
    const asset = await createContentAsset(workspace.id, {
      mission_id,
      platform: input.platform,
      format: input.format,
      hook: input.hook,
      body: input.body,
      cta: input.cta,
      action_id: input.action_id ?? null,
      variant_of_id: input.variant_of_id ?? null,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "content.created",
        resource_type: "content_asset",
        resource_id: asset.id,
        detail: {
          mission_id,
          platform: asset.platform,
          format: asset.format,
          status: asset.status,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ content: summarizeForDisplay(asset) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to manage content." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid content request." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Content asset could not be created." },
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

    const assets = await listContentAssets(workspace.id, { mission_id });
    return Response.json({ content: assets.map(summarizeForDisplay) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to view content." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Content could not be loaded." },
      { status: 500 }
    );
  }
}

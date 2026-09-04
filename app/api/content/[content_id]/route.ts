import { z } from "zod";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import {
  getContentAsset,
  summarizeForDisplay,
  updateContentAsset,
} from "../../../../db/content-assets";
import { logAuditEvent } from "../../../../db/audit";

const patchSchema = z
  .object({
    mission_id: z.string().trim().min(1).max(120).optional(),
    action_id: z.string().trim().max(120).nullable().optional(),
    platform: z.string().trim().min(1).max(60).optional(),
    format: z.string().trim().min(1).max(60).optional(),
    hook: z.string().trim().min(1).max(280).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
    cta: z.string().trim().min(1).max(280).optional(),
    variant_of_id: z.string().trim().max(120).nullable().optional(),
    provider_id: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{ content_id: string }>;
};

/**
 * Single-content-asset endpoints.
 *
 * GET   — return the asset (redacted through `summarizeForDisplay`).
 * PATCH — update editable copy / platform / format / mission / provider
 *         fields. Lifecycle transitions (status, approved_at, published_at,
 *         etc.) go through the dedicated `content/[id]/status` route — this
 *         endpoint intentionally does not mutate status so the lifecycle
 *         stays a single, audited code path. Archived assets cannot be edited.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { content_id } = await context.params;
    const asset = await getContentAsset(workspace.id, content_id);
    if (!asset) {
      return Response.json({ error: "Content not found." }, { status: 404 });
    }
    return Response.json({ content: summarizeForDisplay(asset) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view content." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Content unavailable.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { content_id } = await context.params;

    const current = await getContentAsset(workspace.id, content_id);
    if (!current) {
      return Response.json({ error: "Content not found." }, { status: 404 });
    }

    const input = patchSchema.parse(await request.json());
    const updated = await updateContentAsset(workspace.id, content_id, {
      mission_id: input.mission_id,
      action_id: input.action_id ?? undefined,
      platform: input.platform,
      format: input.format,
      hook: input.hook,
      body: input.body,
      cta: input.cta,
      variant_of_id: input.variant_of_id ?? undefined,
      provider_id: input.provider_id ?? undefined,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "content.updated",
        resource_type: "content_asset",
        resource_id: content_id,
        detail: {
          mission_id: updated.mission_id,
          patched_fields: Object.keys(input),
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ content: summarizeForDisplay(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update content." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid content update." },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Content update failed.";
    const isInvalid = message.startsWith("Invalid content asset");
    return Response.json(
      { error: message },
      { status: isInvalid ? 400 : 500 },
    );
  }
}

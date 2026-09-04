import { z } from "zod";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import {
  getOrCreateSettings,
  summarizeForDisplay,
  updateSettings,
  type UpdateSettingsPatch,
} from "../../../../db/workspace-settings";
import { logAuditEvent } from "../../../../db/audit";

const patchSchema = z
  .object({
    monthly_budget_cents: z.number().int().nonnegative().max(100_000_000).optional(),
    daily_budget_cents: z.number().int().nonnegative().max(10_000_000).optional(),
    per_action_budget_cents: z.number().int().nonnegative().max(1_000_000).optional(),
    quiet_hours_start: z.number().int().min(0).max(23).optional(),
    quiet_hours_end: z.number().int().min(0).max(23).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    retention_days: z.number().int().min(1).max(3650).optional(),
    max_daily_actions: z.number().int().min(1).max(10_000).optional(),
    auto_approve_low_risk: z.boolean().optional(),
    brand_voice_json: z.string().max(10_000).optional(),
  })
  .strict();

/**
 * Workspace settings — budget caps, quiet hours, retention and brand voice.
 *
 * GET   — return the settings row for the current workspace, creating it from
 *         `DEFAULT_SETTINGS` when one does not yet exist. The result is
 *         projected through `summarizeForDisplay` so spend headroom and budget
 *         status are pre-computed for the UI.
 * PATCH — apply a partial update. Budget, quiet-hours and timezone fields are
 *         validated by the pure helpers before any SQL runs.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const settings = await getOrCreateSettings(workspace.id);
    return Response.json({ settings: summarizeForDisplay(settings) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view workspace settings." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Workspace settings unavailable.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const input = patchSchema.parse(await request.json());
    const patch: UpdateSettingsPatch = {
      ...input,
      // The DB column stores auto_approve_low_risk as 0/1; the pure helper
      // expects a boolean so we keep the schema boolean here and let the
      // wrapper handle the integer coercion.
      auto_approve_low_risk: input.auto_approve_low_risk,
    };
    const updated = await updateSettings(workspace.id, patch);

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "config",
        event_type: "workspace_settings.updated",
        resource_type: "workspace_settings",
        resource_id: workspace.id,
        detail: { patched_fields: Object.keys(input) },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ settings: summarizeForDisplay(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update workspace settings." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid workspace settings patch." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Workspace settings could not be updated.",
      },
      { status: 500 },
    );
  }
}

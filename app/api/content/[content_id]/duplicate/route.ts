import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import {
  createContentAsset,
  getContentAsset,
  summarizeForDisplay,
} from "../../../../../db/content-assets";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ content_id: string }>;
};

type DuplicateResponse = {
  source_id: string;
  content: ReturnType<typeof summarizeForDisplay>;
};

/**
 * Duplicate a content asset.
 *
 * Creates a new `content_assets` row that copies the source asset's
 * `mission_id`, `action_id`, `platform`, `format`, `hook`, `body`, `cta`
 * and `variant_of_id` fields verbatim. The new row receives:
 *   - a fresh id (via `buildContentId` inside `createContentAsset`)
 *   - `status = 'draft'` (always — duplicating an approved/published asset
 *     does not carry over its lifecycle state)
 *   - empty lifecycle timestamps (`approved_at`, `scheduled_at`,
 *     `published_at` all null) and `approved_by = null`
 *   - `provider_id = null` (the duplicate is not yet bound to a provider)
 *   - a fresh `created_at` / `updated_at`
 *
 * The `variant_of_id` field of the new row is set to the *source* asset's id
 * when the source does not already have a `variant_of_id` — this lets the
 * operator trace the duplicate back to its origin. When the source itself is
 * already a variant, the duplicate inherits the original ancestor id rather
 * than chaining (so a tree of variants stays one level deep).
 *
 * Refuses to duplicate an archived (terminal) asset — the audit trail for
 * archived content must remain immutable.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { content_id } = await context.params;

    const source = await getContentAsset(workspace.id, content_id);
    if (!source) {
      return Response.json({ error: "Content not found." }, { status: 404 });
    }
    if (source.status === "archived") {
      return Response.json(
        {
          error:
            "Archived content cannot be duplicated — restore it to a non-terminal status first.",
        },
        { status: 409 },
      );
    }

    const variantOfId = source.variant_of_id ?? source.id;
    const duplicate = await createContentAsset(workspace.id, {
      mission_id: source.mission_id,
      action_id: source.action_id,
      platform: source.platform,
      format: source.format,
      hook: source.hook,
      body: source.body,
      cta: source.cta,
      variant_of_id: variantOfId,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "content.duplicated",
        resource_type: "content_asset",
        resource_id: duplicate.id,
        detail: {
          source_id: content_id,
          new_id: duplicate.id,
          mission_id: duplicate.mission_id,
          platform: duplicate.platform,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    const response: DuplicateResponse = {
      source_id: content_id,
      content: summarizeForDisplay(duplicate),
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to duplicate content." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Content could not be duplicated.",
      },
      { status: 500 },
    );
  }
}

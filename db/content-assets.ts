/**
 * D1 persistence layer for the `content_assets` table.
 *
 * Tenant-isolated by `workspace_id`. Delegates validation, lifecycle and
 * display logic to `./content-assets-pure`. IDs use `buildContentId` (which
 * embeds a timestamp and random suffix) and timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildContentId,
  canTransition,
  isTerminal,
  validateContent,
  type ContentAssetRow,
} from "./content-assets-pure";

export * from "./content-assets-pure";

export type CreateContentAssetInput = {
  mission_id: string;
  action_id?: string | null;
  platform: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  variant_of_id?: string | null;
};

export type ListContentAssetsOptions = {
  mission_id?: string;
  status?: string;
  limit?: number;
};

export type UpdateContentStatusInput = {
  approved_by?: string | null;
  approved_at?: number | null;
  scheduled_at?: number | null;
  published_at?: number | null;
  provider_id?: string | null;
};

export type UpdateContentAssetInput = {
  mission_id?: string;
  action_id?: string | null;
  platform?: string;
  format?: string;
  hook?: string;
  body?: string;
  cta?: string;
  variant_of_id?: string | null;
  provider_id?: string | null;
};

/**
 * Insert a new content asset in the `draft` status. The row is validated by
 * the pure helper before any SQL is executed so that required-field and
 * length rules are enforced consistently.
 */
export async function createContentAsset(
  workspaceId: string,
  input: CreateContentAssetInput,
): Promise<ContentAssetRow> {
  const db = getRawDb();
  const now = Date.now();
  const id = buildContentId(input.platform);
  const row: ContentAssetRow = {
    id,
    workspace_id: workspaceId,
    mission_id: input.mission_id,
    action_id: input.action_id ?? null,
    platform: input.platform,
    format: input.format,
    hook: input.hook,
    body: input.body,
    cta: input.cta,
    status: "draft",
    variant_of_id: input.variant_of_id ?? null,
    approved_by: null,
    approved_at: null,
    scheduled_at: null,
    published_at: null,
    provider_id: null,
    created_at: now,
    updated_at: now,
  };
  const validation = validateContent(row);
  if (!validation.valid) {
    throw new Error(`Invalid content asset: ${validation.errors.join("; ")}`);
  }

  await db
    .prepare(
      "INSERT INTO content_assets (id, workspace_id, mission_id, action_id, platform, format, hook, body, cta, status, variant_of_id, approved_by, approved_at, scheduled_at, published_at, provider_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.workspace_id,
      row.mission_id,
      row.action_id,
      row.platform,
      row.format,
      row.hook,
      row.body,
      row.cta,
      row.status,
      row.variant_of_id,
      row.approved_by,
      row.approved_at,
      row.scheduled_at,
      row.published_at,
      row.provider_id,
      row.created_at,
      row.updated_at,
    )
    .run();

  const persisted = await getContentAsset(workspaceId, id);
  if (!persisted) {
    throw new Error("Failed to create content asset");
  }
  return persisted;
}

/**
 * List content assets for a workspace, optionally filtered by mission and/or
 * status. Ordered by `created_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listContentAssets(
  workspaceId: string,
  opts: ListContentAssetsOptions = {},
): Promise<ContentAssetRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.status) {
    const result = await db
      .prepare(
        "SELECT * FROM content_assets WHERE workspace_id = ? AND mission_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.status, limit)
      .all<ContentAssetRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM content_assets WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<ContentAssetRow>();
    return result.results;
  }
  if (opts.status) {
    const result = await db
      .prepare(
        "SELECT * FROM content_assets WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<ContentAssetRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM content_assets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<ContentAssetRow>();
  return result.results;
}

/** Fetch a single content asset by id within a workspace. */
export async function getContentAsset(
  workspaceId: string,
  assetId: string,
): Promise<ContentAssetRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM content_assets WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, assetId)
    .first<ContentAssetRow>();
}

/**
 * Transition a content asset to a new status. Refuses the transition when the
 * content lifecycle (`canTransition`) does not permit it, and refuses to move
 * a terminal-status asset. Status-dependent fields (e.g. `approved_at` for
 * `approved`, `published_at` for `published`) are stamped automatically when
 * the caller does not supply them.
 */
export async function updateContentStatus(
  workspaceId: string,
  assetId: string,
  newStatus: string,
  opts: UpdateContentStatusInput = {},
): Promise<ContentAssetRow> {
  const db = getRawDb();
  const current = await getContentAsset(workspaceId, assetId);
  if (!current) {
    throw new Error(`Content asset not found: ${assetId}`);
  }
  if (isTerminal(current.status)) {
    throw new Error(
      `Content asset ${assetId} is in terminal status ${current.status}`,
    );
  }
  if (!canTransition(current.status, newStatus)) {
    throw new Error(
      `Content asset ${assetId} cannot transition from ${current.status} to ${newStatus}`,
    );
  }
  const now = Date.now();
  const approvedBy =
    opts.approved_by !== undefined ? opts.approved_by : current.approved_by;
  const approvedAt =
    opts.approved_at !== undefined
      ? opts.approved_at
      : newStatus === "approved" && current.approved_at === null
        ? now
        : current.approved_at;
  const scheduledAt =
    opts.scheduled_at !== undefined ? opts.scheduled_at : current.scheduled_at;
  const publishedAt =
    opts.published_at !== undefined
      ? opts.published_at
      : newStatus === "published" && current.published_at === null
        ? now
        : current.published_at;
  const providerId =
    opts.provider_id !== undefined ? opts.provider_id : current.provider_id;

  await db
    .prepare(
      "UPDATE content_assets SET status = ?, approved_by = ?, approved_at = ?, scheduled_at = ?, published_at = ?, provider_id = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(
      newStatus,
      approvedBy,
      approvedAt,
      scheduledAt,
      publishedAt,
      providerId,
      now,
      workspaceId,
      assetId,
    )
    .run();

  const updated = await getContentAsset(workspaceId, assetId);
  if (!updated) {
    throw new Error(`Content asset disappeared after update: ${assetId}`);
  }
  return updated;
}

/**
 * Patch editable fields on a content asset without transitioning its lifecycle
 * status. This is the complement to `updateContentStatus` — use it to update
 * copy (hook/body/cta), platform/format, mission association or provider id.
 *
 * Refuses to mutate an `archived` asset (the only terminal content status) so
 * that the published record stays immutable. The merged row is re-validated by
 * `validateContent` (pure helper) before any SQL is executed. Lifecycle-only
 * fields (`status`, `approved_by`, `approved_at`, `scheduled_at`,
 * `published_at`) are intentionally not exposed here — callers should use
 * `updateContentStatus` for those.
 */
export async function updateContentAsset(
  workspaceId: string,
  assetId: string,
  updates: UpdateContentAssetInput,
): Promise<ContentAssetRow> {
  const db = getRawDb();
  const current = await getContentAsset(workspaceId, assetId);
  if (!current) {
    throw new Error(`Content asset not found: ${assetId}`);
  }
  if (isTerminal(current.status)) {
    throw new Error(
      `Content asset ${assetId} is in terminal status ${current.status} and cannot be edited`,
    );
  }

  const merged: ContentAssetRow = {
    ...current,
    mission_id:
      updates.mission_id !== undefined ? updates.mission_id : current.mission_id,
    action_id:
      updates.action_id !== undefined
        ? updates.action_id
        : current.action_id,
    platform:
      updates.platform !== undefined ? updates.platform : current.platform,
    format: updates.format !== undefined ? updates.format : current.format,
    hook: updates.hook !== undefined ? updates.hook : current.hook,
    body: updates.body !== undefined ? updates.body : current.body,
    cta: updates.cta !== undefined ? updates.cta : current.cta,
    variant_of_id:
      updates.variant_of_id !== undefined
        ? updates.variant_of_id
        : current.variant_of_id,
    provider_id:
      updates.provider_id !== undefined
        ? updates.provider_id
        : current.provider_id,
  };
  const validation = validateContent(merged);
  if (!validation.valid) {
    throw new Error(
      `Invalid content asset update: ${validation.errors.join("; ")}`,
    );
  }

  const now = Date.now();
  await db
    .prepare(
      "UPDATE content_assets SET mission_id = ?, action_id = ?, platform = ?, format = ?, hook = ?, body = ?, cta = ?, variant_of_id = ?, provider_id = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(
      merged.mission_id,
      merged.action_id,
      merged.platform,
      merged.format,
      merged.hook,
      merged.body,
      merged.cta,
      merged.variant_of_id,
      merged.provider_id,
      now,
      workspaceId,
      assetId,
    )
    .run();

  const updated = await getContentAsset(workspaceId, assetId);
  if (!updated) {
    throw new Error(`Content asset disappeared after update: ${assetId}`);
  }
  return updated;
}

import { CONTENT_STATUSES } from "./schema";

/**
 * Pure, dependency-free helpers for the `content_assets` table.
 *
 * Everything in this module is deterministic and side-effect free so it can
 * be unit-tested in isolation and shared between server routes, the worker
 * pipeline and the UI.
 */

export type ContentPlatform =
  | "linkedin"
  | "twitter"
  | "bluesky"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "blog"
  | "newsletter"
  | "email";

export type ContentAssetRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  action_id: string | null;
  platform: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  status: string;
  variant_of_id: string | null;
  approved_by: string | null;
  approved_at: number | null;
  scheduled_at: number | null;
  published_at: number | null;
  provider_id: string | null;
  created_at: number;
  updated_at: number;
};

export type ContentValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Allowed forward transitions for a content asset lifecycle.
 *
 * `archived` is the only terminal state — once archived the asset cannot be
 * resurrected through this state machine.
 */
export const CONTENT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft: ["in_review", "archived"],
  in_review: ["approved", "draft", "archived"],
  approved: ["scheduled", "published", "archived"],
  scheduled: ["published", "approved", "failed"],
  published: ["archived"],
  failed: ["draft", "archived"],
  archived: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = CONTENT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function isTerminal(status: string): boolean {
  const allowed = CONTENT_TRANSITIONS[status];
  if (!allowed) return false;
  return allowed.length === 0;
}

const MAX_HOOK_LENGTH = 280;
const MAX_BODY_LENGTH = 5000;

export function validateContent(row: Partial<ContentAssetRow>): ContentValidationResult {
  const errors: string[] = [];

  if (!row.workspace_id || row.workspace_id.trim() === "") {
    errors.push("workspace_id is required");
  }
  if (!row.mission_id || row.mission_id.trim() === "") {
    errors.push("mission_id is required");
  }
  if (!row.platform || row.platform.trim() === "") {
    errors.push("platform is required");
  }
  if (!row.format || row.format.trim() === "") {
    errors.push("format is required");
  }
  if (!row.hook || row.hook.trim() === "") {
    errors.push("hook is required");
  }
  if (!row.body || row.body.trim() === "") {
    errors.push("body is required");
  }
  if (!row.cta || row.cta.trim() === "") {
    errors.push("cta is required");
  }

  if (row.status && !CONTENT_STATUSES.includes(row.status as (typeof CONTENT_STATUSES)[number])) {
    errors.push(`status must be one of: ${CONTENT_STATUSES.join(", ")}`);
  }

  if (row.hook && row.hook.length > MAX_HOOK_LENGTH) {
    errors.push(`hook must be ${MAX_HOOK_LENGTH} characters or less`);
  }
  if (row.body && row.body.length > MAX_BODY_LENGTH) {
    errors.push(`body must be ${MAX_BODY_LENGTH} characters or less`);
  }

  // Status-dependent invariants
  if (row.status === "approved" && !row.approved_by) {
    errors.push("approved_by is required when status is approved");
  }
  if (row.status === "approved" && (!row.approved_at || row.approved_at <= 0)) {
    errors.push("approved_at is required when status is approved");
  }
  if (row.status === "scheduled" && (!row.scheduled_at || row.scheduled_at <= 0)) {
    errors.push("scheduled_at is required when status is scheduled");
  }
  if (row.status === "published" && (!row.published_at || row.published_at <= 0)) {
    errors.push("published_at is required when status is published");
  }

  return { valid: errors.length === 0, errors };
}

export type ContentSummary = {
  id: string;
  platform: string;
  format: string;
  status: string;
  hook: string;
  cta: string;
  preview: string;
  approved_by: string | null;
  scheduled_at: number | null;
  published_at: number | null;
  is_terminal: boolean;
};

export function summarizeForDisplay(row: ContentAssetRow): ContentSummary {
  return {
    id: row.id,
    platform: row.platform,
    format: row.format,
    status: row.status,
    hook: row.hook,
    cta: row.cta,
    preview: row.body.length > 140 ? `${row.body.slice(0, 137)}...` : row.body,
    approved_by: row.approved_by,
    scheduled_at: row.scheduled_at,
    published_at: row.published_at,
    is_terminal: isTerminal(row.status),
  };
}

/**
 * Build a stable, URL-safe content asset id.
 *
 * The id is prefixed with `content_` and combines a 36-base timestamp, a
 * random component and an optional semantic seed (e.g. mission slug). The
 * output is always lowercased and only contains `[a-z0-9_]`.
 */
export function buildContentId(seed?: string): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const safeSeed = (seed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return safeSeed ? `content_${time}_${rand}_${safeSeed}` : `content_${time}_${rand}`;
}

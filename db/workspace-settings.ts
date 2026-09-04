/**
 * D1 persistence layer for the `workspace_settings` table.
 *
 * Tenant-isolated by `workspace_id` (the table enforces a 1:1 relationship
 * via a unique constraint on `workspace_id`). Delegates budget, quiet-hours,
 * timezone and forbidden-claims logic to `./workspace-settings-pure`. IDs use
 * `crypto.randomUUID()` and timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  DEFAULT_SETTINGS,
  parseForbiddenClaims,
  validateBudget,
  validateQuietHours,
  validateTimezone,
  type WorkspaceSettingsRow,
} from "./workspace-settings-pure";

export * from "./workspace-settings-pure";

export type UpdateSettingsPatch = Partial<
  Pick<
    WorkspaceSettingsRow,
    | "monthly_budget_cents"
    | "daily_budget_cents"
    | "per_action_budget_cents"
    | "quiet_hours_start"
    | "quiet_hours_end"
    | "timezone"
    | "retention_days"
    | "max_daily_actions"
    | "auto_approve_low_risk"
    | "brand_voice_json"
  >
>;

/**
 * Return the settings row for a workspace, creating it from the pure module's
 * `DEFAULT_SETTINGS` when it does not yet exist. The insert is wrapped in an
 * UPSERT so concurrent callers cannot race on the unique `workspace_id`
 * constraint.
 */
export async function getOrCreateSettings(
  workspaceId: string,
): Promise<WorkspaceSettingsRow> {
  const db = getRawDb();
  const existing = await db
    .prepare(
      "SELECT * FROM workspace_settings WHERE workspace_id = ? LIMIT 1",
    )
    .bind(workspaceId)
    .first<WorkspaceSettingsRow>();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const id = `st_${crypto.randomUUID()}`;
  await db
    .prepare(
      "INSERT INTO workspace_settings (id, workspace_id, monthly_budget_cents, monthly_spent_cents, daily_budget_cents, daily_spent_cents, per_action_budget_cents, quiet_hours_start, quiet_hours_end, timezone, forbidden_claims_json, brand_voice_json, retention_days, auto_approve_low_risk, max_daily_actions, created_at, updated_at) VALUES (?, ?, ?, 0, ?, 0, ?, ?, ?, ?, '[]', '{}', ?, ?, ?, ?, ?) ON CONFLICT(workspace_id) DO NOTHING",
    )
    .bind(
      id,
      workspaceId,
      DEFAULT_SETTINGS.monthly_budget_cents,
      DEFAULT_SETTINGS.daily_budget_cents,
      DEFAULT_SETTINGS.per_action_budget_cents,
      DEFAULT_SETTINGS.quiet_hours_start,
      DEFAULT_SETTINGS.quiet_hours_end,
      DEFAULT_SETTINGS.timezone,
      DEFAULT_SETTINGS.retention_days,
      DEFAULT_SETTINGS.auto_approve_low_risk,
      DEFAULT_SETTINGS.max_daily_actions,
      now,
      now,
    )
    .run();

  const row = await db
    .prepare(
      "SELECT * FROM workspace_settings WHERE workspace_id = ? LIMIT 1",
    )
    .bind(workspaceId)
    .first<WorkspaceSettingsRow>();
  if (!row) {
    throw new Error("Failed to create workspace settings");
  }
  return row;
}

/**
 * Apply a partial patch to a workspace's settings. Budget, quiet-hours and
 * timezone fields are validated by the pure helpers before any SQL runs. The
 * row is created on demand when it does not yet exist (via
 * `getOrCreateSettings`) so callers can always patch.
 */
export async function updateSettings(
  workspaceId: string,
  patch: UpdateSettingsPatch,
): Promise<WorkspaceSettingsRow> {
  const current = await getOrCreateSettings(workspaceId);
  const merged: WorkspaceSettingsRow = { ...current, ...stripUndefined(patch) };

  const budgetValidation = validateBudget({
    monthly_budget_cents: merged.monthly_budget_cents,
    daily_budget_cents: merged.daily_budget_cents,
    per_action_budget_cents: merged.per_action_budget_cents,
  });
  if (!budgetValidation.valid) {
    throw new Error(`Invalid budget: ${budgetValidation.errors.join("; ")}`);
  }
  const quietValidation = validateQuietHours(
    merged.quiet_hours_start,
    merged.quiet_hours_end,
  );
  if (!quietValidation.valid) {
    throw new Error(
      `Invalid quiet hours: ${quietValidation.errors.join("; ")}`,
    );
  }
  if (!validateTimezone(merged.timezone)) {
    throw new Error(`Invalid timezone: ${merged.timezone}`);
  }
  if (
    !Number.isFinite(merged.retention_days) ||
    merged.retention_days < 1 ||
    merged.retention_days > 3650
  ) {
    throw new Error("retention_days must be between 1 and 3650");
  }
  if (
    !Number.isFinite(merged.max_daily_actions) ||
    merged.max_daily_actions < 1 ||
    merged.max_daily_actions > 10000
  ) {
    throw new Error("max_daily_actions must be between 1 and 10000");
  }

  const db = getRawDb();
  const now = Date.now();
  await db
    .prepare(
      "UPDATE workspace_settings SET monthly_budget_cents = ?, daily_budget_cents = ?, per_action_budget_cents = ?, quiet_hours_start = ?, quiet_hours_end = ?, timezone = ?, retention_days = ?, max_daily_actions = ?, auto_approve_low_risk = ?, brand_voice_json = ?, updated_at = ? WHERE workspace_id = ?",
    )
    .bind(
      merged.monthly_budget_cents,
      merged.daily_budget_cents,
      merged.per_action_budget_cents,
      merged.quiet_hours_start,
      merged.quiet_hours_end,
      merged.timezone,
      merged.retention_days,
      merged.max_daily_actions,
      merged.auto_approve_low_risk ? 1 : 0,
      merged.brand_voice_json,
      now,
      workspaceId,
    )
    .run();

  const updated = await db
    .prepare(
      "SELECT * FROM workspace_settings WHERE workspace_id = ? LIMIT 1",
    )
    .bind(workspaceId)
    .first<WorkspaceSettingsRow>();
  if (!updated) {
    throw new Error("Workspace settings disappeared after update");
  }
  return updated;
}

/**
 * Append a claim to the forbidden-claims blocklist. Deduplicates against the
 * existing list (case-insensitive) so the same claim cannot be added twice.
 */
export async function addForbiddenClaim(
  workspaceId: string,
  claim: string,
): Promise<WorkspaceSettingsRow> {
  const settings = await getOrCreateSettings(workspaceId);
  const existing = parseForbiddenClaims(settings.forbidden_claims_json);
  const normalized = claim.trim();
  if (!normalized) {
    throw new Error("Forbidden claim must not be empty");
  }
  const already = existing.some(
    (entry) => entry.toLowerCase() === normalized.toLowerCase(),
  );
  if (already) {
    return settings;
  }
  const next = [...existing, normalized];
  const db = getRawDb();
  const now = Date.now();
  await db
    .prepare(
      "UPDATE workspace_settings SET forbidden_claims_json = ?, updated_at = ? WHERE workspace_id = ?",
    )
    .bind(JSON.stringify(next), now, workspaceId)
    .run();
  const updated = await db
    .prepare(
      "SELECT * FROM workspace_settings WHERE workspace_id = ? LIMIT 1",
    )
    .bind(workspaceId)
    .first<WorkspaceSettingsRow>();
  if (!updated) {
    throw new Error("Workspace settings disappeared after update");
  }
  return updated;
}

/**
 * Remove a claim from the forbidden-claims blocklist (case-insensitive match).
 * Removing a claim that is not present is a no-op.
 */
export async function removeForbiddenClaim(
  workspaceId: string,
  claim: string,
): Promise<WorkspaceSettingsRow> {
  const settings = await getOrCreateSettings(workspaceId);
  const existing = parseForbiddenClaims(settings.forbidden_claims_json);
  const normalized = claim.trim().toLowerCase();
  if (!normalized) {
    return settings;
  }
  const next = existing.filter(
    (entry) => entry.toLowerCase() !== normalized,
  );
  if (next.length === existing.length) {
    return settings;
  }
  const db = getRawDb();
  const now = Date.now();
  await db
    .prepare(
      "UPDATE workspace_settings SET forbidden_claims_json = ?, updated_at = ? WHERE workspace_id = ?",
    )
    .bind(JSON.stringify(next), now, workspaceId)
    .run();
  const updated = await db
    .prepare(
      "SELECT * FROM workspace_settings WHERE workspace_id = ? LIMIT 1",
    )
    .bind(workspaceId)
    .first<WorkspaceSettingsRow>();
  if (!updated) {
    throw new Error("Workspace settings disappeared after update");
  }
  return updated;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] !== undefined) {
      out[key] = value[key];
    }
  }
  return out;
}

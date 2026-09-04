/**
 * Pure, dependency-free helpers for the `workspace_settings` table.
 *
 * Encodes the workspace budget policy, quiet-hours windows, timezone
 * validation and the forbidden-claims blocklist used to keep generated
 * content compliant.
 */

export type WorkspaceSettingsRow = {
  id: string;
  workspace_id: string;
  monthly_budget_cents: number;
  monthly_spent_cents: number;
  daily_budget_cents: number;
  daily_spent_cents: number;
  per_action_budget_cents: number;
  quiet_hours_start: number; // 0-23
  quiet_hours_end: number; // 0-23
  timezone: string;
  forbidden_claims_json: string;
  brand_voice_json: string;
  retention_days: number;
  auto_approve_low_risk: number; // 0/1 boolean stored as integer
  max_daily_actions: number;
  created_at: number;
  updated_at: number;
};

export type BudgetScope = "monthly" | "daily" | "per_action";

export type SettingsValidationResult = {
  valid: boolean;
  errors: string[];
};

export const DEFAULT_SETTINGS: Omit<WorkspaceSettingsRow, "id" | "workspace_id" | "created_at" | "updated_at"> = {
  monthly_budget_cents: 10000,
  monthly_spent_cents: 0,
  daily_budget_cents: 2000,
  daily_spent_cents: 0,
  per_action_budget_cents: 1000,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  timezone: "UTC",
  forbidden_claims_json: "[]",
  brand_voice_json: "{}",
  retention_days: 365,
  auto_approve_low_risk: 0,
  max_daily_actions: 50,
};

/**
 * Returns true when spending `amountCents` more would stay within the
 * configured budget for the given scope.
 */
export function isWithinBudget(
  settings: Pick<
    WorkspaceSettingsRow,
    "monthly_budget_cents" | "monthly_spent_cents" | "daily_budget_cents" | "daily_spent_cents" | "per_action_budget_cents"
  >,
  amountCents: number,
  scope: BudgetScope,
): boolean {
  if (amountCents < 0) return false;
  if (scope === "monthly") {
    return settings.monthly_spent_cents + amountCents <= settings.monthly_budget_cents;
  }
  if (scope === "daily") {
    return settings.daily_spent_cents + amountCents <= settings.daily_budget_cents;
  }
  return amountCents <= settings.per_action_budget_cents;
}

/**
 * Returns true when `hour` (0-23) falls inside the configured quiet hours
 * window. Quiet hours may wrap around midnight, e.g. start=22 / end=8.
 *
 * When `start === end` the window is considered disabled (never quiet).
 */
export function isQuietHours(hour: number, start: number, end: number): boolean {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
  if (start < 0 || start > 23 || end < 0 || end > 23) return false;
  if (start === end) return false;
  if (start < end) {
    return hour >= start && hour < end;
  }
  // Wraps past midnight.
  return hour >= start || hour < end;
}

export function validateBudget(settings: Pick<WorkspaceSettingsRow, "monthly_budget_cents" | "daily_budget_cents" | "per_action_budget_cents">): SettingsValidationResult {
  const errors: string[] = [];
  const { monthly_budget_cents, daily_budget_cents, per_action_budget_cents } = settings;
  if (!Number.isFinite(monthly_budget_cents) || monthly_budget_cents < 0) {
    errors.push("monthly_budget_cents must be a non-negative number");
  }
  if (!Number.isFinite(daily_budget_cents) || daily_budget_cents < 0) {
    errors.push("daily_budget_cents must be a non-negative number");
  }
  if (!Number.isFinite(per_action_budget_cents) || per_action_budget_cents < 0) {
    errors.push("per_action_budget_cents must be a non-negative number");
  }
  if (
    monthly_budget_cents >= 0 &&
    daily_budget_cents >= 0 &&
    daily_budget_cents > monthly_budget_cents
  ) {
    errors.push("daily_budget_cents must not exceed monthly_budget_cents");
  }
  if (
    per_action_budget_cents >= 0 &&
    daily_budget_cents >= 0 &&
    per_action_budget_cents > daily_budget_cents
  ) {
    errors.push("per_action_budget_cents must not exceed daily_budget_cents");
  }
  return { valid: errors.length === 0, errors };
}

export function validateQuietHours(start: number, end: number): SettingsValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(start) || start < 0 || start > 23) {
    errors.push("quiet_hours_start must be an integer between 0 and 23");
  }
  if (!Number.isInteger(end) || end < 0 || end > 23) {
    errors.push("quiet_hours_end must be an integer between 0 and 23");
  }
  return { valid: errors.length === 0, errors };
}

export function validateTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") return false;
  if (timezone.length > 64) return false;
  try {
    // Intl will throw if the timezone is not a valid IANA zone.
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function parseForbiddenClaims(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
    }
  } catch {
    /* fall through */
  }
  return [];
}

/**
 * Returns true if `claim` matches (case-insensitive, substring-aware) any
 * entry in the forbidden claims list. Accepts either a pre-parsed array or
 * the raw JSON string stored on the settings row.
 */
export function isClaimForbidden(claim: string, claims: string[] | string | null | undefined): boolean {
  if (!claim || typeof claim !== "string") return false;
  const list = Array.isArray(claims) ? claims : parseForbiddenClaims(claims);
  if (list.length === 0) return false;
  const normalized = claim.toLowerCase().trim();
  if (normalized === "") return false;
  return list.some((entry) => {
    const needle = entry.toLowerCase().trim();
    if (needle === "") return false;
    return normalized === needle || normalized.includes(needle);
  });
}

export type WorkspaceSettingsSummary = {
  workspace_id: string;
  timezone: string;
  monthly_budget_cents: number;
  monthly_spent_cents: number;
  monthly_remaining_cents: number;
  daily_budget_cents: number;
  daily_spent_cents: number;
  daily_remaining_cents: number;
  per_action_budget_cents: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  retention_days: number;
  max_daily_actions: number;
  auto_approve_low_risk: boolean;
  forbidden_claims_count: number;
  within_monthly_budget: boolean;
  within_daily_budget: boolean;
};

export function summarizeForDisplay(settings: WorkspaceSettingsRow): WorkspaceSettingsSummary {
  const monthly_remaining_cents = settings.monthly_budget_cents - settings.monthly_spent_cents;
  const daily_remaining_cents = settings.daily_budget_cents - settings.daily_spent_cents;
  return {
    workspace_id: settings.workspace_id,
    timezone: settings.timezone,
    monthly_budget_cents: settings.monthly_budget_cents,
    monthly_spent_cents: settings.monthly_spent_cents,
    monthly_remaining_cents,
    daily_budget_cents: settings.daily_budget_cents,
    daily_spent_cents: settings.daily_spent_cents,
    daily_remaining_cents,
    per_action_budget_cents: settings.per_action_budget_cents,
    quiet_hours_start: settings.quiet_hours_start,
    quiet_hours_end: settings.quiet_hours_end,
    retention_days: settings.retention_days,
    max_daily_actions: settings.max_daily_actions,
    auto_approve_low_risk: Boolean(settings.auto_approve_low_risk),
    forbidden_claims_count: parseForbiddenClaims(settings.forbidden_claims_json).length,
    within_monthly_budget: monthly_remaining_cents >= 0,
    within_daily_budget: daily_remaining_cents >= 0,
  };
}

/**
 * Policy gate: only owner/admin roles may push the daily spend past its
 * configured cap, and only while the monthly budget still has headroom —
 * the daily cap is a soft guardrail, the monthly budget is the hard ceiling.
 */
export function canExceedDailyLimit(
  settings: Pick<WorkspaceSettingsRow, "monthly_budget_cents" | "monthly_spent_cents">,
  role: string,
): boolean {
  if (role !== "owner" && role !== "admin") return false;
  return settings.monthly_budget_cents - settings.monthly_spent_cents > 0;
}

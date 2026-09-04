import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  canExceedDailyLimit,
  isClaimForbidden,
  isQuietHours,
  isWithinBudget,
  parseForbiddenClaims,
  summarizeForDisplay,
  validateBudget,
  validateQuietHours,
  validateTimezone,
  type WorkspaceSettingsRow,
} from "../db/workspace-settings-pure";

function baseSettings(overrides: Partial<WorkspaceSettingsRow> = {}): WorkspaceSettingsRow {
  return {
    id: "settings_1",
    workspace_id: "ws_1",
    monthly_budget_cents: 10000,
    monthly_spent_cents: 0,
    daily_budget_cents: 2000,
    daily_spent_cents: 0,
    per_action_budget_cents: 1000,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
    timezone: "UTC",
    forbidden_claims_json: '["cure","FDA"]',
    brand_voice_json: "{}",
    retention_days: 365,
    auto_approve_low_risk: 0,
    max_daily_actions: 50,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    ...overrides,
  };
}

test("DEFAULT_SETTINGS exposes the schema defaults", () => {
  assert.equal(DEFAULT_SETTINGS.monthly_budget_cents, 10000);
  assert.equal(DEFAULT_SETTINGS.daily_budget_cents, 2000);
  assert.equal(DEFAULT_SETTINGS.per_action_budget_cents, 1000);
  assert.equal(DEFAULT_SETTINGS.quiet_hours_start, 22);
  assert.equal(DEFAULT_SETTINGS.quiet_hours_end, 8);
  assert.equal(DEFAULT_SETTINGS.timezone, "UTC");
  assert.equal(DEFAULT_SETTINGS.retention_days, 365);
  assert.equal(DEFAULT_SETTINGS.max_daily_actions, 50);
  assert.equal(DEFAULT_SETTINGS.auto_approve_low_risk, 0);
  assert.equal(DEFAULT_SETTINGS.forbidden_claims_json, "[]");
});

test("isWithinBudget respects monthly and daily caps", () => {
  const settings = baseSettings({ monthly_spent_cents: 8000, daily_spent_cents: 1500 });
  assert.equal(isWithinBudget(settings, 2000, "monthly"), true);
  assert.equal(isWithinBudget(settings, 2001, "monthly"), false);
  assert.equal(isWithinBudget(settings, 500, "daily"), true);
  assert.equal(isWithinBudget(settings, 501, "daily"), false);
});

test("isWithinBudget respects per_action cap and rejects negative amounts", () => {
  const settings = baseSettings();
  assert.equal(isWithinBudget(settings, 1000, "per_action"), true);
  assert.equal(isWithinBudget(settings, 1001, "per_action"), false);
  assert.equal(isWithinBudget(settings, -1, "monthly"), false);
  assert.equal(isWithinBudget(settings, -1, "daily"), false);
});

test("isQuietHours handles a midnight-wrapping window (22 -> 8)", () => {
  for (const hour of [22, 23, 0, 1, 2, 3, 4, 5, 6, 7]) {
    assert.equal(isQuietHours(hour, 22, 8), true, `${hour} should be quiet`);
  }
  for (const hour of [8, 9, 12, 17, 21]) {
    assert.equal(isQuietHours(hour, 22, 8), false, `${hour} should not be quiet`);
  }
});

test("isQuietHours handles a same-day window (9 -> 17)", () => {
  for (const hour of [9, 10, 12, 15, 16]) {
    assert.equal(isQuietHours(hour, 9, 17), true, `${hour} should be quiet`);
  }
  for (const hour of [7, 8, 17, 18, 23]) {
    assert.equal(isQuietHours(hour, 9, 17), false, `${hour} should not be quiet`);
  }
});

test("isQuietHours returns false when start === end and rejects out-of-range hour", () => {
  for (const hour of [0, 6, 12, 18, 23]) {
    assert.equal(isQuietHours(hour, 22, 22), false);
  }
  assert.equal(isQuietHours(-1, 22, 8), false);
  assert.equal(isQuietHours(24, 22, 8), false);
  assert.equal(isQuietHours(12.5, 22, 8), false);
  assert.equal(isQuietHours(12, 25, 8), false);
  assert.equal(isQuietHours(12, 22, 30), false);
});

test("validateBudget passes a valid configuration", () => {
  const result = validateBudget({ monthly_budget_cents: 10000, daily_budget_cents: 2000, per_action_budget_cents: 1000 });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateBudget rejects inverted hierarchy and negative budgets", () => {
  const inverted = validateBudget({ monthly_budget_cents: 1000, daily_budget_cents: 2000, per_action_budget_cents: 500 });
  assert.equal(inverted.valid, false);
  assert.ok(inverted.errors.some((e) => e.includes("daily_budget_cents must not exceed monthly_budget_cents")));
  const perActionTooHigh = validateBudget({ monthly_budget_cents: 10000, daily_budget_cents: 1000, per_action_budget_cents: 2000 });
  assert.equal(perActionTooHigh.valid, false);
  assert.ok(perActionTooHigh.errors.some((e) => e.includes("per_action_budget_cents must not exceed daily_budget_cents")));
  const negative = validateBudget({ monthly_budget_cents: -1, daily_budget_cents: 0, per_action_budget_cents: 0 });
  assert.equal(negative.valid, false);
  assert.ok(negative.errors.some((e) => e.includes("monthly_budget_cents must be a non-negative number")));
});

test("validateQuietHours validates the 0-23 range", () => {
  assert.equal(validateQuietHours(22, 8).valid, true);
  assert.equal(validateQuietHours(0, 0).valid, true);
  assert.equal(validateQuietHours(0, 23).valid, true);
  assert.equal(validateQuietHours(-1, 8).valid, false);
  assert.equal(validateQuietHours(22, 24).valid, false);
  assert.equal(validateQuietHours(12.5, 8).valid, false);
});

test("validateTimezone accepts valid IANA zones and rejects invalid ones", () => {
  assert.equal(validateTimezone("UTC"), true);
  assert.equal(validateTimezone("America/New_York"), true);
  assert.equal(validateTimezone("Europe/London"), true);
  assert.equal(validateTimezone("Asia/Kolkata"), true);
  assert.equal(validateTimezone(""), false);
  assert.equal(validateTimezone("Not/A/Zone"), false);
  assert.equal(validateTimezone("Flarb/City"), false);
});

test("parseForbiddenClaims parses arrays and filters non-strings", () => {
  assert.deepEqual(parseForbiddenClaims('["cure","FDA"]'), ["cure", "FDA"]);
  assert.deepEqual(parseForbiddenClaims("[]"), []);
  assert.deepEqual(parseForbiddenClaims(null), []);
  assert.deepEqual(parseForbiddenClaims(undefined), []);
  assert.deepEqual(parseForbiddenClaims(""), []);
  assert.deepEqual(parseForbiddenClaims("not json"), []);
  assert.deepEqual(parseForbiddenClaims('["ok", 42, null, "good"]'), ["ok", "good"]);
  assert.deepEqual(parseForbiddenClaims('{"a":1}'), []);
});

test("isClaimForbidden matches case-insensitively via substring", () => {
  const claims = ["cure", "FDA approved"];
  assert.equal(isClaimForbidden("This will CURE your disease", claims), true);
  assert.equal(isClaimForbidden("we are fda approved!", claims), true);
  assert.equal(isClaimForbidden("safe and effective", claims), false);
  assert.equal(isClaimForbidden("", claims), false);
  assert.equal(isClaimForbidden("cure", '["cure"]'), true);
  assert.equal(isClaimForbidden("nothing matches", "[]"), false);
  assert.equal(isClaimForbidden("anything", null), false);
});

test("summarizeForDisplay includes budget_remaining_cents and within_budget flags", () => {
  const summary = summarizeForDisplay(
    baseSettings({
      monthly_spent_cents: 7000,
      daily_spent_cents: 2500,
      forbidden_claims_json: '["cure","fda","guaranteed"]',
    }),
  );
  assert.equal(summary.monthly_remaining_cents, 3000);
  assert.equal(summary.daily_remaining_cents, -500);
  assert.equal(summary.within_monthly_budget, true);
  assert.equal(summary.within_daily_budget, false);
  assert.equal(summary.forbidden_claims_count, 3);
  assert.equal(summary.auto_approve_low_risk, false);
});

test("canExceedDailyLimit restricts to owner/admin and returns false when monthly budget exhausted", () => {
  const settings = baseSettings({ monthly_budget_cents: 10000, monthly_spent_cents: 5000 });
  assert.equal(canExceedDailyLimit(settings, "owner"), true);
  assert.equal(canExceedDailyLimit(settings, "admin"), true);
  assert.equal(canExceedDailyLimit(settings, "member"), false);
  assert.equal(canExceedDailyLimit(settings, "viewer"), false);
  const exhausted = baseSettings({ monthly_budget_cents: 10000, monthly_spent_cents: 10000 });
  assert.equal(canExceedDailyLimit(exhausted, "owner"), false);
  const overSpent = baseSettings({ monthly_budget_cents: 10000, monthly_spent_cents: 12000 });
  assert.equal(canExceedDailyLimit(overSpent, "owner"), false);
});

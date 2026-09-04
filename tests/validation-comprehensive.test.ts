/**
 * Comprehensive validation coverage across every pure validation helper in
 * Distribution OS. Crosses `lib/validation-pure.ts` plus the per-table
 * validators (`contacts`, `content_assets`, `experiments`,
 * `workspace_settings`, `organizations`).
 *
 * 15 tests, all pure (no D1 / Workers / I/O).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateString,
  validateNumber,
  validateInteger,
  validateEnum,
  validateUrl,
  validateEmail,
  validateUuid,
  validateDateRange,
  validateJsonString,
  sanitizeString,
  sanitizeHtml,
  truncate,
  slugify,
  maskSensitive,
} from "../lib/validation-pure.ts";
import {
  validateEmail as validateContactEmail,
  validateContact,
} from "../db/contacts-pure.ts";
import { validateContent } from "../db/content-assets-pure.ts";
import { validateExperiment } from "../db/experiments-pure.ts";
import {
  validateBudget,
  validateQuietHours,
  validateTimezone,
} from "../db/workspace-settings-pure.ts";
import { validateSlug } from "../db/organizations-pure.ts";

// ─── lib/validation-pure: string, number, integer, enum ───────────────────

test("validation/validateString: enforces required, minLength, maxLength, and pattern", () => {
  assert.equal(validateString(undefined, { required: true }).ok, false);
  assert.equal(validateString(undefined, { required: false }).ok, true);
  assert.equal(validateString("", { required: false }).value, "");
  assert.equal(validateString("ab", { minLength: 3 }).ok, false);
  assert.equal(validateString("abc", { minLength: 3 }).ok, true);
  assert.equal(validateString("abcd", { maxLength: 3 }).ok, false);
  assert.equal(validateString("abc", { pattern: /^[a-z]+$/ }).ok, true);
  assert.equal(validateString("abc1", { pattern: /^[a-z]+$/ }).ok, false);
  assert.equal(validateString(123 as never).ok, false);
});

test("validation/validateNumber + validateInteger: accept numbers/numeric strings, enforce min/max/integer", () => {
  assert.equal(validateNumber(5).ok, true);
  assert.equal(validateNumber("5").value, 5);
  assert.equal(validateNumber("abc").ok, false);
  assert.equal(validateNumber(3, { min: 5 }).ok, false);
  assert.equal(validateNumber(10, { max: 5 }).ok, false);
  assert.equal(validateInteger(5).ok, true);
  assert.equal(validateInteger(5.5).ok, false);
  assert.equal(validateInteger("5").value, 5);
});

test("validation/validateEnum: accepts allowed values and rejects others", () => {
  const allowed = ["draft", "running", "completed"] as const;
  assert.equal(validateEnum("draft", allowed).ok, true);
  assert.equal(validateEnum("running", allowed).value, "running");
  assert.equal(validateEnum("unknown", allowed).ok, false);
  assert.equal(validateEnum(123 as never, allowed).ok, false);
});

// ─── lib/validation-pure: URL, email, UUID, date range, JSON ──────────────

test("validation/validateUrl: accepts http/https, rejects ftp/file/empty/non-string", () => {
  assert.equal(validateUrl("https://example.com").ok, true);
  assert.equal(validateUrl("http://example.com/x").ok, true);
  assert.equal(validateUrl("ftp://example.com").ok, false);
  assert.equal(validateUrl("file:///etc/passwd").ok, false);
  assert.equal(validateUrl("").ok, false);
  assert.equal(validateUrl(123 as never).ok, false);
});

test("validation/validateEmail: accepts valid addresses, rejects malformed", () => {
  assert.equal(validateEmail("a@b.com").ok, true);
  assert.equal(validateEmail("user.name+tag@example.co.uk").ok, true);
  assert.equal(validateEmail("no-at-sign.com").ok, false);
  assert.equal(validateEmail("a@").ok, false);
  assert.equal(validateEmail("@b.com").ok, false);
  assert.equal(validateEmail(123 as never).ok, false);
});

test("validation/validateUuid: accepts canonical UUIDs and lowercases them", () => {
  const upper = "550E8400-E29B-41D4-A716-446655440000";
  const lower = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(validateUuid(upper).value, lower);
  assert.equal(validateUuid(lower).ok, true);
  assert.equal(validateUuid("not-a-uuid").ok, false);
  assert.equal(validateUuid("550e8400-e29b-41d4-a716").ok, false); // too short
});

test("validation/validateDateRange: rejects inverted ranges and invalid dates", () => {
  const start = new Date("2024-01-01T00:00:00Z");
  const end = new Date("2024-02-01T00:00:00Z");
  assert.equal(validateDateRange(start, end).ok, true);
  assert.equal(validateDateRange(end, start).ok, false);
  assert.equal(validateDateRange("not-a-date", end).ok, false);
  assert.equal(validateDateRange(1_700_000_000_000, 1_700_010_000_000).ok, true);
});

test("validation/validateJsonString: parses valid JSON and rejects invalid", () => {
  assert.equal(validateJsonString('{"a":1}').ok, true);
  assert.deepEqual(validateJsonString('{"a":1}').value, { a: 1 });
  assert.equal(validateJsonString("[1,2,3]").ok, true);
  assert.equal(validateJsonString("not json").ok, false);
  assert.equal(validateJsonString(123 as never).ok, false);
});

// ─── lib/validation-pure: sanitisation helpers ────────────────────────────

test("validation/sanitizeString + sanitizeHtml + truncate + slugify + maskSensitive", () => {
  // sanitizeString strips control chars and collapses whitespace.
  assert.equal(sanitizeString("hello\u0007  world"), "hello world");
  assert.equal(sanitizeString(123 as never), "");
  // sanitizeHtml escapes special characters.
  assert.equal(sanitizeHtml("<script>"), "&lt;script&gt;");
  assert.equal(sanitizeHtml('"a" & \'b\''), "&quot;a&quot; &amp; &#39;b&#39;");
  // truncate appends an ellipsis and respects max length.
  assert.equal(truncate("hello world", 8), "hello w…");
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("abc", 0), "");
  // slugify normalises diacritics and non-alphanumerics.
  assert.equal(slugify("Héllo, World!"), "hello-world");
  assert.equal(slugify("foo---bar"), "foo-bar");
  // maskSensitive hides the middle of a string.
  assert.equal(maskSensitive("sk_test_abcdef123456"), "sk****************56");
  assert.equal(maskSensitive(""), "");
});

// ─── contacts-pure ─────────────────────────────────────────────────────────

test("validation/contacts: validateEmail length bounds + validateContact status invariants", () => {
  // Email length bounds (5–254 chars).
  assert.equal(validateContactEmail("a@b.c"), true);
  assert.equal(validateContactEmail("ab@c"), false);
  assert.equal(validateContactEmail("x".repeat(255) + "@y.com"), false);
  assert.equal(validateContactEmail(null), false);
  // validateContact requires workspace_id + source; rejects unknown status.
  const ok = validateContact({
    workspace_id: "ws_1",
    source: "manual",
    status: "new",
  });
  assert.equal(ok.valid, true);
  const missingWs = validateContact({ workspace_id: "  ", source: "manual" });
  assert.equal(missingWs.valid, false);
  const badStatus = validateContact({
    workspace_id: "ws_1",
    source: "manual",
    status: "unknown_status",
  });
  assert.equal(badStatus.valid, false);
  // Converted status requires converted_at.
  const convertedNoTs = validateContact({
    workspace_id: "ws_1",
    source: "manual",
    status: "converted",
  });
  assert.equal(convertedNoTs.valid, false);
});

// ─── content-assets-pure ───────────────────────────────────────────────────

test("validation/content: validateContent requires all text fields and enforces status-dependent timestamps", () => {
  const base = {
    workspace_id: "ws_1",
    mission_id: "mis_1",
    platform: "linkedin",
    format: "post",
    hook: "hook",
    body: "body",
    cta: "cta",
  };
  assert.equal(validateContent(base).valid, true);
  // Missing fields are caught.
  assert.equal(
    validateContent({ ...base, hook: "" }).valid,
    false,
  );
  // Status-dependent: approved requires approved_by + approved_at.
  const approvedNoBy = validateContent({ ...base, status: "approved" });
  assert.equal(approvedNoBy.valid, false);
  const approvedOk = validateContent({
    ...base,
    status: "approved",
    approved_by: "user_1",
    approved_at: 123,
  });
  assert.equal(approvedOk.valid, true);
  // Hook length cap (280 chars).
  assert.equal(
    validateContent({ ...base, hook: "x".repeat(281) }).valid,
    false,
  );
});

// ─── experiments-pure ──────────────────────────────────────────────────────

test("validation/experiments: validateExperiment enforces length bounds for title, hypothesis, metric, kill_rule", () => {
  const ok = {
    title: "A/B test headline",
    hypothesis: "Changing CTA will lift CTR",
    metric: "ctr",
    killRule: "Stop if CTR < 0.5%",
  };
  assert.equal(validateExperiment(ok), null);
  assert.match(
    validateExperiment({ ...ok, title: "" }) ?? "",
    /title/i,
  );
  assert.match(
    validateExperiment({ ...ok, title: "x".repeat(201) }) ?? "",
    /title/i,
  );
  assert.match(
    validateExperiment({ ...ok, hypothesis: "x".repeat(1001) }) ?? "",
    /hypothesis/i,
  );
  assert.match(
    validateExperiment({ ...ok, metric: "x".repeat(201) }) ?? "",
    /metric/i,
  );
  assert.match(
    validateExperiment({ ...ok, killRule: "x".repeat(501) }) ?? "",
    /kill_rule/i,
  );
});

// ─── workspace-settings-pure ───────────────────────────────────────────────

test("validation/workspace-settings: validateBudget, validateQuietHours, validateTimezone invariants", () => {
  // Budget: non-negative, daily ≤ monthly, per_action ≤ daily.
  assert.equal(
    validateBudget({
      monthly_budget_cents: 100_00,
      daily_budget_cents: 50_00,
      per_action_budget_cents: 10_00,
    }).valid,
    true,
  );
  assert.equal(
    validateBudget({
      monthly_budget_cents: -1,
      daily_budget_cents: 0,
      per_action_budget_cents: 0,
    }).valid,
    false,
  );
  assert.equal(
    validateBudget({
      monthly_budget_cents: 10_00,
      daily_budget_cents: 20_00, // > monthly
      per_action_budget_cents: 5_00,
    }).valid,
    false,
  );
  // Quiet hours: 0-23 integers.
  assert.equal(validateQuietHours(22, 8).valid, true);
  assert.equal(validateQuietHours(24, 8).valid, false);
  assert.equal(validateQuietHours(-1, 8).valid, false);
  // Timezone: IANA validation.
  assert.equal(validateTimezone("UTC"), true);
  assert.equal(validateTimezone("America/New_York"), true);
  assert.equal(validateTimezone("not/a/zone"), false);
  assert.equal(validateTimezone(""), false);
});

// ─── organizations-pure ────────────────────────────────────────────────────

test("validation/organizations: validateSlug enforces length, format, and consecutive-hyphen rules", () => {
  assert.equal(validateSlug("acme-corp"), "acme-corp");
  assert.equal(validateSlug("acme"), "acme");
  // Throws on bad inputs.
  assert.throws(() => validateSlug("a"), /length/i); // too short
  assert.throws(() => validateSlug("x".repeat(33)), /length/i); // too long
  assert.throws(() => validateSlug("acme--corp"), /consecutive hyphens/i);
  assert.throws(() => validateSlug("Acme Corp"), /format/i); // uppercase + space
  assert.throws(() => validateSlug("acme_corp"), /format/i); // underscore
});

// ─── cross-module invariant ────────────────────────────────────────────────

test("validation/cross-module: every validator returns a structured ok/error shape (or null for the experiment validator)", () => {
  // validation-pure helpers return { ok, value?, error? }.
  const r1 = validateString("x");
  assert.equal(typeof r1.ok, "boolean");
  assert.equal(typeof r1.error === "undefined" || typeof r1.error === "string", true);
  const r2 = validateNumber(1);
  assert.equal(typeof r2.ok, "boolean");
  // Per-table validators return { valid, errors }.
  const r3 = validateContact({ workspace_id: "ws", source: "manual" });
  assert.equal(typeof r3.valid, "boolean");
  assert.ok(Array.isArray(r3.errors));
  const r4 = validateContent({
    workspace_id: "ws",
    mission_id: "m",
    platform: "p",
    format: "f",
    hook: "h",
    body: "b",
    cta: "c",
  });
  assert.equal(typeof r4.valid, "boolean");
  assert.ok(Array.isArray(r4.errors));
  // Experiment validator returns null on success or a string error.
  assert.equal(
    validateExperiment({
      title: "t",
      hypothesis: "h",
      metric: "m",
      killRule: "k",
    }),
    null,
  );
  assert.equal(
    typeof validateExperiment({
      title: "",
      hypothesis: "h",
      metric: "m",
      killRule: "k",
    }),
    "string",
  );
});

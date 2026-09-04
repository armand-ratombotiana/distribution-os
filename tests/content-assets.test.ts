import assert from "node:assert/strict";
import test from "node:test";

import { CONTENT_STATUSES } from "../db/schema";
import {
  CONTENT_TRANSITIONS,
  buildContentId,
  canTransition,
  isTerminal,
  summarizeForDisplay,
  validateContent,
  type ContentAssetRow,
} from "../db/content-assets-pure";

function baseRow(overrides: Partial<ContentAssetRow> = {}): ContentAssetRow {
  return {
    id: "content_1",
    workspace_id: "ws_1",
    mission_id: "msn_1",
    action_id: null,
    platform: "linkedin",
    format: "post",
    hook: "Ship faster",
    body: "Here is a thoughtful post about distribution.",
    cta: "Reply with your story",
    status: "draft",
    variant_of_id: null,
    approved_by: null,
    approved_at: null,
    scheduled_at: null,
    published_at: null,
    provider_id: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    ...overrides,
  };
}

test("CONTENT_TRANSITIONS covers every CONTENT_STATUSES value", () => {
  for (const status of CONTENT_STATUSES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(CONTENT_TRANSITIONS, status),
      `expected transition entry for ${status}`,
    );
  }
});

test("canTransition allows draft -> in_review", () => {
  assert.equal(canTransition("draft", "in_review"), true);
});

test("canTransition allows scheduled -> failed and failed -> draft recovery", () => {
  assert.equal(canTransition("scheduled", "failed"), true);
  assert.equal(canTransition("failed", "draft"), true);
});

test("canTransition rejects archived -> anything and unknown transitions", () => {
  for (const target of CONTENT_STATUSES) {
    assert.equal(canTransition("archived", target), false);
  }
  assert.equal(canTransition("bogus", "draft"), false);
  assert.equal(canTransition("draft", "bogus"), false);
  assert.equal(canTransition("published", "draft"), false);
});

test("isTerminal returns true only for archived", () => {
  assert.equal(isTerminal("archived"), true);
  for (const status of CONTENT_STATUSES) {
    if (status === "archived") continue;
    assert.equal(isTerminal(status), false);
  }
});

test("isTerminal returns false for unknown status", () => {
  assert.equal(isTerminal("bogus"), false);
});

test("validateContent passes a minimal valid row", () => {
  const result = validateContent(baseRow());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateContent reports missing required fields", () => {
  const result = validateContent({
    ...baseRow(),
    platform: "",
    hook: "",
    body: "",
    cta: "",
    workspace_id: "",
    mission_id: "",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("platform is required"));
  assert.ok(result.errors.includes("hook is required"));
  assert.ok(result.errors.includes("body is required"));
  assert.ok(result.errors.includes("cta is required"));
  assert.ok(result.errors.includes("workspace_id is required"));
  assert.ok(result.errors.includes("mission_id is required"));
});

test("validateContent requires approved_by when status is approved", () => {
  const result = validateContent(baseRow({ status: "approved" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("approved_by")));
});

test("validateContent enforces hook length limit and invalid status", () => {
  const tooLong = validateContent(baseRow({ hook: "x".repeat(281) }));
  assert.equal(tooLong.valid, false);
  assert.ok(tooLong.errors.some((e) => e.includes("hook")));
  const badStatus = validateContent(baseRow({ status: "bogus" }));
  assert.equal(badStatus.valid, false);
  assert.ok(badStatus.errors.some((e) => e.includes("status")));
});

test("summarizeForDisplay truncates long body preview and flags terminal status", () => {
  const longBody = "a".repeat(300);
  const summary = summarizeForDisplay(
    baseRow({ body: longBody, status: "published", published_at: 123 }),
  );
  assert.equal(summary.preview.length, 140);
  assert.ok(summary.preview.endsWith("..."));
  assert.equal(summary.is_terminal, false);
  assert.equal(summary.published_at, 123);
  const archived = summarizeForDisplay(baseRow({ status: "archived" }));
  assert.equal(archived.is_terminal, true);
});

test("buildContentId is unique, prefixed, url-safe and embeds a sanitized seed", () => {
  const a = buildContentId();
  const b = buildContentId();
  assert.ok(a.startsWith("content_"));
  assert.ok(b.startsWith("content_"));
  assert.notEqual(a, b);
  assert.match(a, /^[a-z0-9_]+$/);
  assert.ok(a.length < 80);
  const seeded = buildContentId("Launch Day 2024!!");
  assert.ok(seeded.includes("launch_day_2024"));
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuditEntry,
  filterByCategory,
  filterByTimeRange,
  hashIp,
  parseDetail,
  summarizeForDisplay,
  validateCategory,
  type AuditEventRow,
} from "../db/audit-pure.ts";

const baseRow: AuditEventRow = {
  id: 1,
  workspace_id: "ws_abc",
  actor_user_id: "user_1",
  event_category: "auth",
  event_type: "login",
  action_id: null,
  resource_type: "session",
  resource_id: "sess_1",
  detail_json: JSON.stringify({ ip: "1.2.3.4", method: "password" }),
  ip_hash: "abcdef0123456789",
  created_at: 1_700_000_000_000,
};

test("hashIp returns a deterministic 64-character SHA-256 hex digest", async () => {
  const hash = await hashIp("1.2.3.4");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);

  const again = await hashIp("1.2.3.4");
  assert.equal(hash, again);

  const different = await hashIp("5.6.7.8");
  assert.notEqual(hash, different);
});

test("validateCategory accepts every value from AUDIT_CATEGORIES", () => {
  for (const category of [
    "auth",
    "role",
    "approval",
    "connector",
    "action",
    "payment",
    "export",
    "deletion",
    "security",
    "config",
  ] as const) {
    assert.equal(validateCategory(category), category);
  }
});

test("validateCategory throws on an unknown category", () => {
  assert.throws(() => validateCategory("billing"), /Invalid audit category/);
  assert.throws(() => validateCategory(""), /Invalid audit category/);
});

test("parseDetail reads JSON objects and falls back to empty object", () => {
  assert.deepEqual(parseDetail('{"a":1}'), { a: 1 });
  assert.deepEqual(parseDetail("{}"), {});
  assert.deepEqual(parseDetail(""), {});
  assert.deepEqual(parseDetail(null), {});
  assert.deepEqual(parseDetail("not-json"), {});
  // Arrays and primitives are rejected — only plain objects are returned.
  assert.deepEqual(parseDetail("[1,2,3]"), {});
  assert.deepEqual(parseDetail('"string"'), {});
});

test("buildAuditEntry fills defaults for optional fields and stringifies detail", () => {
  const row = buildAuditEntry({
    workspaceId: "ws_1",
    eventCategory: "approval",
    eventType: "approved",
  });
  assert.equal(row.workspace_id, "ws_1");
  assert.equal(row.event_category, "approval");
  assert.equal(row.event_type, "approved");
  assert.equal(row.actor_user_id, null);
  assert.equal(row.action_id, null);
  assert.equal(row.resource_type, null);
  assert.equal(row.resource_id, null);
  assert.equal(row.detail_json, "{}");
  assert.equal(row.ip_hash, null);
  assert.equal(typeof row.created_at, "number");
});

test("buildAuditEntry stringifies the provided detail object and keeps explicit values", () => {
  const fixedTs = 1_700_000_000_000;
  const row = buildAuditEntry({
    workspaceId: "ws_1",
    actorUserId: "user_42",
    eventCategory: "action",
    eventType: "executed",
    actionId: "act_9",
    resourceType: "payment",
    resourceId: "pay_1",
    detail: { amount_cents: 1999 },
    ipHash: "deadbeef",
    createdAt: fixedTs,
  });
  assert.equal(row.actor_user_id, "user_42");
  assert.equal(row.action_id, "act_9");
  assert.equal(row.detail_json, '{"amount_cents":1999}');
  assert.equal(row.ip_hash, "deadbeef");
  assert.equal(row.created_at, fixedTs);
});

test("summarizeForDisplay redacts ip_hash but keeps actor_user_id", () => {
  const summary = summarizeForDisplay(baseRow);
  assert.equal("ip_hash" in summary, false);
  assert.equal(summary.actor_user_id, "user_1");
  assert.equal(summary.event_category, "auth");
  assert.equal(summary.workspace_id, "ws_abc");
});

test("filterByCategory returns only rows matching the requested category", () => {
  const rows: AuditEventRow[] = [
    { ...baseRow, id: 1, event_category: "auth", event_type: "login" },
    { ...baseRow, id: 2, event_category: "approval", event_type: "approved" },
    { ...baseRow, id: 3, event_category: "auth", event_type: "logout" },
    { ...baseRow, id: 4, event_category: "payment", event_type: "succeeded" },
  ];
  const authRows = filterByCategory(rows, "auth");
  assert.equal(authRows.length, 2);
  assert.deepEqual(
    authRows.map((r) => r.id),
    [1, 3],
  );

  const empty = filterByCategory(rows, "deletion");
  assert.equal(empty.length, 0);
});

test("filterByTimeRange returns rows whose created_at is inside the inclusive window", () => {
  const rows: AuditEventRow[] = [
    { ...baseRow, id: 1, created_at: 1_000 },
    { ...baseRow, id: 2, created_at: 2_000 },
    { ...baseRow, id: 3, created_at: 3_000 },
    { ...baseRow, id: 4, created_at: 4_000 },
  ];
  const result = filterByTimeRange(rows, 2_000, 3_000);
  assert.deepEqual(
    result.map((r) => r.id),
    [2, 3],
  );
});

test("filterByTimeRange returns an empty array for an inverted or non-finite window", () => {
  const rows: AuditEventRow[] = [
    { ...baseRow, id: 1, created_at: 1_000 },
    { ...baseRow, id: 2, created_at: 2_000 },
  ];
  assert.deepEqual(filterByTimeRange(rows, 3_000, 1_000), []);
  assert.deepEqual(filterByTimeRange(rows, Number.NaN, 1_000), []);
  assert.deepEqual(filterByTimeRange(rows, 1_000, Number.POSITIVE_INFINITY), []);
});

test("buildAuditEntry rejects an unknown event category", () => {
  assert.throws(
    () =>
      buildAuditEntry({
        workspaceId: "ws_1",
        // @ts-expect-error — intentionally invalid input
        eventCategory: "billing",
        eventType: "x",
      }),
    /Invalid audit category/,
  );
});

test("AuditEventRow shape round-trips through summarize and parse helpers", () => {
  const summary = summarizeForDisplay(baseRow);
  const detail = parseDetail(summary.detail_json);
  assert.deepEqual(detail, { ip: "1.2.3.4", method: "password" });
  assert.equal(summary.created_at, baseRow.created_at);
});

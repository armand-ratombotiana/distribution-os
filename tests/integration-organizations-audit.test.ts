import assert from "node:assert/strict";
import test from "node:test";

// Integration: organization roles ↔ audit logging
//
// Every privileged org action (invite, role change, role removal) is gated by
// `canManageRole` / `canInviteRole` and must be recorded as an audit event
// whose category is one of `AUDIT_CATEGORIES`. These tests exercise the
// permission checks alongside the audit pipeline that records them.

import {
  ROLE_HIERARCHY,
  buildInvitationToken,
  canInviteRole,
  canManageRole,
  hashToken,
  isInvitationAccepted,
  isInvitationExpired,
  normalizeSlug,
  summarizeInvitationForDisplay,
  summarizeMembershipForDisplay,
  summarizeOrgForDisplay,
  validateSlug,
  type OrganizationInvitationRow,
  type OrganizationMembershipRow,
  type OrganizationRow,
} from "../db/organizations-pure";

import {
  buildAuditEntry,
  filterByCategory,
  filterByTimeRange,
  hashIp,
  parseDetail,
  summarizeForDisplay as summarizeAudit,
  validateCategory,
  type AuditEventRow,
} from "../db/audit-pure";

import { AUDIT_CATEGORIES, ORG_ROLES } from "../db/schema";

const baseOrg: OrganizationRow = {
  id: "org_1",
  name: "Acme Inc.",
  slug: "acme",
  created_at: 1_000,
  updated_at: 1_000,
};

const baseMembership: OrganizationMembershipRow = {
  id: "mem_1",
  organization_id: "org_1",
  user_id: "user_42",
  role: "member",
  created_at: 1_000,
  updated_at: 1_000,
};

const baseInvitation: OrganizationInvitationRow = {
  id: "inv_1",
  organization_id: "org_1",
  email: "invitee@example.com",
  role: "member",
  token_hash: "deadbeefcafe",
  expires_at: 2_000,
  accepted_at: null,
  created_at: 1_000,
};

const baseAuditRow: AuditEventRow = {
  id: 1,
  workspace_id: "ws_1",
  actor_user_id: "user_42",
  event_category: "auth",
  event_type: "login",
  action_id: null,
  resource_type: "session",
  resource_id: "sess_1",
  detail_json: JSON.stringify({ ip: "1.2.3.4", method: "password" }),
  ip_hash: "abcdef0123456789",
  created_at: 1_700_000_000_000,
};

test("canManageRole(owner, admin) returns true AND buildAuditEntry with category 'role' validates", () => {
  assert.equal(canManageRole("owner", "admin"), true);
  assert.equal(canManageRole("owner", "member"), true);
  assert.equal(canManageRole("owner", "viewer"), true);
  const entry = buildAuditEntry({
    workspaceId: "ws_1",
    eventCategory: "role",
    eventType: "member.promoted",
    actorUserId: "user_owner",
    detail: { from: "member", to: "admin" },
  });
  assert.equal(entry.event_category, "role");
  assert.equal(entry.event_type, "member.promoted");
  assert.equal(entry.actor_user_id, "user_owner");
});

test("canInviteRole(viewer, member) returns false AND buildAuditEntry with category 'auth' is allowed", () => {
  assert.equal(canInviteRole("viewer", "member"), false);
  assert.equal(canInviteRole("viewer", "viewer"), false);
  const entry = buildAuditEntry({
    workspaceId: "ws_1",
    eventCategory: "auth",
    eventType: "login",
  });
  assert.equal(entry.event_category, "auth");
  assert.equal(entry.event_type, "login");
});

test("ROLE_HIERARCHY exposes the documented ordering AND AUDIT_CATEGORIES has 10 entries", () => {
  assert.equal(ROLE_HIERARCHY.owner, 4);
  assert.equal(ROLE_HIERARCHY.admin, 3);
  assert.equal(ROLE_HIERARCHY.member, 2);
  assert.equal(ROLE_HIERARCHY.viewer, 1);
  assert.ok(ROLE_HIERARCHY.owner > ROLE_HIERARCHY.admin);
  assert.ok(ROLE_HIERARCHY.admin > ROLE_HIERARCHY.member);
  assert.ok(ROLE_HIERARCHY.member > ROLE_HIERARCHY.viewer);

  assert.equal(AUDIT_CATEGORIES.length, 10);
  assert.deepEqual(
    [...AUDIT_CATEGORIES].sort(),
    [
      "action",
      "approval",
      "auth",
      "config",
      "connector",
      "deletion",
      "export",
      "payment",
      "role",
      "security",
    ],
  );
  assert.equal(ORG_ROLES.length, 4);
});

test("validateSlug throws on 'acme--inc' AND buildAuditEntry rejects unknown category 'billing'", () => {
  assert.throws(() => validateSlug("acme--inc"), /Invalid organization slug/);
  assert.throws(() => validateSlug("a"), /Invalid organization slug/);
  assert.throws(() => validateSlug("UPPER"), /Invalid organization slug/);

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

test("canManageRole(admin, owner) returns false AND audit filterByCategory returns matching rows", () => {
  assert.equal(canManageRole("admin", "owner"), false);
  assert.equal(canManageRole("member", "admin"), false);
  assert.equal(canManageRole("viewer", "viewer"), false);

  const rows: AuditEventRow[] = [
    { ...baseAuditRow, id: 1, event_category: "auth", event_type: "login" },
    { ...baseAuditRow, id: 2, event_category: "role", event_type: "promoted" },
    { ...baseAuditRow, id: 3, event_category: "auth", event_type: "logout" },
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

test("canInviteRole(owner, owner) returns true AND filterByTimeRange returns rows in window", () => {
  // Owners are the only role that can invite additional owners.
  for (const role of ["owner", "admin", "member", "viewer"] as const) {
    assert.equal(canInviteRole("owner", role), true);
  }

  const rows: AuditEventRow[] = [
    { ...baseAuditRow, id: 1, created_at: 1_000 },
    { ...baseAuditRow, id: 2, created_at: 2_000 },
    { ...baseAuditRow, id: 3, created_at: 3_000 },
    { ...baseAuditRow, id: 4, created_at: 4_000 },
  ];
  const result = filterByTimeRange(rows, 2_000, 3_000);
  assert.deepEqual(
    result.map((r) => r.id),
    [2, 3],
  );
});

test("isInvitationExpired returns true past expiry AND summarizeForDisplay(audit) redacts ip_hash", () => {
  assert.equal(isInvitationExpired(1_000, 999), false);
  assert.equal(isInvitationExpired(1_000, 1_000), true);
  assert.equal(isInvitationExpired(1_000, 2_000), true);
  // Non-finite timestamps are treated as expired for safety.
  assert.equal(isInvitationExpired(Number.NaN, 1_000), true);

  const summary = summarizeAudit(baseAuditRow);
  assert.equal("ip_hash" in summary, false);
  assert.equal(summary.actor_user_id, "user_42");
  assert.equal(summary.event_category, "auth");
  assert.equal(summary.workspace_id, "ws_1");
});

test("hashToken returns a 64-char hex digest AND hashIp returns a 64-char hex digest (parallel hashing primitives)", async () => {
  const tokenHash = await hashToken("inv_abc123");
  assert.equal(tokenHash.length, 64);
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
  const again = await hashToken("inv_abc123");
  assert.equal(tokenHash, again);
  assert.notEqual(await hashToken("inv_other"), tokenHash);

  const ipHash = await hashIp("1.2.3.4");
  assert.equal(ipHash.length, 64);
  assert.match(ipHash, /^[0-9a-f]{64}$/);
  const ipAgain = await hashIp("1.2.3.4");
  assert.equal(ipHash, ipAgain);
  assert.notEqual(await hashIp("5.6.7.8"), ipHash);
});

test("summarizeInvitationForDisplay redacts token_hash AND summarizeForDisplay(audit) preserves actor_user_id", () => {
  const invitationSummary = summarizeInvitationForDisplay(baseInvitation);
  assert.equal("token_hash" in invitationSummary, false);
  assert.equal(invitationSummary.email, "invitee@example.com");
  assert.equal(invitationSummary.role, "member");
  assert.equal(invitationSummary.organization_id, "org_1");
  assert.equal(invitationSummary.expires_at, 2_000);
  assert.equal(invitationSummary.accepted_at, null);

  const auditSummary = summarizeAudit(baseAuditRow);
  assert.equal("ip_hash" in auditSummary, false);
  assert.equal(auditSummary.actor_user_id, "user_42");
});

test("normalizeSlug collapses non-alphanumeric AND parseDetail returns object for valid JSON", () => {
  assert.equal(normalizeSlug("Acme Inc."), "acme-inc");
  assert.equal(normalizeSlug("  Hello   World  "), "hello-world");
  assert.equal(normalizeSlug("foo_bar.baz"), "foo-bar-baz");
  assert.equal(normalizeSlug("---leading-trailing---"), "leading-trailing");
  assert.equal(normalizeSlug(""), "");

  assert.deepEqual(parseDetail('{"a":1}'), { a: 1 });
  assert.deepEqual(parseDetail("{}"), {});
  assert.deepEqual(parseDetail("not-json"), {});
  assert.deepEqual(parseDetail(null), {});
  assert.deepEqual(parseDetail("[1,2,3]"), {});
});

test("canManageRole(viewer, viewer) returns false (same level) AND filterByTimeRange returns empty for inverted window", () => {
  assert.equal(canManageRole("viewer", "viewer"), false);
  assert.equal(canManageRole("admin", "admin"), false);
  assert.equal(canManageRole("owner", "owner"), false);

  const rows: AuditEventRow[] = [
    { ...baseAuditRow, id: 1, created_at: 1_000 },
    { ...baseAuditRow, id: 2, created_at: 2_000 },
  ];
  assert.deepEqual(filterByTimeRange(rows, 3_000, 1_000), []);
  assert.deepEqual(filterByTimeRange(rows, Number.NaN, 1_000), []);
});

test("isInvitationAccepted detects accepted invitations AND parseDetail falls back to {} for invalid JSON", () => {
  assert.equal(isInvitationAccepted(null), false);
  assert.equal(isInvitationAccepted(undefined), false);
  assert.equal(isInvitationAccepted(1_000), true);
  assert.equal(isInvitationAccepted(Number.NaN), false);

  assert.deepEqual(parseDetail('"string"'), {});
  assert.deepEqual(parseDetail("42"), {});
  assert.deepEqual(parseDetail(""), {});
});

test("validateSlug accepts 'my-cool-org' AND buildAuditEntry stringifies the detail object", () => {
  assert.equal(validateSlug("my-cool-org"), "my-cool-org");
  assert.equal(validateSlug("acme"), "acme");
  assert.equal(validateSlug("  acme  "), "acme");
  assert.equal(validateSlug(normalizeSlug("Acme Inc.")), "acme-inc");

  const entry = buildAuditEntry({
    workspaceId: "ws_1",
    eventCategory: "action",
    eventType: "executed",
    detail: { amount_cents: 1999, action_id: "act_9" },
    createdAt: 1_700_000_000_000,
  });
  assert.equal(entry.detail_json, '{"amount_cents":1999,"action_id":"act_9"}');
  assert.equal(entry.created_at, 1_700_000_000_000);
});

test("canInviteRole(member, admin) returns false (cannot invite higher) AND validateCategory throws on unknown", () => {
  assert.equal(canInviteRole("member", "admin"), false);
  assert.equal(canInviteRole("member", "owner"), false);
  assert.equal(canInviteRole("admin", "owner"), false);
  // Same-or-lower invites are permitted for non-viewers.
  assert.equal(canInviteRole("admin", "admin"), true);
  assert.equal(canInviteRole("admin", "viewer"), true);
  assert.equal(canInviteRole("member", "member"), true);

  assert.throws(() => validateCategory("billing"), /Invalid audit category/);
  assert.throws(() => validateCategory(""), /Invalid audit category/);
  for (const c of AUDIT_CATEGORIES) {
    assert.equal(validateCategory(c), c);
  }
});

test("summarizeOrgForDisplay and summarizeMembershipForDisplay expose stable, minimal shapes", () => {
  const orgSummary = summarizeOrgForDisplay(baseOrg);
  assert.deepEqual(orgSummary, {
    id: "org_1",
    name: "Acme Inc.",
    slug: "acme",
    created_at: 1_000,
    updated_at: 1_000,
  });

  const memSummary = summarizeMembershipForDisplay(baseMembership);
  assert.equal(memSummary.user_id, "user_42");
  assert.equal(memSummary.organization_id, "org_1");
  assert.equal(memSummary.role, "member");
  // user_id is intentionally preserved so the UI can render the member.
  assert.ok(Object.keys(memSummary).includes("user_id"));

  // buildInvitationToken emits a prefixed unique token
  const a = buildInvitationToken();
  const b = buildInvitationToken();
  assert.ok(a.startsWith("inv_"));
  assert.ok(a.length > "inv_".length);
  assert.notEqual(a, b);
});

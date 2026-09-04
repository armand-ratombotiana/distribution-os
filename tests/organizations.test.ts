import assert from "node:assert/strict";
import test from "node:test";

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
} from "../db/organizations-pure.ts";

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

test("ROLE_HIERARCHY exposes the documented rank ordering", () => {
  assert.equal(ROLE_HIERARCHY.owner, 4);
  assert.equal(ROLE_HIERARCHY.admin, 3);
  assert.equal(ROLE_HIERARCHY.member, 2);
  assert.equal(ROLE_HIERARCHY.viewer, 1);
  assert.ok(ROLE_HIERARCHY.owner > ROLE_HIERARCHY.admin);
  assert.ok(ROLE_HIERARCHY.admin > ROLE_HIERARCHY.member);
  assert.ok(ROLE_HIERARCHY.member > ROLE_HIERARCHY.viewer);
});

test("canManageRole allows strictly higher roles to manage lower ones", () => {
  assert.equal(canManageRole("owner", "admin"), true);
  assert.equal(canManageRole("owner", "member"), true);
  assert.equal(canManageRole("owner", "viewer"), true);
  assert.equal(canManageRole("admin", "member"), true);
  assert.equal(canManageRole("admin", "viewer"), true);
  assert.equal(canManageRole("member", "viewer"), true);
});

test("canManageRole rejects same-level or higher targets", () => {
  assert.equal(canManageRole("admin", "owner"), false);
  assert.equal(canManageRole("member", "admin"), false);
  assert.equal(canManageRole("viewer", "viewer"), false);
  assert.equal(canManageRole("owner", "owner"), false);
  assert.equal(canManageRole("admin", "admin"), false);
});

test("canInviteRole allows owners to invite to any role including owners", () => {
  for (const role of ["owner", "admin", "member", "viewer"] as const) {
    assert.equal(canInviteRole("owner", role), true);
  }
});

test("canInviteRole forbids viewers from inviting anyone", () => {
  for (const role of ["owner", "admin", "member", "viewer"] as const) {
    assert.equal(canInviteRole("viewer", role), false);
  }
});

test("canInviteRole forbids inviting to a higher role than the actor holds", () => {
  assert.equal(canInviteRole("admin", "owner"), false);
  assert.equal(canInviteRole("member", "owner"), false);
  assert.equal(canInviteRole("member", "admin"), false);
  // Same-or-lower invites are permitted for non-viewers.
  assert.equal(canInviteRole("admin", "admin"), true);
  assert.equal(canInviteRole("member", "member"), true);
  assert.equal(canInviteRole("admin", "viewer"), true);
});

test("normalizeSlug lowercases input and collapses non-alphanumeric runs to hyphens", () => {
  assert.equal(normalizeSlug("Acme Inc."), "acme-inc");
  assert.equal(normalizeSlug("  Hello   World  "), "hello-world");
  assert.equal(normalizeSlug("foo_bar.baz"), "foo-bar-baz");
  assert.equal(normalizeSlug("---leading-trailing---"), "leading-trailing");
  assert.equal(normalizeSlug("UPPER"), "upper");
  assert.equal(normalizeSlug(""), "");
});

test("validateSlug accepts already-normalized slugs and trims surrounding whitespace", () => {
  assert.equal(validateSlug("acme"), "acme");
  assert.equal(validateSlug("my-cool-org"), "my-cool-org");
  assert.equal(validateSlug("ab"), "ab");
  assert.equal(validateSlug("a".repeat(32)), "a".repeat(32));
  // Whitespace is trimmed before validation.
  assert.equal(validateSlug("  acme  "), "acme");
  // normalizeSlug + validateSlug round-trips messy user input.
  assert.equal(validateSlug(normalizeSlug("Acme Inc.")), "acme-inc");
});

test("validateSlug rejects empty, too-short, too-long, malformed and double-hyphen slugs", () => {
  assert.throws(() => validateSlug(""), /Invalid organization slug/);
  assert.throws(() => validateSlug("   "), /Invalid organization slug/);
  assert.throws(() => validateSlug("a"), /Invalid organization slug/);
  assert.throws(() => validateSlug("a".repeat(33)), /Invalid organization slug/);
  assert.throws(() => validateSlug("-acme"), /Invalid organization slug/);
  assert.throws(() => validateSlug("acme-"), /Invalid organization slug/);
  assert.throws(() => validateSlug("acme--inc"), /Invalid organization slug/);
  assert.throws(() => validateSlug("Acme Inc."), /Invalid organization slug/);
  assert.throws(() => validateSlug("acme_inc"), /Invalid organization slug/);
  assert.throws(() => validateSlug("UPPER"), /Invalid organization slug/);
});

test("isInvitationExpired returns true past the expiry timestamp and false before", () => {
  assert.equal(isInvitationExpired(1_000, 999), false);
  assert.equal(isInvitationExpired(1_000, 1_000), true);
  assert.equal(isInvitationExpired(1_000, 2_000), true);
  // Non-finite timestamps are treated as expired for safety.
  assert.equal(isInvitationExpired(Number.NaN, 1_000), true);
  assert.equal(isInvitationExpired(1_000, Number.NaN), true);
});

test("isInvitationAccepted detects accepted vs pending invitations", () => {
  assert.equal(isInvitationAccepted(null), false);
  assert.equal(isInvitationAccepted(undefined), false);
  assert.equal(isInvitationAccepted(1_000), true);
  assert.equal(isInvitationAccepted(Number.NaN), false);
});

test("buildInvitationToken emits unique prefixed tokens", () => {
  const a = buildInvitationToken();
  const b = buildInvitationToken();
  assert.equal(typeof a, "string");
  assert.equal(a.startsWith("inv_"), true);
  assert.ok(a.length > "inv_".length);
  assert.notEqual(a, b);
});

test("hashToken returns a deterministic 64-character SHA-256 hex digest", async () => {
  const hash = await hashToken("inv_abc123");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  const again = await hashToken("inv_abc123");
  assert.equal(hash, again);
  const different = await hashToken("inv_other");
  assert.notEqual(hash, different);
});

test("summarizeForDisplay helpers redact token_hash while preserving user_id and other public fields", () => {
  const orgSummary = summarizeOrgForDisplay(baseOrg);
  assert.deepEqual(orgSummary, {
    id: "org_1",
    name: "Acme Inc.",
    slug: "acme",
    created_at: 1_000,
    updated_at: 1_000,
  });

  const membershipSummary = summarizeMembershipForDisplay(baseMembership);
  // user_id is intentionally preserved so the UI can render the member.
  assert.equal(membershipSummary.user_id, "user_42");
  assert.equal(membershipSummary.organization_id, "org_1");
  assert.equal(membershipSummary.role, "member");
  assert.deepEqual(
    Object.keys(membershipSummary).sort(),
    ["created_at", "id", "organization_id", "role", "updated_at", "user_id"],
  );

  const invitationSummary = summarizeInvitationForDisplay(baseInvitation);
  assert.equal("token_hash" in invitationSummary, false);
  assert.equal(invitationSummary.email, "invitee@example.com");
  assert.equal(invitationSummary.role, "member");
  assert.equal(invitationSummary.organization_id, "org_1");
  assert.equal(invitationSummary.expires_at, 2_000);
  assert.equal(invitationSummary.accepted_at, null);
});

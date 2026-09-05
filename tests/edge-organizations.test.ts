/**
 * Edge-case tests for the organizations pure logic (db/organizations-pure.ts).
 *
 * Each test exercises a boundary: empty name, very long slug, duplicate slug,
 * role hierarchy edge cases, invitation expiry boundary, etc.
 *
 * Run:  npx tsx --test tests/edge-organizations.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
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

function baseOrg(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    id: "org_1",
    name: "Acme Inc.",
    slug: "acme",
    created_at: 1_000,
    updated_at: 1_000,
    ...overrides,
  };
}

function baseMembership(overrides: Partial<OrganizationMembershipRow> = {}): OrganizationMembershipRow {
  return {
    id: "mem_1",
    organization_id: "org_1",
    user_id: "user_42",
    role: "member",
    created_at: 1_000,
    updated_at: 1_000,
    ...overrides,
  };
}

function baseInvitation(overrides: Partial<OrganizationInvitationRow> = {}): OrganizationInvitationRow {
  return {
    id: "inv_1",
    organization_id: "org_1",
    email: "invitee@example.com",
    role: "member",
    token_hash: "deadbeefcafe",
    expires_at: 2_000,
    accepted_at: null,
    created_at: 1_000,
    ...overrides,
  };
}

test("edge: summarizeOrgForDisplay accepts an empty name (no validation in pure layer)", () => {
  // The pure helper does not validate name; it round-trips whatever is set.
  const summary = summarizeOrgForDisplay(baseOrg({ name: "" }));
  assert.equal(summary.name, "");
  assert.equal(summary.slug, "acme");
  assert.equal(summary.id, "org_1");
});

test("edge: validateSlug rejects an empty slug with a length error", () => {
  assert.throws(() => validateSlug(""), /Invalid organization slug/);
  assert.throws(() => validateSlug("   "), /Invalid organization slug/);
});

test("edge: validateSlug accepts the minimum-length slug (2 chars) and rejects 1 char", () => {
  assert.equal(validateSlug("ab"), "ab");
  assert.throws(() => validateSlug("a"), /Invalid organization slug/);
});

test("edge: validateSlug accepts the maximum-length slug (32 chars) and rejects 33 chars", () => {
  assert.equal(validateSlug("a".repeat(32)), "a".repeat(32));
  assert.throws(() => validateSlug("a".repeat(33)), /Invalid organization slug/);
});

test("edge: normalizeSlug collapses a very long user-provided name to a 1000-char slug", () => {
  // The normaliser does NOT truncate — it slugifies the whole input. The
  // caller is responsible for length-checking after normalisation.
  const long = "Acme".repeat(500); // 2000 chars
  const slug = normalizeSlug(long);
  assert.equal(slug, "acme".repeat(500));
  assert.equal(slug.length, 2000);
  // And such a slug would be rejected by validateSlug (length > 32).
  assert.throws(() => validateSlug(slug), /Invalid organization slug/);
});

test("edge: duplicate slug detection is NOT in the pure layer (caller's responsibility)", () => {
  // The pure module has no DB access. Two orgs with the same slug both pass
  // summarizeOrgForDisplay without complaint.
  const a = summarizeOrgForDisplay(baseOrg({ slug: "dup" }));
  const b = summarizeOrgForDisplay(baseOrg({ id: "org_2", slug: "dup" }));
  assert.equal(a.slug, "dup");
  assert.equal(b.slug, "dup");
  assert.notEqual(a.id, b.id);
});

test("edge: canManageRole rejects unknown roles and accepts only strictly-higher roles", () => {
  // Unknown roles return false.
  // @ts-expect-error — passing an unknown role.
  assert.equal(canManageRole("owner", "superadmin"), false);
  // @ts-expect-error — passing an unknown role.
  assert.equal(canManageRole("superadmin", "viewer"), false);
  // Same-level management is forbidden (admin cannot manage admin).
  assert.equal(canManageRole("admin", "admin"), false);
  assert.equal(canManageRole("owner", "owner"), false);
  // Strictly-higher is allowed.
  assert.equal(canManageRole("owner", "admin"), true);
  assert.equal(canManageRole("admin", "member"), true);
});

test("edge: canInviteRole lets admins invite viewers but not owners; owners can invite anyone", () => {
  // Admin can invite same-level or lower (admin, member, viewer) — not owner.
  assert.equal(canInviteRole("admin", "admin"), true);
  assert.equal(canInviteRole("admin", "member"), true);
  assert.equal(canInviteRole("admin", "viewer"), true);
  assert.equal(canInviteRole("admin", "owner"), false);
  // Viewer cannot invite anyone, including other viewers.
  assert.equal(canInviteRole("viewer", "viewer"), false);
  assert.equal(canInviteRole("viewer", "member"), false);
  assert.equal(canInviteRole("viewer", "owner"), false);
  // Owner can invite to every role (including owner).
  for (const role of ["owner", "admin", "member", "viewer"] as const) {
    assert.equal(canInviteRole("owner", role), true);
  }
});

test("edge: isInvitationExpired is true exactly when now >= expires_at (boundary)", () => {
  // Just before expiry.
  assert.equal(isInvitationExpired(2_000, 1_999), false);
  // Exactly at expiry.
  assert.equal(isInvitationExpired(2_000, 2_000), true);
  // One ms after expiry.
  assert.equal(isInvitationExpired(2_000, 2_001), true);
});

test("edge: isInvitationExpired treats NaN expiry or NaN now as expired (defensive)", () => {
  assert.equal(isInvitationExpired(Number.NaN, 1_000), true);
  assert.equal(isInvitationExpired(1_000, Number.NaN), true);
  // Non-finite values on either side are treated as expired for safety.
  // Infinity is not finite, so the function short-circuits and returns true.
  assert.equal(isInvitationExpired(Number.POSITIVE_INFINITY, 1_000), true);
  assert.equal(isInvitationExpired(1_000, Number.POSITIVE_INFINITY), true);
});

test("edge: isInvitationAccepted distinguishes null, undefined, NaN and finite timestamps", () => {
  assert.equal(isInvitationAccepted(null), false);
  assert.equal(isInvitationAccepted(undefined), false);
  assert.equal(isInvitationAccepted(Number.NaN), false);
  assert.equal(isInvitationAccepted(0), true); // 0 is a finite timestamp
  assert.equal(isInvitationAccepted(1_000), true);
  assert.equal(isInvitationAccepted(Number.POSITIVE_INFINITY), false);
});

test("edge: buildInvitationToken is unique across 50 rapid successive calls", () => {
  const tokens = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const t = buildInvitationToken();
    assert.ok(t.startsWith("inv_"));
    // No hyphens (the impl strips them with .replace(/-/g, "")).
    assert.ok(!t.includes("-"));
    tokens.add(t);
  }
  assert.equal(tokens.size, 50);
});

test("edge: hashToken is deterministic for the same input and differs across inputs", async () => {
  const a = await hashToken("inv_abc");
  const b = await hashToken("inv_abc");
  const c = await hashToken("inv_xyz");
  assert.equal(a, b);
  assert.notEqual(a, c);
  // Length and format invariants.
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("edge: summarizeInvitationForDisplay strips token_hash but keeps all other fields", () => {
  const inv = baseInvitation({
    email: "founder@example.com",
    role: "admin",
    expires_at: 5_000,
    accepted_at: 4_000,
  });
  const summary = summarizeInvitationForDisplay(inv);
  // token_hash is the only field that must be redacted.
  assert.equal("token_hash" in summary, false);
  // Everything else round-trips.
  assert.equal(summary.id, "inv_1");
  assert.equal(summary.organization_id, "org_1");
  assert.equal(summary.email, "founder@example.com");
  assert.equal(summary.role, "admin");
  assert.equal(summary.expires_at, 5_000);
  assert.equal(summary.accepted_at, 4_000);
  assert.equal(summary.created_at, 1_000);
  // The key set is exactly the documented projection.
  assert.deepEqual(
    Object.keys(summary).sort(),
    ["accepted_at", "created_at", "email", "expires_at", "id", "organization_id", "role"],
  );
});

test("edge: summarizeMembershipForDisplay preserves user_id and role regardless of role value", () => {
  for (const role of ["owner", "admin", "member", "viewer"] as const) {
    const summary = summarizeMembershipForDisplay(baseMembership({ role }));
    assert.equal(summary.role, role);
    assert.equal(summary.user_id, "user_42");
    assert.equal(summary.organization_id, "org_1");
  }
});

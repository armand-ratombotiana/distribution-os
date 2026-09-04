/**
 * D1 persistence layer for the `organizations`, `organization_memberships` and
 * `organization_invitations` tables.
 *
 * Tenant isolation: the workspace id IS the organization id — every workspace
 * has exactly one organization whose `id` equals the workspace id. This keeps
 * membership and invitation lookups scoped to a single tenant without
 * requiring a redundant `workspace_id` column on these tables.
 *
 * Delegates slug validation, role hierarchy and token hashing to
 * `./organizations-pure`. IDs use `crypto.randomUUID()` and timestamps use
 * `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildInvitationToken,
  hashToken,
  isInvitationAccepted,
  isInvitationExpired,
  normalizeSlug,
  validateSlug,
  type OrganizationInvitationRow,
  type OrganizationMembershipRow,
  type OrganizationRow,
  type OrgRole,
} from "./organizations-pure";

export * from "./organizations-pure";

export type CreateOrganizationInput = {
  name: string;
  slug?: string;
};

export type CreateInvitationInput = {
  email: string;
  role?: OrgRole;
  expires_at: number;
};

export type CreateInvitationResult = {
  invitation: OrganizationInvitationRow;
  /** The raw invitation token. Returned once so the caller can include it in the invitation email. */
  token: string;
};

export type AcceptInvitationResult = {
  invitation: OrganizationInvitationRow;
  membership: OrganizationMembershipRow;
};

function isOrgRole(value: unknown): value is OrgRole {
  return (
    typeof value === "string" &&
    ["owner", "admin", "member", "viewer"].includes(value)
  );
}

/**
 * Create the organization that backs a workspace. The workspace id is used as
 * the organization id (1:1 mapping). The slug is normalised and validated by
 * the pure helpers. If a slug is not provided it is derived from the name.
 */
export async function createOrganization(
  workspaceId: string,
  input: CreateOrganizationInput,
): Promise<OrganizationRow> {
  const db = getRawDb();
  const now = Date.now();
  const slug = validateSlug(input.slug ?? normalizeSlug(input.name));
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) {
    throw new Error("Organization name must be 1-200 characters");
  }

  await db
    .prepare(
      "INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug, updated_at = excluded.updated_at",
    )
    .bind(workspaceId, name, slug, now, now)
    .run();

  const row = await getOrganization(workspaceId);
  if (!row) {
    throw new Error("Failed to create organization");
  }
  return row;
}

/** Fetch the organization that backs a workspace. */
export async function getOrganization(
  workspaceId: string,
): Promise<OrganizationRow | null> {
  const db = getRawDb();
  return db
    .prepare("SELECT * FROM organizations WHERE id = ? LIMIT 1")
    .bind(workspaceId)
    .first<OrganizationRow>();
}

export type UpdateOrganizationInput = {
  name?: string;
  slug?: string;
};

/**
 * Partial update for the organization that backs a workspace. Only the
 * provided fields are written; the slug (when supplied) is normalised and
 * validated by the pure helpers. Throws when the organisation does not exist
 * or when the slug is malformed.
 */
export async function updateOrganization(
  workspaceId: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationRow> {
  const current = await getOrganization(workspaceId);
  if (!current) {
    throw new Error(`Organization not found: ${workspaceId}`);
  }
  const nextName =
    typeof input.name === "string" ? input.name.trim() : current.name;
  if (nextName.length < 1 || nextName.length > 200) {
    throw new Error("Organization name must be 1-200 characters");
  }
  const nextSlug =
    typeof input.slug === "string"
      ? validateSlug(normalizeSlug(input.slug))
      : current.slug;

  const db = getRawDb();
  const now = Date.now();
  await db
    .prepare(
      "UPDATE organizations SET name = ?, slug = ?, updated_at = ? WHERE id = ?",
    )
    .bind(nextName, nextSlug, now, workspaceId)
    .run();

  const updated = await getOrganization(workspaceId);
  if (!updated) {
    throw new Error("Organization disappeared after update");
  }
  return updated;
}

/**
 * Add a membership to the workspace's organization. If a membership for the
 * user already exists, the role is updated instead of duplicated.
 */
export async function addMembership(
  workspaceId: string,
  userId: string,
  role: OrgRole,
): Promise<OrganizationMembershipRow> {
  if (!isOrgRole(role)) {
    throw new Error(`Invalid organization role: ${String(role)}`);
  }
  const db = getRawDb();
  const existing = await getMembership(workspaceId, userId);
  const now = Date.now();
  if (existing) {
    await db
      .prepare(
        "UPDATE organization_memberships SET role = ?, updated_at = ? WHERE organization_id = ? AND user_id = ?",
      )
      .bind(role, now, workspaceId, userId)
      .run();
    const updated = await getMembership(workspaceId, userId);
    if (!updated) {
      throw new Error("Failed to update organization membership");
    }
    return updated;
  }
  const id = `mem_${crypto.randomUUID()}`;
  await db
    .prepare(
      "INSERT INTO organization_memberships (id, organization_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, workspaceId, userId, role, now, now)
    .run();
  const row = await getMembership(workspaceId, userId);
  if (!row) {
    throw new Error("Failed to add organization membership");
  }
  return row;
}

/** List every membership of the workspace's organization. */
export async function listMemberships(
  workspaceId: string,
): Promise<OrganizationMembershipRow[]> {
  const db = getRawDb();
  const result = await db
    .prepare(
      "SELECT * FROM organization_memberships WHERE organization_id = ? ORDER BY created_at ASC",
    )
    .bind(workspaceId)
    .all<OrganizationMembershipRow>();
  return result.results;
}

/** Fetch a single membership by user id within the workspace's organization. */
export async function getMembership(
  workspaceId: string,
  userId: string,
): Promise<OrganizationMembershipRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM organization_memberships WHERE organization_id = ? AND user_id = ? LIMIT 1",
    )
    .bind(workspaceId, userId)
    .first<OrganizationMembershipRow>();
}

/**
 * Create an invitation for the workspace's organization. Returns the raw
 * invitation token once (in `CreateInvitationResult.token`) so the caller can
 * email it; only the SHA-256 hash is persisted.
 */
export async function createInvitation(
  workspaceId: string,
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  if (!isOrgRole(input.role ?? "member")) {
    throw new Error(`Invalid organization role: ${String(input.role)}`);
  }
  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required to create an invitation");
  }
  const role: OrgRole = input.role ?? "member";
  const db = getRawDb();
  const now = Date.now();
  const token = buildInvitationToken();
  const tokenHash = await hashToken(token);
  const id = `inv_${crypto.randomUUID()}`;

  await db
    .prepare(
      "INSERT INTO organization_invitations (id, organization_id, email, role, token_hash, expires_at, accepted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)",
    )
    .bind(id, workspaceId, email, role, tokenHash, input.expires_at, now)
    .run();

  const invitation = await db
    .prepare(
      "SELECT * FROM organization_invitations WHERE organization_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, id)
    .first<OrganizationInvitationRow>();
  if (!invitation) {
    throw new Error("Failed to create organization invitation");
  }
  return { invitation, token };
}

/** List every invitation for the workspace's organization. */
export async function listInvitations(
  workspaceId: string,
): Promise<OrganizationInvitationRow[]> {
  const db = getRawDb();
  const result = await db
    .prepare(
      "SELECT * FROM organization_invitations WHERE organization_id = ? ORDER BY created_at DESC",
    )
    .bind(workspaceId)
    .all<OrganizationInvitationRow>();
  return result.results;
}

/**
 * Accept an invitation by its raw token. The token is hashed and matched
 * against the persisted `token_hash` within the workspace's organization.
 * Refuses expired or already-accepted invitations. On success, marks the
 * invitation as accepted and creates a membership for the given user with the
 * invitation's role.
 */
export async function acceptInvitation(
  workspaceId: string,
  token: string,
  userId: string,
): Promise<AcceptInvitationResult> {
  const db = getRawDb();
  const tokenHash = await hashToken(token);
  const invitation = await db
    .prepare(
      "SELECT * FROM organization_invitations WHERE organization_id = ? AND token_hash = ? LIMIT 1",
    )
    .bind(workspaceId, tokenHash)
    .first<OrganizationInvitationRow>();
  if (!invitation) {
    throw new Error("Invitation not found for this workspace");
  }
  if (isInvitationAccepted(invitation.accepted_at)) {
    throw new Error("Invitation has already been accepted");
  }
  if (isInvitationExpired(invitation.expires_at)) {
    throw new Error("Invitation has expired");
  }
  const now = Date.now();
  await db
    .prepare(
      "UPDATE organization_invitations SET accepted_at = ? WHERE organization_id = ? AND id = ? AND accepted_at IS NULL",
    )
    .bind(now, workspaceId, invitation.id)
    .run();

  const membership = await addMembership(workspaceId, userId, invitation.role);
  const updated = await db
    .prepare(
      "SELECT * FROM organization_invitations WHERE organization_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, invitation.id)
    .first<OrganizationInvitationRow>();
  if (!updated) {
    throw new Error("Invitation disappeared after acceptance");
  }
  return { invitation: updated, membership };
}

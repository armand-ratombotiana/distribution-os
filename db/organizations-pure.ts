import { ORG_ROLES, type OrgRole } from "./schema";
export type { OrgRole } from "./schema";

/**
 * Pure helpers for the `organizations`, `organization_memberships` and
 * `organization_invitations` tables.
 *
 * These functions are side-effect free so they can be unit-tested without a
 * D1 binding and reused by API routes, email pipelines and admin tooling.
 */

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
};

export type OrganizationMembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: number;
  updated_at: number;
};

export type OrganizationInvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  token_hash: string;
  expires_at: number;
  accepted_at: number | null;
  created_at: number;
};

/**
 * Numeric authority level for each role. Higher values can manage lower ones.
 */
export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * An actor may manage a target membership only if their role is strictly
 * higher in the hierarchy. This prevents same-level users from modifying each
 * other and stops privilege escalation (e.g. an admin promoting themselves).
 */
export function canManageRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (!ORG_ROLES.includes(actorRole) || !ORG_ROLES.includes(targetRole)) return false;
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * An actor may invite a new member to a role whose hierarchy is less than or
 * equal to their own — with the constraint that viewers cannot invite anyone.
 * Owners are the only role that can invite additional owners.
 */
export function canInviteRole(actorRole: OrgRole, inviteAsRole: OrgRole): boolean {
  if (!ORG_ROLES.includes(actorRole) || !ORG_ROLES.includes(inviteAsRole)) return false;
  if (actorRole === "viewer") return false;
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[inviteAsRole];
}

/**
 * Lowercase the slug and collapse runs of non-alphanumeric characters into a
 * single hyphen. Leading and trailing hyphens are stripped so the result is
 * always URL-safe.
 */
export function normalizeSlug(slug: string): string {
  return (slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate that a slug is already in canonical form. Callers should run
 * {@link normalizeSlug} first when accepting free-form user input. A valid
 * slug must:
 *   - be 2-32 characters long (after `trim()`)
 *   - contain only lowercase alphanumeric characters and single hyphens
 *   - start and end with an alphanumeric character
 *   - contain no consecutive hyphens, uppercase letters or other symbols
 *
 * Throws on invalid input so callers cannot persist a malformed slug.
 */
export function validateSlug(slug: string): string {
  const input = (slug ?? "").trim();
  if (input.length < 2 || input.length > 32) {
    throw new Error(`Invalid organization slug (length): ${slug}`);
  }
  if (input.includes("--")) {
    throw new Error(`Invalid organization slug (consecutive hyphens): ${slug}`);
  }
  if (!SLUG_PATTERN.test(input)) {
    throw new Error(`Invalid organization slug (format): ${slug}`);
  }
  return input;
}

/**
 * True when `now` is at or past the invitation's expiry timestamp.
 */
export function isInvitationExpired(
  expiresAt: number,
  now: number = Date.now(),
): boolean {
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) return true;
  return now >= expiresAt;
}

/** True when the invitation has already been accepted. */
export function isInvitationAccepted(acceptedAt: number | null | undefined): boolean {
  return acceptedAt !== null && acceptedAt !== undefined && Number.isFinite(acceptedAt);
}

/**
 * Generate an opaque invitation token. The raw value is returned to the caller
 * once (typically in the invitation email) and only the SHA-256 hash is
 * persisted via `hashToken`.
 */
export function buildInvitationToken(): string {
  return `inv_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Hash an invitation token with SHA-256 before persisting it. This mirrors
 * `hashIp` from `audit-pure.ts` but is kept separate so the two concerns can
 * evolve independently.
 */
export async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Return a display-safe view of an organization. The organization table has
 * no secrets today, but the helper still produces a stable, minimal shape so
 * the API contract is explicit.
 */
export function summarizeOrgForDisplay(row: OrganizationRow): {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
} {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Return a display-safe view of a membership. The `user_id` is intentionally
 * preserved so the UI can render the member, while internal bookkeeping
 * fields are dropped to keep the payload small.
 */
export function summarizeMembershipForDisplay(row: OrganizationMembershipRow): {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: number;
  updated_at: number;
} {
  return {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Strip the `token_hash` before returning an invitation to the UI. The hash
 * is only used server-side to match an incoming token and must never be
 * exposed to the client.
 */
export function summarizeInvitationForDisplay(
  row: OrganizationInvitationRow,
): Omit<OrganizationInvitationRow, "token_hash"> {
  const rest = { ...row };
  Reflect.deleteProperty(rest, "token_hash");
  return rest;
}

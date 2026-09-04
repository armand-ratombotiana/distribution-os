import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../db/workspaces";
import {
  createOrganization,
  getOrganization,
  listInvitations,
  listMemberships,
  normalizeSlug,
  summarizeInvitationForDisplay,
  summarizeMembershipForDisplay,
  summarizeOrgForDisplay,
} from "../../../db/organizations";
import { logAuditEvent } from "../../../db/audit";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(2).max(32).optional(),
});

/**
 * Organization endpoints for the current workspace.
 *
 * The workspace id IS the organization id (1:1 mapping) — every workspace
 * has exactly one organization whose `id` equals the workspace id.
 *
 * GET  — return the organization (if any), memberships and invitations.
 * POST — create or update the organization for the current workspace. The
 *        slug is normalised and validated by the pure helpers; if omitted it
 *        is derived from the organisation name.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const [organization, memberships, invitations] = await Promise.all([
      getOrganization(workspace.id),
      listMemberships(workspace.id),
      listInvitations(workspace.id),
    ]);

    return Response.json({
      organization: organization ? summarizeOrgForDisplay(organization) : null,
      memberships: memberships.map(summarizeMembershipForDisplay),
      invitations: invitations.map(summarizeInvitationForDisplay),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view the organization." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Organization unavailable.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const input = createOrganizationSchema.parse(await request.json());
    const organization = await createOrganization(workspace.id, {
      name: input.name,
      slug: input.slug ?? normalizeSlug(input.name),
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "role",
        event_type: "organization.created",
        resource_type: "organization",
        resource_id: organization.id,
        detail: { name: organization.name, slug: organization.slug },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(
      { organization: summarizeOrgForDisplay(organization) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to manage the organization." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid organization request." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Organization could not be saved.",
      },
      { status: 500 },
    );
  }
}

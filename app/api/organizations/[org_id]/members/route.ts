import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import {
  createInvitation,
  listMemberships,
  summarizeInvitationForDisplay,
  summarizeMembershipForDisplay,
} from "../../../../../db/organizations";
import { logAuditEvent } from "../../../../../db/audit";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
  expires_in_seconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24 * 30)
    .optional(),
});

type RouteContext = {
  params: Promise<{ org_id: string }>;
};

/**
 * Organization member endpoints.
 *
 * The workspace id IS the organization id (1:1 mapping). The path parameter
 * `org_id` is asserted to equal the caller's workspace id — a mismatch
 * returns 404 so the route cannot be used to enumerate or invite into other
 * tenants' organizations.
 *
 * GET  — list every membership of the organization (redacted through
 *        `summarizeMembershipForDisplay`).
 * POST — invite a new member by email. The invitation token is generated
 *        server-side; only its SHA-256 hash is persisted. The raw token is
 *        returned once in the response so the caller can deliver it via the
 *        invitation email — it is not retrievable later.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { org_id } = await context.params;
    if (org_id !== workspace.id) {
      return Response.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const memberships = await listMemberships(workspace.id);
    return Response.json({
      members: memberships.map(summarizeMembershipForDisplay),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view organization members." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Organization members unavailable.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { org_id } = await context.params;
    if (org_id !== workspace.id) {
      return Response.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const input = inviteSchema.parse(await request.json());
    const expiresInMs = (input.expires_in_seconds ?? 60 * 60 * 24 * 7) * 1000;
    const expiresAt = Date.now() + expiresInMs;
    const { invitation, token } = await createInvitation(workspace.id, {
      email: input.email,
      role: input.role,
      expires_at: expiresAt,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "role",
        event_type: "organization.invitation.created",
        resource_type: "organization_invitation",
        resource_id: invitation.id,
        detail: {
          email: invitation.email,
          role: invitation.role,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(
      {
        invitation: summarizeInvitationForDisplay(invitation),
        token,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to invite organization members." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid invitation request." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invitation could not be created.",
      },
      { status: 500 },
    );
  }
}

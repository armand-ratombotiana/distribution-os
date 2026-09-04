import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../db/workspaces";
import {
  getOrganization,
  normalizeSlug,
  summarizeOrgForDisplay,
  updateOrganization,
} from "../../../../db/organizations";
import { logAuditEvent } from "../../../../db/audit";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    slug: z.string().trim().min(2).max(32).optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{ org_id: string }>;
};

/**
 * Single-organization endpoints for the current workspace.
 *
 * The workspace id IS the organization id (1:1 mapping). The path parameter
 * `org_id` is therefore asserted to equal the caller's workspace id — a
 * mismatch returns 404 so the route cannot be used to probe other tenants'
 * organizations.
 *
 * GET   — return the organization (redacted through `summarizeOrgForDisplay`).
 * PATCH — partial update of `name` and/or `slug`. The slug is normalised
 *         and validated by the pure helpers before any SQL runs.
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

    const organization = await getOrganization(workspace.id);
    if (!organization) {
      return Response.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }
    return Response.json({ organization: summarizeOrgForDisplay(organization) });
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { org_id } = await context.params;
    if (org_id !== workspace.id) {
      return Response.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const existing = await getOrganization(workspace.id);
    if (!existing) {
      return Response.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const input = patchSchema.parse(await request.json());
    const organization = await updateOrganization(workspace.id, {
      name: input.name,
      slug: input.slug ? normalizeSlug(input.slug) : undefined,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "role",
        event_type: "organization.updated",
        resource_type: "organization",
        resource_id: organization.id,
        detail: {
          name: organization.name,
          slug: organization.slug,
          patched_fields: Object.keys(input),
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ organization: summarizeOrgForDisplay(organization) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update the organization." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid organization update." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Organization could not be updated.",
      },
      { status: 500 },
    );
  }
}

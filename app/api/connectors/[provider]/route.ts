import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../db/workspaces";
import {
  listInstallations,
  summarizeForDisplay,
  upsertInstallation,
} from "../../../../db/connector-installations";
import { connectorCatalog } from "../../../../lib/connector-catalog";
import { logAuditEvent } from "../../../../db/audit";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

const installSchema = z.object({
  scopes: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  capabilities: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  status: z
    .enum([
      "setup_required",
      "authorized",
      "connected",
      "healthy",
      "degraded",
      "disconnected",
      "revoked",
      "error",
    ])
    .optional(),
});

/**
 * Connectors scoped to a single provider slug.
 *
 * GET  — list every installation row for the given provider, newest first.
 * POST — install (or reconfigure) the provider in the current workspace. The
 *        provider must exist in the connector catalog; the category is looked
 *        up automatically so callers only need to send the provider name in
 *        the URL.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { provider } = await context.params;
    const installations = await listInstallations(workspace.id, {
      provider,
      limit: 50,
    });
    return Response.json({
      provider,
      installations: installations.map(summarizeForDisplay),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view connector installations." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connector installations could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { provider } = await context.params;
    const connector = connectorCatalog.find(
      (item) => item.name.toLowerCase() === provider.toLowerCase(),
    );
    if (!connector) {
      return Response.json(
        { error: "Unknown connector provider." },
        { status: 400 },
      );
    }

    const input = installSchema.parse(await request.json().catch(() => ({})));
    const installation = await upsertInstallation(workspace.id, {
      provider: connector.name,
      category: connector.category,
      status: input.status,
      scopes: input.scopes,
      capabilities: input.capabilities,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "connector",
        event_type: "connector.installed",
        resource_type: "connector_installation",
        resource_id: installation.id,
        detail: {
          provider: connector.name,
          category: connector.category,
          status: installation.status,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(
      { installation: summarizeForDisplay(installation) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to manage connectors." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid connector installation request." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Connector installation failed.",
      },
      { status: 500 },
    );
  }
}

import { z } from "zod";
import { ensureWorkspace, requestConnector, requireRequestIdentity } from "../../../db/workspaces";
import { connectorCatalog } from "../../../lib/connector-catalog";
import { upsertInstallation } from "../../../db/connector-installations";

const connectorSchema = z.object({ provider: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  try {
    const identity = requireRequestIdentity(request);
    const input = connectorSchema.parse(await request.json());
    const connector = connectorCatalog.find(item => item.name === input.provider);
    if (!connector) return Response.json({ error: "Unknown connector." }, { status: 400 });
    const workspace = await ensureWorkspace(identity);
    const installation = await upsertInstallation(workspace.id, {
      provider: connector.name,
      category: connector.category,
      status: "setup_required",
      scopes: [],
      capabilities: connector.name === "Resend" ? ["send_email"] : [],
    });
    const connection = await requestConnector(workspace.id, connector.name, connector.category);
    return Response.json({ connection, installation }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return Response.json({ error: "Sign in to manage connectors." }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid connector request." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Connector request failed." }, { status: 500 });
  }
}

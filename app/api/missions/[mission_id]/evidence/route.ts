import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  createEvidence,
  listEvidence,
  summarizeForDisplay,
} from "../../../../../db/evidence";
import { logAuditEvent } from "../../../../../db/audit";

const createEvidenceSchema = z.object({
  source_url: z.string().trim().url().max(1000).optional(),
  source_type: z.enum([
    "website",
    "email",
    "social",
    "crm",
    "analytics",
    "payment",
    "document",
    "manual",
  ]),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(5000),
  extracted_facts: z.record(z.unknown()).optional(),
  provenance: z.record(z.unknown()).optional(),
});

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const input = createEvidenceSchema.parse(await request.json());
    const evidence = await createEvidence(workspace.id, {
      mission_id,
      source_url: input.source_url ?? null,
      source_type: input.source_type,
      content: {
        title: input.title,
        summary: input.summary,
        source_url: input.source_url ?? null,
        source_type: input.source_type,
      },
      title: input.title,
      summary: input.summary,
      extracted_facts: input.extracted_facts ?? null,
      provenance: input.provenance ?? null,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "evidence.created",
        resource_type: "evidence",
        resource_id: evidence.id,
        detail: {
          mission_id,
          source_type: evidence.source_type,
          state: evidence.state,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ evidence: summarizeForDisplay(evidence) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to record evidence." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid evidence request." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Evidence could not be recorded." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const evidence = await listEvidence(workspace.id, { mission_id });
    return Response.json({ evidence: evidence.map(summarizeForDisplay) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to view evidence." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Evidence could not be loaded." },
      { status: 500 }
    );
  }
}

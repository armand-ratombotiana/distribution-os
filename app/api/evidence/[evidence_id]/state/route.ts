import { z } from "zod";
import {
  getEvidence,
  summarizeForDisplay,
  updateEvidenceState,
} from "../../../../../db/evidence";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { logAuditEvent } from "../../../../../db/audit";

const patchSchema = z.object({
  state: z.enum([
    "observed",
    "inferred",
    "needed",
    "verified",
    "contradicted",
    "stale",
    "rejected",
  ]),
});

type RouteContext = {
  params: Promise<{ evidence_id: string }>;
};

/**
 * Transition an evidence row to a new state.
 *
 * The transition is validated against the evidence state machine
 * (`canTransition` in `evidence-pure`) — invalid transitions raise an error
 * that surfaces as a 409 to the client. The response is the full updated row
 * projected through `summarizeForDisplay`.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { evidence_id } = await context.params;

    const current = await getEvidence(workspace.id, evidence_id);
    if (!current) {
      return Response.json(
        { error: "Evidence not found." },
        { status: 404 },
      );
    }

    const input = patchSchema.parse(await request.json());
    if (input.state === current.state) {
      return Response.json({ evidence: summarizeForDisplay(current) });
    }

    const updated = await updateEvidenceState(
      workspace.id,
      evidence_id,
      input.state,
    );

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "evidence.state_changed",
        resource_type: "evidence",
        resource_id: evidence_id,
        detail: {
          mission_id: current.mission_id,
          previous_state: current.state,
          next_state: updated.state,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ evidence: summarizeForDisplay(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update evidence state." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid evidence state request." },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Evidence state update failed.";
    const isTransitionError =
      message.includes("cannot transition") || message.includes("Invalid evidence");
    return Response.json(
      { error: message },
      { status: isTransitionError ? 409 : 500 },
    );
  }
}

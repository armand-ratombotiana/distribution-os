import { z } from "zod";
import {
  getExperiment,
  summarizeForDisplay,
  updateExperimentStatus,
} from "../../../../../db/experiments";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { logAuditEvent } from "../../../../../db/audit";

const patchSchema = z.object({
  status: z.enum(["draft", "running", "completed", "stopped", "blocked"]),
});

type RouteContext = {
  params: Promise<{ experiment_id: string }>;
};

/**
 * Transition an experiment to a new status.
 *
 * The transition is validated against the experiment state machine
 * (`canTransition` in `experiments-pure`) — invalid transitions raise an
 * error that surfaces as a 409 to the client. The response is the full
 * updated row projected through `summarizeForDisplay`.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { experiment_id } = await context.params;

    const current = await getExperiment(workspace.id, experiment_id);
    if (!current) {
      return Response.json(
        { error: "Experiment not found." },
        { status: 404 },
      );
    }

    const input = patchSchema.parse(await request.json());
    if (input.status === current.status) {
      return Response.json({ experiment: summarizeForDisplay(current) });
    }

    const updated = await updateExperimentStatus(
      workspace.id,
      experiment_id,
      input.status,
    );

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "experiment.status_changed",
        resource_type: "experiment",
        resource_id: experiment_id,
        detail: {
          mission_id: current.mission_id,
          previous_status: current.status,
          next_status: updated.status,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ experiment: summarizeForDisplay(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update experiment status." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid experiment status request." },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Experiment status update failed.";
    const isTransitionError =
      message.includes("cannot transition") || message.includes("Invalid experiment");
    return Response.json(
      { error: message },
      { status: isTransitionError ? 409 : 500 },
    );
  }
}

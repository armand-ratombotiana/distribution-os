import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  createExperiment,
  listExperiments,
  summarizeForDisplay,
} from "../../../../../db/experiments";
import { logAuditEvent } from "../../../../../db/audit";

const createExperimentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hypothesis: z.string().trim().min(1).max(1000),
  metric: z.string().trim().min(1).max(200),
  kill_rule: z.string().trim().min(1).max(500),
  baseline: z.string().trim().max(500).optional(),
  variant: z.string().trim().max(500).optional(),
  denominator: z.string().trim().max(200).optional(),
  sample_expectation: z.string().trim().max(500).optional(),
  deadline: z.number().int().positive().optional(),
  strategy_version: z.number().int().positive().max(1000).optional(),
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

    const input = createExperimentSchema.parse(await request.json());
    const experiment = await createExperiment(workspace.id, {
      mission_id,
      title: input.title,
      hypothesis: input.hypothesis,
      metric: input.metric,
      kill_rule: input.kill_rule,
      baseline: input.baseline ?? null,
      variant: input.variant ?? null,
      denominator: input.denominator ?? null,
      sample_expectation: input.sample_expectation ?? null,
      deadline: input.deadline ?? null,
      strategy_version: input.strategy_version,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "experiment.created",
        resource_type: "experiment",
        resource_id: experiment.id,
        detail: {
          mission_id,
          status: experiment.status,
          strategy_version: experiment.strategy_version,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ experiment: summarizeForDisplay(experiment) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to manage experiments." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid experiment request." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Experiment could not be created." },
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

    const experiments = await listExperiments(workspace.id, { mission_id });
    return Response.json({ experiments: experiments.map(summarizeForDisplay) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json({ error: "Sign in to view experiments." }, { status: 401 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Experiments could not be loaded." },
      { status: 500 }
    );
  }
}

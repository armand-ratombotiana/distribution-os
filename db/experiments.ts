/**
 * D1 persistence layer for the `experiments` table.
 *
 * Tenant-isolated by `workspace_id`. Delegates validation, state-machine and
 * display logic to `./experiments-pure`. IDs use `crypto.randomUUID()` and
 * timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  canTransition,
  type ExperimentDecision,
  type ExperimentRow,
  type ExperimentStatus,
  validateExperiment,
} from "./experiments-pure";

export * from "./experiments-pure";

export type CreateExperimentInput = {
  mission_id: string;
  title: string;
  hypothesis: string;
  metric: string;
  kill_rule: string;
  baseline?: string | null;
  variant?: string | null;
  denominator?: string | null;
  sample_expectation?: string | null;
  deadline?: number | null;
  strategy_version?: number;
};

export type ListExperimentsOptions = {
  mission_id?: string;
  status?: ExperimentStatus;
  limit?: number;
};

export type RecordResultInput = {
  result: string;
  result_data?: Record<string, unknown> | null;
  decision?: ExperimentDecision;
  confidence?: number;
};

function isExperimentStatus(value: unknown): value is ExperimentStatus {
  return (
    typeof value === "string" &&
    ["draft", "running", "completed", "stopped", "blocked"].includes(value)
  );
}

function isExperimentDecision(value: unknown): value is ExperimentDecision {
  return (
    typeof value === "string" &&
    ["continue", "change", "stop", "blocked", "pending"].includes(value)
  );
}

/**
 * Insert a new experiment row. Validation runs against the pure helper so that
 * length and required-field rules are enforced before any SQL is executed.
 */
export async function createExperiment(
  workspaceId: string,
  input: CreateExperimentInput,
): Promise<ExperimentRow> {
  const validationError = validateExperiment({
    title: input.title,
    hypothesis: input.hypothesis,
    metric: input.metric,
    killRule: input.kill_rule,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const db = getRawDb();
  const now = Date.now();
  const id = `exp_${crypto.randomUUID()}`;
  const strategyVersion =
    typeof input.strategy_version === "number" && input.strategy_version >= 1
      ? Math.floor(input.strategy_version)
      : 1;

  await db
    .prepare(
      "INSERT INTO experiments (id, workspace_id, mission_id, title, hypothesis, baseline, variant, metric, denominator, sample_expectation, deadline, kill_rule, result, result_data_json, decision, confidence, strategy_version, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'pending', 0, ?, 'draft', ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      input.title,
      input.hypothesis,
      input.baseline ?? null,
      input.variant ?? null,
      input.metric,
      input.denominator ?? null,
      input.sample_expectation ?? null,
      input.deadline ?? null,
      input.kill_rule,
      strategyVersion,
      now,
      now,
    )
    .run();

  const row = await db
    .prepare(
      "SELECT * FROM experiments WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, id)
    .first<ExperimentRow>();
  if (!row) {
    throw new Error("Failed to create experiment");
  }
  return row;
}

/**
 * List experiments for a workspace, optionally filtered by mission and/or
 * status. Ordered by `created_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listExperiments(
  workspaceId: string,
  opts: ListExperimentsOptions = {},
): Promise<ExperimentRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.status) {
    if (!isExperimentStatus(opts.status)) {
      throw new Error(`Invalid experiment status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM experiments WHERE workspace_id = ? AND mission_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.status, limit)
      .all<ExperimentRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM experiments WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<ExperimentRow>();
    return result.results;
  }
  if (opts.status) {
    if (!isExperimentStatus(opts.status)) {
      throw new Error(`Invalid experiment status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM experiments WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<ExperimentRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM experiments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<ExperimentRow>();
  return result.results;
}

/** Fetch a single experiment by id within a workspace. */
export async function getExperiment(
  workspaceId: string,
  experimentId: string,
): Promise<ExperimentRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM experiments WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, experimentId)
    .first<ExperimentRow>();
}

/**
 * Transition an experiment to a new status. Refuses the transition when the
 * state machine (`canTransition`) does not permit it.
 */
export async function updateExperimentStatus(
  workspaceId: string,
  experimentId: string,
  newStatus: ExperimentStatus,
): Promise<ExperimentRow> {
  if (!isExperimentStatus(newStatus)) {
    throw new Error(`Invalid experiment status: ${String(newStatus)}`);
  }
  const db = getRawDb();
  const current = await getExperiment(workspaceId, experimentId);
  if (!current) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }
  if (!canTransition(current.status, newStatus)) {
    throw new Error(
      `Experiment ${experimentId} cannot transition from ${current.status} to ${newStatus}`,
    );
  }
  const now = Date.now();
  await db
    .prepare(
      "UPDATE experiments SET status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(newStatus, now, workspaceId, experimentId)
    .run();

  const updated = await getExperiment(workspaceId, experimentId);
  if (!updated) {
    throw new Error(`Experiment disappeared after update: ${experimentId}`);
  }
  return updated;
}

/**
 * Record the outcome of an experiment. Optionally update the decision and
 * confidence score. The experiment is not auto-transitioned — callers should
 * use `updateExperimentStatus` to move it to `completed` or `stopped`.
 */
export async function recordResult(
  workspaceId: string,
  experimentId: string,
  input: RecordResultInput,
): Promise<ExperimentRow> {
  const db = getRawDb();
  const current = await getExperiment(workspaceId, experimentId);
  if (!current) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }
  const now = Date.now();
  const resultDataJson = input.result_data
    ? JSON.stringify(input.result_data)
    : null;
  const decision: ExperimentDecision = input.decision
    ? (() => {
        if (!isExperimentDecision(input.decision)) {
          throw new Error(`Invalid experiment decision: ${String(input.decision)}`);
        }
        return input.decision;
      })()
    : current.decision;
  const confidence =
    typeof input.confidence === "number" &&
    Number.isFinite(input.confidence) &&
    input.confidence >= 0 &&
    input.confidence <= 100
      ? Math.floor(input.confidence)
      : current.confidence;

  await db
    .prepare(
      "UPDATE experiments SET result = ?, result_data_json = ?, decision = ?, confidence = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(
      input.result,
      resultDataJson,
      decision,
      confidence,
      now,
      workspaceId,
      experimentId,
    )
    .run();

  const updated = await getExperiment(workspaceId, experimentId);
  if (!updated) {
    throw new Error(`Experiment disappeared after update: ${experimentId}`);
  }
  return updated;
}

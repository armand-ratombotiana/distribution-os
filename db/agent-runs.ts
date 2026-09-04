/**
 * D1 persistence layer for the `agent_runs` and `agent_steps` tables.
 *
 * Tenant-isolated by `workspace_id`. Delegates state-machine, cost and display
 * logic to `./agent-runs-pure`. Run IDs use the `run_` prefix (from
 * `buildRunId`), step IDs use `crypto.randomUUID()`, and timestamps use
 * `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildRunId,
  calculateCost,
  calculateLatencyMs,
  canTransitionRun,
  canTransitionStep,
  type AgentRunRow,
  type AgentRunStatus,
  type AgentStepRow,
  type AgentStepStatus,
} from "./agent-runs-pure";

export * from "./agent-runs-pure";

export type StartRunInput = {
  mission_id: string;
  agent_name: string;
  prompt_version?: string;
  model: string;
  input_refs?: string[];
};

export type CompleteRunInput = {
  status: AgentRunStatus;
  tokens_input?: number;
  tokens_output?: number;
  output_refs?: string[];
  error?: string | null;
  completed_at?: number;
};

export type ListRunsOptions = {
  mission_id?: string;
  status?: AgentRunStatus;
  limit?: number;
};

export type AddStepInput = {
  step_index: number;
  tool_name?: string | null;
  tool_input?: unknown | null;
  tool_output?: unknown | null;
  status?: AgentStepStatus;
};

function isRunStatus(value: unknown): value is AgentRunStatus {
  return (
    typeof value === "string" &&
    ["running", "completed", "failed", "cancelled"].includes(value)
  );
}

function isStepStatus(value: unknown): value is AgentStepStatus {
  return (
    typeof value === "string" &&
    ["running", "completed", "failed", "cancelled"].includes(value)
  );
}

function jsonStringifyArray(values: string[] | undefined): string {
  if (!values || values.length === 0) return "[]";
  return JSON.stringify(values);
}

function jsonStringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Start a new agent run. The run is created in the `running` status with zero
 * token usage and zero cost. Use `completeRun` to finalise it.
 */
export async function startRun(
  workspaceId: string,
  input: StartRunInput,
): Promise<AgentRunRow> {
  const db = getRawDb();
  const now = Date.now();
  const id = buildRunId();
  const promptVersion = input.prompt_version ?? "1.0";
  const inputRefsJson = jsonStringifyArray(input.input_refs);

  await db
    .prepare(
      "INSERT INTO agent_runs (id, workspace_id, mission_id, agent_name, prompt_version, model, status, input_refs_json, output_refs_json, tokens_input, tokens_output, cost_cents, latency_ms, error, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, '[]', 0, 0, 0, 0, NULL, ?, NULL, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      input.agent_name,
      promptVersion,
      input.model,
      inputRefsJson,
      now,
      now,
    )
    .run();

  const row = await getRun(workspaceId, id);
  if (!row) {
    throw new Error("Failed to start agent run");
  }
  return row;
}

/**
 * Finalise an agent run. Validates the transition against the run state
 * machine, computes cost from token usage and latency from `started_at` to
 * `completed_at`, and persists the terminal fields.
 */
export async function completeRun(
  workspaceId: string,
  runId: string,
  input: CompleteRunInput,
): Promise<AgentRunRow> {
  if (!isRunStatus(input.status)) {
    throw new Error(`Invalid agent run status: ${String(input.status)}`);
  }
  const db = getRawDb();
  const current = await getRun(workspaceId, runId);
  if (!current) {
    throw new Error(`Agent run not found: ${runId}`);
  }
  if (!canTransitionRun(current.status, input.status)) {
    throw new Error(
      `Agent run ${runId} cannot transition from ${current.status} to ${input.status}`,
    );
  }
  const now = Date.now();
  const completedAt = input.completed_at ?? now;
  const tokensInput = Math.max(0, Math.floor(input.tokens_input ?? 0));
  const tokensOutput = Math.max(0, Math.floor(input.tokens_output ?? 0));
  const costCents = calculateCost(current.model, tokensInput, tokensOutput);
  const latencyMs = calculateLatencyMs(current.started_at, completedAt);
  const outputRefsJson = jsonStringifyArray(input.output_refs);
  const error = input.error === undefined ? null : input.error;

  await db
    .prepare(
      "UPDATE agent_runs SET status = ?, tokens_input = ?, tokens_output = ?, output_refs_json = ?, cost_cents = ?, latency_ms = ?, error = ?, completed_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(
      input.status,
      tokensInput,
      tokensOutput,
      outputRefsJson,
      costCents,
      latencyMs,
      error,
      completedAt,
      workspaceId,
      runId,
    )
    .run();

  const updated = await getRun(workspaceId, runId);
  if (!updated) {
    throw new Error(`Agent run disappeared after update: ${runId}`);
  }
  return updated;
}

/**
 * List agent runs for a workspace, optionally filtered by mission and/or
 * status. Ordered by `created_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listRuns(
  workspaceId: string,
  opts: ListRunsOptions = {},
): Promise<AgentRunRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.status) {
    if (!isRunStatus(opts.status)) {
      throw new Error(`Invalid agent run status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM agent_runs WHERE workspace_id = ? AND mission_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.status, limit)
      .all<AgentRunRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM agent_runs WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<AgentRunRow>();
    return result.results;
  }
  if (opts.status) {
    if (!isRunStatus(opts.status)) {
      throw new Error(`Invalid agent run status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM agent_runs WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<AgentRunRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM agent_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<AgentRunRow>();
  return result.results;
}

/** Fetch a single agent run by id within a workspace. */
export async function getRun(
  workspaceId: string,
  runId: string,
): Promise<AgentRunRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM agent_runs WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, runId)
    .first<AgentRunRow>();
}

/**
 * Append a step to an agent run. Steps start in the `running` status (unless
 * overridden) and are ordered by `step_index`. The run must belong to the
 * given workspace.
 */
export async function addStep(
  workspaceId: string,
  runId: string,
  input: AddStepInput,
): Promise<AgentStepRow> {
  const db = getRawDb();
  const run = await getRun(workspaceId, runId);
  if (!run) {
    throw new Error(`Agent run not found: ${runId}`);
  }
  const now = Date.now();
  const status: AgentStepStatus = input.status ?? "running";
  if (!isStepStatus(status)) {
    throw new Error(`Invalid agent step status: ${String(status)}`);
  }
  if (status !== "running" && !canTransitionStep("running", status)) {
    throw new Error(
      `Agent step cannot start in terminal status ${status}`,
    );
  }
  const id = `step_${crypto.randomUUID()}`;
  const toolInputJson = jsonStringifyValue(input.tool_input);
  const toolOutputJson = jsonStringifyValue(input.tool_output);
  const completedAt = status === "running" ? null : now;

  await db
    .prepare(
      "INSERT INTO agent_steps (id, run_id, step_index, tool_name, tool_input_json, tool_output_json, status, started_at, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      runId,
      Math.max(0, Math.floor(input.step_index)),
      input.tool_name ?? null,
      toolInputJson,
      toolOutputJson,
      status,
      now,
      completedAt,
      now,
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM agent_steps WHERE run_id = ? AND id = ? LIMIT 1")
    .bind(runId, id)
    .first<AgentStepRow>();
  if (!row) {
    throw new Error("Failed to add agent step");
  }
  return row;
}

/**
 * List the steps of an agent run, ordered by `step_index ASC`. The run must
 * belong to the given workspace (enforced via the workspace-scoped
 * `agent_runs` join).
 */
export async function listSteps(
  workspaceId: string,
  runId: string,
): Promise<AgentStepRow[]> {
  const db = getRawDb();
  const run = await getRun(workspaceId, runId);
  if (!run) {
    throw new Error(`Agent run not found: ${runId}`);
  }
  const result = await db
    .prepare(
      "SELECT agent_steps.* FROM agent_steps JOIN agent_runs ON agent_runs.id = agent_steps.run_id WHERE agent_runs.workspace_id = ? AND agent_steps.run_id = ? ORDER BY agent_steps.step_index ASC",
    )
    .bind(workspaceId, runId)
    .all<AgentStepRow>();
  return result.results;
}

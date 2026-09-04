import { AGENT_RUN_STATUSES, type AgentRunStatus } from "./schema";

/**
 * Pure helpers for the `agent_runs` and `agent_steps` tables.
 *
 * The agent runtime uses these to validate state-machine transitions, compute
 * cost/latency, and shape payloads for the UI without leaking internal
 * reference identifiers.
 */

export type AgentRunRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  agent_name: string;
  prompt_version: string;
  model: string;
  status: AgentRunStatus;
  input_refs_json: string;
  output_refs_json: string;
  tokens_input: number;
  tokens_output: number;
  cost_cents: number;
  latency_ms: number;
  error: string | null;
  started_at: number;
  completed_at: number | null;
  created_at: number;
};

export type AgentStepRow = {
  id: string;
  run_id: string;
  step_index: number;
  tool_name: string | null;
  tool_input_json: string | null;
  tool_output_json: string | null;
  status: AgentStepStatus;
  started_at: number;
  completed_at: number | null;
  created_at: number;
};

/**
 * Step lifecycle mirrors the run lifecycle so observability tooling can reuse
 * the same transition rules.
 */
export const STEP_STATUSES = ["running", "completed", "failed", "cancelled"] as const;
export type AgentStepStatus = (typeof STEP_STATUSES)[number];

const TERMINAL_RUN_STATUSES: AgentRunStatus[] = ["completed", "failed", "cancelled"];
const TERMINAL_STEP_STATUSES: AgentStepStatus[] = ["completed", "failed", "cancelled"];
const RUN_TRANSITIONS_FROM_RUNNING: AgentRunStatus[] = ["completed", "failed", "cancelled"];

/**
 * State machine for an `agent_run`. A run that is currently `running` may move
 * to any terminal state. Once terminal, no further transitions are allowed.
 */
export function canTransitionRun(from: AgentRunStatus, to: AgentRunStatus): boolean {
  if (TERMINAL_RUN_STATUSES.includes(from)) return false;
  if (from === "running") return RUN_TRANSITIONS_FROM_RUNNING.includes(to);
  return false;
}

/** True when the run has reached a terminal state and cannot change again. */
export function isTerminalRun(status: AgentRunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

/**
 * State machine for an `agent_step`. Mirrors `canTransitionRun` so a step can
 * only leave `running` for a terminal state.
 */
export function canTransitionStep(from: AgentStepStatus, to: AgentStepStatus): boolean {
  if (TERMINAL_STEP_STATUSES.includes(from)) return false;
  if (from === "running") return ["completed", "failed", "cancelled"].includes(to);
  return false;
}

const MODEL_PRICING_CENTS_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "gpt-4": { input: 0.003, output: 0.006 },
  "gpt-5": { input: 0.005, output: 0.01 },
};
const DEFAULT_MODEL = "gpt-4";

function normalizeModel(model: string): string {
  const trimmed = (model ?? "").trim().toLowerCase();
  return MODEL_PRICING_CENTS_PER_TOKEN[trimmed] ? trimmed : DEFAULT_MODEL;
}

/**
 * Compute the cost in cents for a model invocation. Prices are expressed in
 * cents-per-token to match the integer `cost_cents` column.
 *
 *   gpt-4: 0.003 / 0.006 cents per input/output token
 *   gpt-5: 0.005 / 0.01  cents per input/output token
 *   unknown model: falls back to gpt-4 pricing
 */
export function calculateCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const pricing = MODEL_PRICING_CENTS_PER_TOKEN[normalizeModel(model)];
  const input = Math.max(0, Math.trunc(tokensInput));
  const output = Math.max(0, Math.trunc(tokensOutput));
  const costCents = input * pricing.input + output * pricing.output;
  return Math.round(costCents);
}

/**
 * Compute elapsed milliseconds for a run/step. Returns 0 when the operation
 * has not yet completed (or if the timestamps are inverted, which should not
 * happen but is guarded against for safety).
 */
export function calculateLatencyMs(
  startedAt: number,
  completedAt: number | null | undefined,
): number {
  if (completedAt === null || completedAt === undefined) return 0;
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) return 0;
  return Math.max(0, Math.trunc(completedAt - startedAt));
}

/**
 * Strip the workspace identifier and reference payloads before returning a run
 * to the UI. These fields are only needed internally for orchestration.
 */
export function summarizeRunForDisplay(
  row: AgentRunRow,
): Omit<AgentRunRow, "workspace_id" | "input_refs_json" | "output_refs_json"> {
  const { workspace_id: _w, input_refs_json: _i, output_refs_json: _o, ...rest } = row;
  return rest;
}

/**
 * Strip tool input/output payloads before returning a step to the UI. Tool
 * payloads frequently contain raw API responses that should not leak to the
 * client.
 */
export function summarizeStepForDisplay(
  row: AgentStepRow,
): Omit<AgentStepRow, "tool_input_json" | "tool_output_json"> {
  const { tool_input_json: _i, tool_output_json: _o, ...rest } = row;
  return rest;
}

/** Generate a unique identifier for a new agent run. */
export function buildRunId(): string {
  return `run_${crypto.randomUUID()}`;
}

// Re-export for callers that want to iterate the canonical list.
export { AGENT_RUN_STATUSES };

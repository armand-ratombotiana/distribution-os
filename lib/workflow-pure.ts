/**
 * Pure workflow engine.
 *
 * A workflow is a named sequence of typed steps. Each step has an id, a
 * kind (action / decision / wait / end), and a transition function that
 * returns the id of the next step. `executeWorkflow` walks the chain
 * starting from `startStepId` until it hits a terminal step or a guard
 * limit. The engine is pure: every side effect is injected through the
 * caller-supplied `executor`.
 */

export type WorkflowStepKind = "action" | "decision" | "wait" | "end";

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "suspended";

export interface WorkflowContext<T = unknown> {
  /** Step outputs keyed by step id. */
  outputs: Record<string, T>;
  /** User-supplied environment. */
  env: unknown;
  /** Step id of the currently-executing step, null when idle. */
  currentStepId: string | null;
  /** Steps that have been visited, in order, for audit / replay. */
  visitedSteps: string[];
}

export interface WorkflowStep<T = unknown> {
  id: string;
  kind: WorkflowStepKind;
  /** Side-effecting executor. Returns the next step id (or null for terminal). */
  execute?: (context: WorkflowContext<T>) => string | null | Promise<string | null>;
  /** Optional label for diagnostics. */
  label?: string;
}

export interface Workflow<T = unknown> {
  id: string;
  steps: ReadonlyArray<WorkflowStep<T>>;
  startStepId: string;
  /** Safety guard: maximum number of step transitions per run. */
  maxTransitions: number;
}

export interface WorkflowState<T = unknown> {
  workflowId: string;
  status: WorkflowStatus;
  context: WorkflowContext<T>;
  /** Last step id visited. */
  currentStepId: string | null;
  /** Error message, when status is `failed`. */
  error: string | null;
  /** Number of transitions performed so far. */
  transitions: number;
}

/**
 * Build a workflow state from a workflow definition.
 */
export function createWorkflowState<T = unknown>(
  workflow: Workflow<T>,
  env: unknown = null,
): WorkflowState<T> {
  return {
    workflowId: workflow.id,
    status: "pending",
    context: {
      outputs: {},
      env,
      currentStepId: null,
      visitedSteps: [],
    },
    currentStepId: null,
    error: null,
    transitions: 0,
  };
}

/**
 * Look up a step by id. Returns undefined when not found.
 */
export function getStep<T = unknown>(
  workflow: Workflow<T>,
  stepId: string,
): WorkflowStep<T> | undefined {
  return workflow.steps.find((s) => s.id === stepId);
}

/**
 * Execute the workflow forward. Walks step transitions starting from
 * `workflow.startStepId`, recording outputs and visited step ids.
 *
 *   - Stops on a step whose `execute` returns null (terminal).
 *   - Stops on the first thrown error (status → `failed`).
 *   - Stops when `maxTransitions` is reached (status → `failed`).
 *   - A `wait` step with no executor suspends the workflow
 *     (status → `suspended`).
 */
export async function executeWorkflow<T = unknown>(
  workflow: Workflow<T>,
  state: WorkflowState<T>,
): Promise<WorkflowState<T>> {
  const outputs: Record<string, T> = { ...state.context.outputs };
  const visitedSteps: string[] = [...state.context.visitedSteps];
  let status: WorkflowStatus = "running";
  let error: string | null = state.error;
  let transitions = state.transitions;
  let currentStepId: string | null = state.currentStepId ?? workflow.startStepId;

  while (currentStepId !== null) {
    if (transitions >= workflow.maxTransitions) {
      status = "failed";
      error = `Workflow exceeded maxTransitions (${workflow.maxTransitions})`;
      break;
    }
    const step: WorkflowStep<T> | undefined = getStep<T>(workflow, currentStepId);
    if (!step) {
      status = "failed";
      error = `Unknown step id: ${currentStepId}`;
      break;
    }
    visitedSteps.push(step.id);
    transitions += 1;

    if (step.kind === "wait" && !step.execute) {
      status = "suspended";
      break;
    }

    try {
      const next: string | null = step.execute
        ? await step.execute({ outputs, env: state.context.env, currentStepId: step.id, visitedSteps })
        : null;
      if (next === null || next === undefined || step.kind === "end") {
        status = "completed";
        currentStepId = null;
        break;
      }
      currentStepId = next;
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  if (currentStepId === null && status === "running") {
    status = "completed";
  }

  return {
    workflowId: workflow.id,
    status,
    context: {
      outputs,
      env: state.context.env,
      currentStepId,
      visitedSteps,
    },
    currentStepId,
    error,
    transitions,
  };
}

/**
 * Inspect a workflow state and return a high-level status snapshot.
 */
export function getWorkflowStatus<T = unknown>(
  state: WorkflowState<T>,
): {
  status: WorkflowStatus;
  currentStepId: string | null;
  transitions: number;
  visitedSteps: ReadonlyArray<string>;
  error: string | null;
} {
  return {
    status: state.status,
    currentStepId: state.currentStepId,
    transitions: state.transitions,
    visitedSteps: state.context.visitedSteps,
    error: state.error,
  };
}

/**
 * Whether the workflow is in a terminal state (completed, failed, or
 * suspended awaiting external input).
 */
export function isWorkflowDone<T = unknown>(state: WorkflowState<T>): boolean {
  return (
    state.status === "completed" ||
    state.status === "failed" ||
    state.status === "suspended"
  );
}

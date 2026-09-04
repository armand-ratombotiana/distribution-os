/**
 * Pure saga orchestrator.
 *
 * A saga is a sequence of compensatable steps. Each step has an `action`
 * (forward) and a `compensation` (rollback). The orchestrator walks the
 * steps in order; when a step fails it walks backwards calling each
 * completed step's compensation. All side effects are injected via the
 * `SagaContext` executors — the orchestrator itself is pure with respect
 * to its inputs.
 */

export type SagaStatus =
  | "pending"
  | "running"
  | "completed"
  | "compensating"
  | "failed"
  | "compensated";

export interface SagaStep<T = unknown> {
  name: string;
  /** Forward action. Throws on failure. Returns the step's output. */
  action: (context: SagaContext<T>) => T | Promise<T>;
  /** Compensation (rollback). Throws on failure. Receives the action's output. */
  compensate?: (output: T, context: SagaContext<T>) => void | Promise<void>;
}

export interface SagaContext<T = unknown> {
  /** Outputs of completed steps keyed by step name. */
  outputs: Record<string, T>;
  /** User-supplied environment (db handles, http clients, etc.). */
  env: unknown;
}

export interface SagaState<T = unknown> {
  status: SagaStatus;
  steps: ReadonlyArray<SagaStep<T>>;
  completedSteps: ReadonlyArray<{ name: string; output: T }>;
  currentStep: string | null;
  /** Last error message, when status is `failed`. */
  error: string | null;
}

/**
 * Create a fresh saga state object from a list of steps.
 */
export function createSaga<T = unknown>(
  steps: ReadonlyArray<SagaStep<T>>,
  env: unknown = null,
): { state: SagaState<T>; context: SagaContext<T> } {
  return {
    state: {
      status: "pending",
      steps,
      completedSteps: [],
      currentStep: null,
      error: null,
    },
    context: { outputs: {}, env },
  };
}

/**
 * Run the saga forward. Walks each step's `action` in order, recording
 * outputs in the context. On the first thrown error the saga enters the
 * `compensating` status and `compensate` is called to roll back.
 *
 * Returns a new state; the input state is not mutated.
 */
export async function runSaga<T = unknown>(
  state: SagaState<T>,
  context: SagaContext<T>,
): Promise<{ state: SagaState<T>; context: SagaContext<T> }> {
  // Local mutable copies; we rebuild the immutable state at the end.
  const completed: { name: string; output: T }[] = [];
  const outputs: Record<string, T> = { ...context.outputs };
  let current: string | null = null;
  let status: SagaStatus = "running";
  let error: string | null = null;

  for (const step of state.steps) {
    current = step.name;
    try {
      const output = await step.action({ outputs, env: context.env });
      outputs[step.name] = output;
      completed.push({ name: step.name, output });
    } catch (err) {
      status = "compensating";
      error = err instanceof Error ? err.message : String(err);
      // Roll back in reverse order of completion.
      const rollback = await compensate<T>(
        {
          status,
          steps: state.steps,
          completedSteps: completed,
          currentStep: step.name,
          error,
        },
        { outputs, env: context.env },
      );
      return {
        state: rollback.state,
        context: { outputs, env: context.env },
      };
    }
  }

  status = "completed";
  current = null;
  return {
    state: {
      status,
      steps: state.steps,
      completedSteps: completed,
      currentStep: current,
      error,
    },
    context: { outputs, env: context.env },
  };
}

/**
 * Walk the completed steps in reverse order and call each step's
 * `compensate` callback. A compensation failure leaves the saga in the
 * `failed` status with the compensation error message; otherwise the
 * saga transitions to `compensated`.
 */
export async function compensate<T = unknown>(
  state: SagaState<T>,
  context: SagaContext<T>,
): Promise<{ state: SagaState<T>; context: SagaContext<T> }> {
  let error: string | null = state.error;
  let status: SagaStatus = "compensated";

  // Iterate in reverse insertion order.
  for (let i = state.completedSteps.length - 1; i >= 0; i -= 1) {
    const { name, output } = state.completedSteps[i];
    const step = state.steps.find((s) => s.name === name);
    if (!step?.compensate) continue;
    try {
      await step.compensate(output, context);
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  return {
    state: {
      status,
      steps: state.steps,
      completedSteps: state.completedSteps,
      currentStep: state.currentStep,
      error,
    },
    context,
  };
}

/**
 * Whether the saga has reached a terminal state (no further action
 * possible). Terminal states are `completed`, `compensated`, and
 * `failed`.
 */
export function isComplete<T = unknown>(state: SagaState<T>): boolean {
  return (
    state.status === "completed" ||
    state.status === "compensated" ||
    state.status === "failed"
  );
}

/**
 * Whether the saga is in a successful end state (`completed`).
 */
export function isSuccessful<T = unknown>(state: SagaState<T>): boolean {
  return state.status === "completed";
}

/**
 * Whether the saga ended in a compensated state (rolled back cleanly).
 */
export function isCompensated<T = unknown>(state: SagaState<T>): boolean {
  return state.status === "compensated";
}

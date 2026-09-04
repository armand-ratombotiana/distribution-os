import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compensate,
  createSaga,
  isComplete,
  isCompensated,
  isSuccessful,
  runSaga,
  type SagaStep,
} from "../lib/saga-pure.ts";

test("createSaga returns a pending state with no completed steps", () => {
  const { state, context } = createSaga<number>([]);
  assert.equal(state.status, "pending");
  assert.equal(state.completedSteps.length, 0);
  assert.equal(state.currentStep, null);
  assert.deepEqual(context.outputs, {});
});

test("runSaga with zero steps completes immediately", async () => {
  const { state, context } = createSaga<number>([]);
  const { state: finalState } = await runSaga(state, context);
  assert.equal(finalState.status, "completed");
  assert.equal(finalState.completedSteps.length, 0);
});

test("runSaga walks all steps and records outputs", async () => {
  const steps: SagaStep<number>[] = [
    { name: "a", action: () => 1 },
    { name: "b", action: () => 2 },
    { name: "c", action: () => 3 },
  ];
  const { state, context } = createSaga(steps);
  const { state: finalState, context: finalContext } = await runSaga(state, context);
  assert.equal(finalState.status, "completed");
  assert.equal(finalState.completedSteps.length, 3);
  assert.deepEqual(finalContext.outputs, { a: 1, b: 2, c: 3 });
});

test("runSaga does not mutate the input state", async () => {
  const steps: SagaStep<number>[] = [{ name: "a", action: () => 1 }];
  const { state, context } = createSaga(steps);
  await runSaga(state, context);
  assert.equal(state.status, "pending");
  assert.equal(state.completedSteps.length, 0);
});

test("runSaga triggers compensation on the first failing step", async () => {
  const log: string[] = [];
  const steps: SagaStep<number>[] = [
    {
      name: "a",
      action: () => 1,
      compensate: (out) => {
        log.push(`compensate-a:${out}`);
      },
    },
    {
      name: "b",
      action: () => 2,
      compensate: (out) => {
        log.push(`compensate-b:${out}`);
      },
    },
    {
      name: "c",
      action: () => {
        throw new Error("c-failed");
      },
    },
  ];
  const { state, context } = createSaga(steps);
  const { state: finalState } = await runSaga(state, context);
  assert.equal(finalState.status, "compensated");
  assert.equal(finalState.error, "c-failed");
  // Compensation runs in reverse: b before a.
  assert.deepEqual(log, ["compensate-b:2", "compensate-a:1"]);
});

test("runSaga leaves a step without compensate unchanged when rolling back", async () => {
  const steps: SagaStep<number>[] = [
    { name: "a", action: () => 1 }, // no compensate
    {
      name: "b",
      action: () => {
        throw new Error("b-failed");
      },
    },
  ];
  const { state, context } = createSaga(steps);
  const { state: finalState } = await runSaga(state, context);
  // Step "a" had no compensate; the saga still finishes compensated.
  assert.equal(finalState.status, "compensated");
  assert.equal(finalState.error, "b-failed");
});

test("compensate marks the saga as failed when a compensation throws", async () => {
  const steps: SagaStep<number>[] = [
    {
      name: "a",
      action: () => 1,
      compensate: () => {
        throw new Error("compensation-failed");
      },
    },
    {
      name: "b",
      action: () => {
        throw new Error("b-failed");
      },
    },
  ];
  const { state, context } = createSaga(steps);
  // Manually run to the failing step.
  const running = await runSaga(state, context);
  assert.equal(running.state.status, "failed");
  assert.equal(running.state.error, "compensation-failed");
});

test("compensate is callable directly on a partially-completed state", async () => {
  const log: string[] = [];
  const steps: SagaStep<number>[] = [
    {
      name: "a",
      action: () => 1,
      compensate: (out) => {
        log.push(`undo-a:${out}`);
      },
    },
  ];
  // Build a state with one completed step manually.
  const state = {
    status: "compensating" as const,
    steps,
    completedSteps: [{ name: "a", output: 1 }],
    currentStep: null,
    error: "manual-trigger",
  };
  const { state: finalState } = await compensate(state, { outputs: { a: 1 }, env: null });
  assert.equal(finalState.status, "compensated");
  assert.deepEqual(log, ["undo-a:1"]);
});

test("isComplete returns true for completed, compensated, and failed", () => {
  for (const status of ["completed", "compensated", "failed"] as const) {
    const state = {
      status,
      steps: [],
      completedSteps: [],
      currentStep: null,
      error: null,
    };
    assert.equal(isComplete(state), true);
  }
  for (const status of ["pending", "running", "compensating"] as const) {
    const state = {
      status,
      steps: [],
      completedSteps: [],
      currentStep: null,
      error: null,
    };
    assert.equal(isComplete(state), false);
  }
});

test("isSuccessful and isCompensated distinguish the terminal states", async () => {
  const okSteps: SagaStep<number>[] = [{ name: "a", action: () => 1 }];
  const ok = await runSaga(createSaga(okSteps).state, createSaga(okSteps).context);
  assert.equal(isSuccessful(ok.state), true);
  assert.equal(isCompensated(ok.state), false);

  const badSteps: SagaStep<number>[] = [
    {
      name: "a",
      action: () => 1,
      compensate: () => {},
    },
    { name: "b", action: () => { throw new Error("x"); } },
  ];
  const bad = await runSaga(createSaga(badSteps).state, createSaga(badSteps).context);
  assert.equal(isSuccessful(bad.state), false);
  assert.equal(isCompensated(bad.state), true);
});

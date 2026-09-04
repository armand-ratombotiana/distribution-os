import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createWorkflowState,
  executeWorkflow,
  getStep,
  getWorkflowStatus,
  isWorkflowDone,
  type Workflow,
  type WorkflowStep,
} from "../lib/workflow-pure.ts";

function buildLinearWorkflow(): Workflow<string> {
  const steps: WorkflowStep<string>[] = [
    {
      id: "start",
      kind: "action",
      execute: (ctx) => {
        ctx.outputs["start"] = "started";
        return "middle";
      },
    },
    {
      id: "middle",
      kind: "action",
      execute: (ctx) => {
        ctx.outputs["middle"] = "middled";
        return "end";
      },
    },
    { id: "end", kind: "end" },
  ];
  return { id: "wf-1", steps, startStepId: "start", maxTransitions: 100 };
}

test("createWorkflowState returns a pending state with no visited steps", () => {
  const wf = buildLinearWorkflow();
  const state = createWorkflowState(wf);
  assert.equal(state.status, "pending");
  assert.equal(state.currentStepId, null);
  assert.equal(state.transitions, 0);
  assert.deepEqual(state.context.visitedSteps, []);
});

test("getStep looks up a step by id", () => {
  const wf = buildLinearWorkflow();
  assert.equal(getStep(wf, "middle")?.kind, "action");
  assert.equal(getStep(wf, "missing"), undefined);
});

test("executeWorkflow walks the chain and completes", async () => {
  const wf = buildLinearWorkflow();
  const state = createWorkflowState(wf);
  const finalState = await executeWorkflow(wf, state);
  assert.equal(finalState.status, "completed");
  assert.equal(finalState.currentStepId, null);
  assert.deepEqual(finalState.context.visitedSteps, ["start", "middle", "end"]);
  assert.equal(finalState.context.outputs["start"], "started");
  assert.equal(finalState.context.outputs["middle"], "middled");
});

test("executeWorkflow does not mutate the input state", async () => {
  const wf = buildLinearWorkflow();
  const state = createWorkflowState(wf);
  await executeWorkflow(wf, state);
  assert.equal(state.status, "pending");
  assert.equal(state.transitions, 0);
  assert.deepEqual(state.context.visitedSteps, []);
});

test("executeWorkflow fails when a step throws", async () => {
  const wf: Workflow<string> = {
    id: "wf-fail",
    startStepId: "boom",
    maxTransitions: 100,
    steps: [
      {
        id: "boom",
        kind: "action",
        execute: () => {
          throw new Error("step-exploded");
        },
      },
    ],
  };
  const finalState = await executeWorkflow(wf, createWorkflowState(wf));
  assert.equal(finalState.status, "failed");
  assert.equal(finalState.error, "step-exploded");
  assert.deepEqual(finalState.context.visitedSteps, ["boom"]);
});

test("executeWorkflow fails when a step returns an unknown next id", async () => {
  const wf: Workflow<string> = {
    id: "wf-bad",
    startStepId: "a",
    maxTransitions: 100,
    steps: [
      {
        id: "a",
        kind: "action",
        execute: () => "nonexistent",
      },
    ],
  };
  const finalState = await executeWorkflow(wf, createWorkflowState(wf));
  assert.equal(finalState.status, "failed");
  assert.match(finalState.error ?? "", /Unknown step id: nonexistent/);
});

test("executeWorkflow suspends on a wait step without an executor", async () => {
  const wf: Workflow<string> = {
    id: "wf-wait",
    startStepId: "prepare",
    maxTransitions: 100,
    steps: [
      { id: "prepare", kind: "action", execute: () => "hold" },
      { id: "hold", kind: "wait" },
    ],
  };
  const finalState = await executeWorkflow(wf, createWorkflowState(wf));
  assert.equal(finalState.status, "suspended");
  assert.equal(finalState.currentStepId, "hold");
  assert.deepEqual(finalState.context.visitedSteps, ["prepare", "hold"]);
});

test("executeWorkflow fails when maxTransitions is exceeded", async () => {
  // Two actions that point at each other → infinite loop, guarded by maxTransitions.
  const wf: Workflow<string> = {
    id: "wf-loop",
    startStepId: "a",
    maxTransitions: 4,
    steps: [
      { id: "a", kind: "action", execute: () => "b" },
      { id: "b", kind: "action", execute: () => "a" },
    ],
  };
  const finalState = await executeWorkflow(wf, createWorkflowState(wf));
  assert.equal(finalState.status, "failed");
  assert.match(finalState.error ?? "", /maxTransitions/);
  assert.equal(finalState.transitions, 4);
});

test("getWorkflowStatus returns a snapshot of the workflow state", async () => {
  const wf = buildLinearWorkflow();
  const state = await executeWorkflow(wf, createWorkflowState(wf));
  const snapshot = getWorkflowStatus(state);
  assert.equal(snapshot.status, "completed");
  assert.equal(snapshot.currentStepId, null);
  assert.deepEqual([...snapshot.visitedSteps], ["start", "middle", "end"]);
  assert.equal(snapshot.error, null);
});

test("isWorkflowDone returns true for completed, failed, and suspended states", async () => {
  const wf = buildLinearWorkflow();
  const completed = await executeWorkflow(wf, createWorkflowState(wf));
  assert.equal(isWorkflowDone(completed), true);

  const failWf: Workflow<string> = {
    id: "wf-fail",
    startStepId: "boom",
    maxTransitions: 100,
    steps: [
      {
        id: "boom",
        kind: "action",
        execute: () => {
          throw new Error("x");
        },
      },
    ],
  };
  const failed = await executeWorkflow(failWf, createWorkflowState(failWf));
  assert.equal(isWorkflowDone(failed), true);

  const waitWf: Workflow<string> = {
    id: "wf-wait",
    startStepId: "hold",
    maxTransitions: 100,
    steps: [{ id: "hold", kind: "wait" }],
  };
  const suspended = await executeWorkflow(waitWf, createWorkflowState(waitWf));
  assert.equal(isWorkflowDone(suspended), true);

  assert.equal(isWorkflowDone(createWorkflowState(wf)), false);
});

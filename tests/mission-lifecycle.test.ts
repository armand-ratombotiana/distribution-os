import assert from "node:assert/strict";
import test from "node:test";

import {
  STAGE_ORDER,
  STAGE_TRANSITIONS,
  getNextStage,
  getStageDescription,
  shouldIncrementCycle,
  isStageCompleteable,
  getMissionReadiness,
  getMissionProgress,
  shouldAutoAdvance,
  getEstimatedTimeToPayment,
} from "../lib/mission-lifecycle-pure";

test("STAGE_ORDER has 6 stages in correct order", () => {
  assert.deepEqual([...STAGE_ORDER], [
    "observe",
    "decide",
    "approve",
    "act",
    "measure",
    "learn",
  ]);
});

test("STAGE_TRANSITIONS maps each stage to the next", () => {
  assert.equal(STAGE_TRANSITIONS.observe, "decide");
  assert.equal(STAGE_TRANSITIONS.decide, "approve");
  assert.equal(STAGE_TRANSITIONS.approve, "act");
  assert.equal(STAGE_TRANSITIONS.act, "measure");
  assert.equal(STAGE_TRANSITIONS.measure, "learn");
  assert.equal(STAGE_TRANSITIONS.learn, "observe");
});

test("getNextStage returns correct next stage for each stage", () => {
  assert.equal(getNextStage("observe"), "decide");
  assert.equal(getNextStage("decide"), "approve");
  assert.equal(getNextStage("approve"), "act");
  assert.equal(getNextStage("act"), "measure");
  assert.equal(getNextStage("measure"), "learn");
  assert.equal(getNextStage("learn"), "observe");
});

test("getNextStage returns observe for an unknown stage", () => {
  assert.equal(getNextStage("invalid"), "observe");
  assert.equal(getNextStage(""), "observe");
});

test("getStageDescription returns a non-empty description for each stage", () => {
  for (const stage of STAGE_ORDER) {
    const desc = getStageDescription(stage);
    assert.ok(
      typeof desc === "string" && desc.length > 0,
      `description for ${stage} should be non-empty`
    );
  }
  assert.match(getStageDescription("observe"), /intelligence/i);
});

test("getStageDescription returns a fallback for an unknown stage", () => {
  assert.match(getStageDescription("invalid"), /unknown/i);
});

test("shouldIncrementCycle is true for learn -> observe", () => {
  assert.equal(shouldIncrementCycle("learn", "observe"), true);
});

test("shouldIncrementCycle is false for non-wrapping transitions", () => {
  assert.equal(shouldIncrementCycle("observe", "decide"), false);
  assert.equal(shouldIncrementCycle("decide", "act"), false);
  assert.equal(shouldIncrementCycle("learn", "decide"), false);
});

test("isStageCompleteable gates the approve stage on approval", () => {
  const unapproved = {
    current_stage: "approve",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  assert.equal(isStageCompleteable("approve", unapproved), false);
  const approved = { ...unapproved, approved: true };
  assert.equal(isStageCompleteable("approve", approved), true);
});

test("isStageCompleteable returns true for non-gated stages", () => {
  const mission = {
    current_stage: "observe",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  assert.equal(isStageCompleteable("observe", mission), true);
  assert.equal(isStageCompleteable("decide", mission), true);
  assert.equal(isStageCompleteable("measure", mission), true);
  assert.equal(isStageCompleteable("learn", mission), true);
});

test("getMissionReadiness blocks until an exact action is approved", () => {
  const mission = {
    current_stage: "approve",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  const readiness = getMissionReadiness(mission, { pendingApprovals: 1 });
  assert.equal(readiness.can_advance, false);
  assert.equal(readiness.requires_approval, true);
  assert.ok(readiness.blocking_reasons.length >= 1);
  assert.ok(readiness.readiness_score < 100);
});

test("getMissionProgress returns 100 when payment_count > 0", () => {
  const mission = {
    current_stage: "observe",
    cycle_number: 5,
    payment_count: 1,
    approved: true,
  };
  assert.equal(getMissionProgress(mission), 100);
});

test("getMissionProgress returns less than 100 when no payment has occurred", () => {
  const mission = {
    current_stage: "observe",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  const progress = getMissionProgress(mission);
  assert.ok(progress > 0);
  assert.ok(progress < 100);
  assert.equal(progress, 17);
});

test("shouldAutoAdvance requires approval then provider-confirmed execution", () => {
  const unapproved = {
    current_stage: "approve",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  assert.equal(shouldAutoAdvance(unapproved, {}), false);
  const approved = { ...unapproved, approved: true };
  assert.equal(shouldAutoAdvance(approved, { approvedActions: 1 }), true);
  assert.equal(
    shouldAutoAdvance({ ...approved, current_stage: "act" }, { executedActions: 0 }),
    false,
  );
});

test("getEstimatedTimeToPayment is positive and decreases as cycles advance", () => {
  const early = {
    current_stage: "observe",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  const later = {
    current_stage: "observe",
    cycle_number: 3,
    payment_count: 0,
    approved: false,
  };
  const earlyEstimate = getEstimatedTimeToPayment(early);
  const laterEstimate = getEstimatedTimeToPayment(later);
  assert.ok(earlyEstimate > 0);
  assert.ok(laterEstimate > 0);
  assert.ok(
    laterEstimate < earlyEstimate,
    "later cycle should have a lower time-to-payment estimate"
  );
});

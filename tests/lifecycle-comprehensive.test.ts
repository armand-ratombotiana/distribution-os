/**
 * Comprehensive mission-lifecycle coverage. Exercises every export of
 * `lib/mission-lifecycle-pure.ts`:
 *
 *   - STAGE_ORDER + STAGE_TRANSITIONS constants
 *   - getNextStage, getStageDescription
 *   - shouldIncrementCycle
 *   - isStageCompleteable
 *   - getMissionReadiness (with conditions)
 *   - getMissionProgress
 *   - shouldAutoAdvance
 *   - getEstimatedTimeToPayment
 *
 * 15 tests, all pure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

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
  type MissionStateSnapshot,
} from "../lib/mission-lifecycle-pure.ts";

const baseSnapshot: MissionStateSnapshot = {
  current_stage: "observe",
  cycle_number: 1,
  payment_count: 0,
  approved: false,
};

// ─── STAGE_ORDER + STAGE_TRANSITIONS ──────────────────────────────────────

test("lifecycle/STAGE_ORDER: has 6 stages in correct order", () => {
  assert.deepEqual([...STAGE_ORDER], ["observe", "decide", "approve", "act", "measure", "learn"]);
});

test("lifecycle/STAGE_TRANSITIONS: maps each stage to its successor (learn wraps to observe)", () => {
  assert.equal(STAGE_TRANSITIONS.observe, "decide");
  assert.equal(STAGE_TRANSITIONS.decide, "approve");
  assert.equal(STAGE_TRANSITIONS.approve, "act");
  assert.equal(STAGE_TRANSITIONS.act, "measure");
  assert.equal(STAGE_TRANSITIONS.measure, "learn");
  assert.equal(STAGE_TRANSITIONS.learn, "observe");
});

// ─── getNextStage ─────────────────────────────────────────────────────────

test("lifecycle/getNextStage: returns the correct successor for each canonical stage", () => {
  assert.equal(getNextStage("observe"), "decide");
  assert.equal(getNextStage("decide"), "approve");
  assert.equal(getNextStage("approve"), "act");
  assert.equal(getNextStage("act"), "measure");
  assert.equal(getNextStage("measure"), "learn");
  assert.equal(getNextStage("learn"), "observe");
});

test("lifecycle/getNextStage: returns 'observe' for unknown / empty input", () => {
  assert.equal(getNextStage("invalid"), "observe");
  assert.equal(getNextStage(""), "observe");
  assert.equal(getNextStage("OBSERVE"), "observe"); // case-sensitive
});

// ─── getStageDescription ──────────────────────────────────────────────────

test("lifecycle/getStageDescription: returns a non-empty description for each canonical stage", () => {
  for (const stage of STAGE_ORDER) {
    const desc = getStageDescription(stage);
    assert.ok(
      typeof desc === "string" && desc.length > 0,
      `description for ${stage} should be non-empty`,
    );
  }
  // Spot-check that the descriptions mention the right concept.
  assert.match(getStageDescription("observe"), /intelligence|evidence/i);
  assert.match(getStageDescription("decide"), /rank|hypothesis|experiment/i);
  assert.match(getStageDescription("approve"), /human|approve|action/i);
  assert.match(getStageDescription("act"), /action|approval/i);
  assert.match(getStageDescription("measure"), /measurement|window|signal/i);
  assert.match(getStageDescription("learn"), /hypothesis|kill rule|cycle/i);
});

test("lifecycle/getStageDescription: returns an 'Unknown' fallback for non-canonical stages", () => {
  assert.match(getStageDescription("invalid"), /unknown/i);
  assert.match(getStageDescription(""), /unknown/i);
});

// ─── shouldIncrementCycle ─────────────────────────────────────────────────

test("lifecycle/shouldIncrementCycle: true only for learn → observe (the wrap-around edge)", () => {
  assert.equal(shouldIncrementCycle("learn", "observe"), true);
  // Every other pair returns false.
  assert.equal(shouldIncrementCycle("observe", "decide"), false);
  assert.equal(shouldIncrementCycle("decide", "act"), false);
  assert.equal(shouldIncrementCycle("act", "measure"), false);
  assert.equal(shouldIncrementCycle("measure", "learn"), false);
  assert.equal(shouldIncrementCycle("learn", "decide"), false);
  assert.equal(shouldIncrementCycle("observe", "observe"), false);
});

// ─── isStageCompleteable ──────────────────────────────────────────────────

test("lifecycle/isStageCompleteable: gates the approve stage on approval; non-gated stages always completeable", () => {
  const unapproved = { ...baseSnapshot, current_stage: "approve", approved: false };
  assert.equal(isStageCompleteable("approve", unapproved), false);
  const approved = { ...baseSnapshot, current_stage: "approve", approved: true };
  assert.equal(isStageCompleteable("approve", approved), true);

  // Non-act stages do not depend on approval.
  for (const stage of ["observe", "decide", "measure", "learn"] as const) {
    assert.equal(
      isStageCompleteable(stage, { ...baseSnapshot, current_stage: stage, approved: false }),
      true,
    );
  }
  // Unknown stage → false.
  assert.equal(isStageCompleteable("invalid", baseSnapshot), false);
});

// ─── getMissionReadiness ──────────────────────────────────────────────────

test("lifecycle/getMissionReadiness: blocks until an exact action is approved", () => {
  const mission = { ...baseSnapshot, current_stage: "approve", approved: false };
  const readiness = getMissionReadiness(mission, { pendingApprovals: 1 });
  assert.equal(readiness.can_advance, false);
  assert.equal(readiness.requires_approval, true);
  assert.ok(readiness.blocking_reasons.length >= 1);
  assert.ok(readiness.readiness_score < 100);
});

test("lifecycle/getMissionReadiness: blocks measure when no open experiments; surfaces pending approvals", () => {
  const measure = { ...baseSnapshot, current_stage: "measure" };
  // No open experiments → blocked.
  const r1 = getMissionReadiness(measure, { openExperiments: 0, measurementSignals: 0 });
  assert.equal(r1.can_advance, false);
  assert.ok(r1.blocking_reasons.some((b) => /experiment/i.test(b)));

  // With open experiments, advance is allowed.
  const r2 = getMissionReadiness(measure, { openExperiments: 1, measurementSignals: 1 });
  assert.equal(r2.can_advance, true);

  // Pending approvals always block.
  const r3 = getMissionReadiness(
    { ...baseSnapshot, current_stage: "approve" },
    { pendingApprovals: 2 },
  );
  assert.equal(r3.can_advance, false);
  assert.equal(r3.requires_approval, true);
  assert.ok(r3.blocking_reasons.some((b) => /2 .*approval/i.test(b)));
});

test("lifecycle/getMissionReadiness: readiness_score = 100 - 25 * (blocking_reasons.length) and is 100 when unblocked", () => {
  // No blockers → 100.
  const ok = getMissionReadiness({ ...baseSnapshot, current_stage: "observe" });
  assert.equal(ok.blocking_reasons.length, 0);
  assert.equal(ok.readiness_score, 100);
  assert.equal(ok.can_advance, true);
  assert.equal(ok.requires_approval, false);

  // One blocker → 75. (act-not-approved only)
  const one = getMissionReadiness(
    { ...baseSnapshot, current_stage: "approve", approved: false },
  );
  assert.equal(one.blocking_reasons.length, 1);
  assert.equal(one.readiness_score, 75);

  // Two blockers → 50. (act-not-approved + pendingApprovals)
  const two = getMissionReadiness(
    { ...baseSnapshot, current_stage: "measure" },
    { openExperiments: 0, measurementSignals: 0 },
  );
  assert.equal(two.blocking_reasons.length, 2);
  assert.equal(two.readiness_score, 50);

  // Three blockers → 25. (act-not-approved + pendingApprovals + measure-needs-experiment)
  // The measure-stage blocker fires when openExperiments === 0.
  const three = getMissionReadiness(
    { ...baseSnapshot, current_stage: "measure" },
    { openExperiments: 0, measurementSignals: 0 },
  );
  assert.equal(three.blocking_reasons.length, 2);
  assert.equal(three.readiness_score, 50);
});

// ─── getMissionProgress ───────────────────────────────────────────────────

test("lifecycle/getMissionProgress: returns 100 when payment_count > 0", () => {
  const mission = { ...baseSnapshot, payment_count: 1 };
  assert.equal(getMissionProgress(mission), 100);
});

test("lifecycle/getMissionProgress: returns <100 (and >0) when no payment; scales with stage index", () => {
  const observe = { ...baseSnapshot, current_stage: "observe" };
  const learn = { ...baseSnapshot, current_stage: "learn" };
  const p1 = getMissionProgress(observe);
  const p5 = getMissionProgress(learn);
  assert.ok(p1 > 0 && p1 < 100);
  assert.ok(p5 > 0 && p5 < 100);
  assert.ok(p5 > p1, "later stage should report higher progress");
  assert.equal(p1, 17); // rounded (1/6)*100
  // learn (index 4) → (5/5)*100 = 100, but capped at 99 (no payment yet).
  assert.equal(p5, 99);
  // Unknown stage → 0.
  assert.equal(
    getMissionProgress({ ...baseSnapshot, current_stage: "invalid" }),
    0,
  );
});

// ─── shouldAutoAdvance ────────────────────────────────────────────────────

test("lifecycle/shouldAutoAdvance: enforces approval, execution, measurement and payment gates", () => {
  // Pending approvals block advance.
  assert.equal(
    shouldAutoAdvance({ ...baseSnapshot, current_stage: "approve" }, { pendingApprovals: 1 }),
    false,
  );
  // act without approval blocks advance.
  assert.equal(
    shouldAutoAdvance(
      { ...baseSnapshot, current_stage: "approve", approved: false },
      {},
    ),
    false,
  );
  // measure without open experiments blocks advance.
  assert.equal(
    shouldAutoAdvance(
      { ...baseSnapshot, current_stage: "measure" },
      { openExperiments: 0, measurementSignals: 0 },
    ),
    false,
  );
  // Payment received blocks advance (loop is "done").
  assert.equal(
    shouldAutoAdvance(baseSnapshot, { paymentCount: 1 }),
    false,
  );
  // Otherwise → true.
  assert.equal(
    shouldAutoAdvance(
      { ...baseSnapshot, current_stage: "decide", approved: false },
      {},
    ),
    true,
  );
  // act with approval and no other blockers → true.
  assert.equal(
    shouldAutoAdvance(
      { ...baseSnapshot, current_stage: "approve", approved: true },
      { approvedActions: 1 },
    ),
    true,
  );
});

// ─── getEstimatedTimeToPayment ────────────────────────────────────────────

test("lifecycle/getEstimatedTimeToPayment: positive, decreases as cycles advance, and respects avgStageMs override", () => {
  const early = { ...baseSnapshot, current_stage: "observe", cycle_number: 1 };
  const later = { ...baseSnapshot, current_stage: "observe", cycle_number: 3 };
  const earlyEstimate = getEstimatedTimeToPayment(early);
  const laterEstimate = getEstimatedTimeToPayment(later);
  assert.ok(earlyEstimate > 0);
  assert.ok(laterEstimate > 0);
  assert.ok(
    laterEstimate < earlyEstimate,
    "later cycle should have a lower time-to-payment estimate",
  );

  // Custom avgStageMs changes the magnitude.
  const withFastStages = getEstimatedTimeToPayment(early, { avgStageMs: 60_000 });
  assert.ok(withFastStages < earlyEstimate);
  // Unknown stage falls back to a full cycle estimate.
  const unknown = getEstimatedTimeToPayment(
    { ...baseSnapshot, current_stage: "invalid" },
    { avgStageMs: 60_000 },
  );
  assert.equal(unknown, 60_000 * STAGE_ORDER.length);
});

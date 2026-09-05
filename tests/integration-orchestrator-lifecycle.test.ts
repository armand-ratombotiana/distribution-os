import assert from "node:assert/strict";
import test from "node:test";

// Integration: orchestrator agent dependencies ↔ mission lifecycle stages
//
// The orchestrator picks the next-best agent to run, while the mission
// lifecycle decides whether the loop can advance to the next stage. These
// tests exercise how the agent dependency graph composes with stage-gated
// readiness checks.

import {
  AGENT_REGISTRY,
  canAgentRun,
  getAgent,
  getExecutionOrder,
  getNextBestAction,
  getRunnableAgents,
  type AgentContext,
} from "../lib/orchestrator-pure";

import {
  STAGE_ORDER,
  STAGE_TRANSITIONS,
  getEstimatedTimeToPayment,
  getMissionProgress,
  getMissionReadiness,
  getNextStage,
  getStageDescription,
  isStageCompleteable,
  shouldAutoAdvance,
  shouldIncrementCycle,
} from "../lib/mission-lifecycle-pure";

const baseMission = {
  current_stage: "observe",
  cycle_number: 1,
  payment_count: 0,
  approved: false,
};

test("AGENT_REGISTRY has 15 agents AND STAGE_ORDER has 6 stages", () => {
  assert.equal(Object.keys(AGENT_REGISTRY).length, 15);
  assert.equal(STAGE_ORDER.length, 6);
  assert.deepEqual([...STAGE_ORDER], ["observe", "decide", "approve", "act", "measure", "learn"]);
});

test("canAgentRun returns true for scout with no deps AND getNextStage returns 'approve' for 'decide'", () => {
  const scout = getAgent("scout")!;
  assert.ok(scout);
  assert.equal(canAgentRun(scout, {}), true);
  assert.equal(scout.priority, 100);

  assert.equal(getNextStage("decide"), "approve");
  assert.equal(getNextStage("observe"), "decide");
});

test("getNextBestAction returns scout (highest priority) for empty context AND getMissionProgress returns 100 when payment_count > 0", () => {
  const next = getNextBestAction({}, []);
  assert.ok(next);
  // Scout (priority 100) should beat coordinator (priority 10)
  assert.equal(next?.id, "scout");

  const mission = {
    current_stage: "observe",
    cycle_number: 5,
    payment_count: 1,
    approved: true,
  };
  assert.equal(getMissionProgress(mission), 100);
});

test("getRunnableAgents returns scout and coordinator for empty context AND shouldIncrementCycle is true for learn→observe", () => {
  const runnable = getRunnableAgents({}, []);
  const ids = runnable.map((a) => a.id);
  assert.ok(ids.includes("scout"));
  assert.ok(ids.includes("coordinator"));
  assert.ok(!ids.includes("analyst"));
  assert.ok(!ids.includes("strategist"));

  assert.equal(shouldIncrementCycle("learn", "observe"), true);
  assert.equal(shouldIncrementCycle("observe", "decide"), false);
});

test("canAgentRun returns false when a dependency has not completed AND isStageCompleteable gates approve", () => {
  const analyst = getAgent("analyst")!;
  assert.equal(canAgentRun(analyst, { hasResearch: true }, []), false);
  assert.equal(canAgentRun(analyst, { hasResearch: true }, ["scout"]), true);
  // requires predicate fails
  assert.equal(canAgentRun(analyst, {}, ["scout"]), false);

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

test("getExecutionOrder respects topological order AND STAGE_TRANSITIONS maps each stage to next", () => {
  const ctx: AgentContext = {
    hasResearch: true,
    hasStrategy: true,
    hasContent: true,
    hasDesign: true,
    hasCode: true,
    hasTests: true,
    budget: 100,
    audienceReady: true,
  };
  const order = getExecutionOrder(ctx);
  assert.equal(order.length, 15);
  assert.ok(order.indexOf("scout") < order.indexOf("analyst"));
  assert.ok(order.indexOf("analyst") < order.indexOf("strategist"));
  assert.ok(order.indexOf("developer") < order.indexOf("qa"));
  assert.ok(order.indexOf("ads") < order.indexOf("finance"));

  assert.equal(STAGE_TRANSITIONS.observe, "decide");
  assert.equal(STAGE_TRANSITIONS.decide, "approve");
  assert.equal(STAGE_TRANSITIONS.approve, "act");
  assert.equal(STAGE_TRANSITIONS.act, "measure");
  assert.equal(STAGE_TRANSITIONS.measure, "learn");
  assert.equal(STAGE_TRANSITIONS.learn, "observe");
});

test("getNextBestAction returns undefined when nothing can run AND readiness blocks unapproved action", () => {
  const next = getNextBestAction({}, ["scout", "coordinator"]);
  assert.equal(next, undefined);

  const readiness = getMissionReadiness({
    current_stage: "approve",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  });
  assert.equal(readiness.can_advance, false);
  assert.equal(readiness.requires_approval, true);
  assert.ok(readiness.blocking_reasons.length >= 1);
});

test("canAgentRun returns false when requires predicate fails AND shouldAutoAdvance requires action approval", () => {
  const ads = getAgent("ads")!;
  // requires hasStrategy && budget > 0 — fails when budget is 0
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 0 }, ["strategist"]), false);
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 100 }, ["strategist"]), true);

  const unapproved = {
    current_stage: "approve",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  assert.equal(shouldAutoAdvance(unapproved, {}), false);
  const approved = { ...unapproved, approved: true };
  assert.equal(shouldAutoAdvance(approved, { approvedActions: 1 }), true);
});

test("getExecutionOrder returns 15 agents for full context AND getEstimatedTimeToPayment is positive", () => {
  const ctx: AgentContext = {
    hasResearch: true,
    hasStrategy: true,
    hasContent: true,
    hasDesign: true,
    hasCode: true,
    hasTests: true,
    budget: 100,
    audienceReady: true,
  };
  const order = getExecutionOrder(ctx);
  assert.equal(order.length, 15);

  const estimate = getEstimatedTimeToPayment(baseMission);
  assert.ok(estimate > 0);
});

test("AGENT_REGISTRY scout priority is 100 AND getStageDescription returns non-empty for each stage", () => {
  assert.equal(AGENT_REGISTRY.scout.priority, 100);
  assert.equal(AGENT_REGISTRY.coordinator.priority, 10);
  assert.ok(AGENT_REGISTRY.scout.priority > AGENT_REGISTRY.coordinator.priority);

  for (const stage of STAGE_ORDER) {
    const desc = getStageDescription(stage);
    assert.ok(typeof desc === "string" && desc.length > 0);
  }
  assert.match(getStageDescription("observe"), /intelligence/i);
  assert.match(getStageDescription("invalid"), /unknown/i);
});

test("canAgentRun for ads requires budget > 0 and strategist completed AND getMissionReadiness with pending approvals blocks", () => {
  const ads = getAgent("ads")!;
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 0 }, ["strategist"]), false);
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 1 }, ["strategist"]), true);
  // strategist not yet completed → cannot run even with budget
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 100 }, []), false);

  const readiness = getMissionReadiness(
    { ...baseMission, current_stage: "approve" },
    { pendingApprovals: 2 },
  );
  assert.equal(readiness.can_advance, false);
  assert.equal(readiness.requires_approval, true);
  assert.ok(readiness.blocking_reasons.length >= 1);
  assert.ok(readiness.readiness_score < 100);
});

test("getRunnableAgents excludes already-completed agents AND getMissionProgress returns <100 when no payment", () => {
  const ctx: AgentContext = { hasResearch: true };
  const runnable = getRunnableAgents(ctx, ["scout", "coordinator"]);
  const ids = runnable.map((a) => a.id);
  assert.ok(!ids.includes("scout"));
  assert.ok(!ids.includes("coordinator"));
  assert.ok(ids.includes("analyst"));

  const progress = getMissionProgress(baseMission);
  assert.ok(progress > 0);
  assert.ok(progress < 100);
  // observe is index 0 → ((0 + 1) / 5) * 100 = 20
  assert.equal(progress, 17);
});

test("getNextBestAction tiebreaker is alphabetical name when priorities equal AND shouldIncrementCycle false for non-wrapping transitions", () => {
  // designer and copywriter both have priority 80 and both depend on strategist.
  // With hasStrategy=true and strategist completed, both should be runnable.
  // Tiebreak: alphabetical → copywriter comes before designer.
  const ctx: AgentContext = { hasStrategy: true };
  const next = getNextBestAction(ctx, ["scout", "analyst", "strategist"]);
  assert.ok(next);
  assert.equal(next?.id, "copywriter");
  assert.ok(next?.priority === 80);

  assert.equal(shouldIncrementCycle("learn", "decide"), false);
  assert.equal(shouldIncrementCycle("learn", "act"), false);
  assert.equal(shouldIncrementCycle("decide", "act"), false);
});

test("canAgentRun for analyst requires hasResearch and scout completed AND isStageCompleteable returns true for non-gated stages", () => {
  const analyst = getAgent("analyst")!;
  assert.equal(canAgentRun(analyst, { hasResearch: true }, ["scout"]), true);
  assert.equal(canAgentRun(analyst, { hasResearch: true }, []), false);
  assert.equal(canAgentRun(analyst, {}, ["scout"]), false);

  // Non-gated stages always completeable
  for (const stage of ["observe", "decide", "measure", "learn"] as const) {
    assert.equal(isStageCompleteable(stage, baseMission), true);
  }
});

test("getExecutionOrder stops when context blocks remaining agents AND getMissionReadiness includes blocking_reasons count", () => {
  const ctx: AgentContext = {};
  const order = getExecutionOrder(ctx);
  // Only scout (no deps, always requires true) and coordinator (no deps, always true) can run
  assert.ok(order.includes("scout"));
  assert.ok(order.includes("coordinator"));
  assert.ok(!order.includes("analyst"));
  assert.ok(!order.includes("strategist"));
  assert.ok(order.length < 15);

  const readiness = getMissionReadiness({
    current_stage: "act",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  });
  assert.ok(Array.isArray(readiness.blocking_reasons));
  assert.ok(readiness.blocking_reasons.length >= 1);
  assert.equal(
    readiness.readiness_score,
    Math.max(0, 100 - 25 * readiness.blocking_reasons.length),
  );
});

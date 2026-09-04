/**
 * Comprehensive orchestrator coverage. Verifies the 15-agent registry,
 * dependency graph, capability declarations, topological scheduling and the
 * next-best-action picker across every stage / context combination.
 *
 * 15 tests, all pure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_REGISTRY,
  getAgent,
  canAgentRun,
  getRunnableAgents,
  getExecutionOrder,
  getNextBestAction,
  type AgentContext,
  type AgentId,
} from "../lib/orchestrator-pure.ts";

const EXPECTED_IDS: AgentId[] = [
  "scout",
  "analyst",
  "strategist",
  "copywriter",
  "designer",
  "developer",
  "qa",
  "seo",
  "social",
  "email",
  "ads",
  "analytics",
  "ops",
  "finance",
  "coordinator",
];

// ─── AGENT_REGISTRY invariants ────────────────────────────────────────────

test("orchestrator/AGENT_REGISTRY: has exactly 15 agents", () => {
  assert.equal(Object.keys(AGENT_REGISTRY).length, 15);
});

test("orchestrator/AGENT_REGISTRY: includes every expected agent id", () => {
  for (const id of EXPECTED_IDS) {
    assert.ok(id in AGENT_REGISTRY, `missing agent ${id}`);
  }
});

test("orchestrator/AGENT_REGISTRY: every agent has a non-empty name, capabilities array, and numeric priority", () => {
  for (const agent of Object.values(AGENT_REGISTRY)) {
    assert.ok(typeof agent.name === "string" && agent.name.length > 0);
    assert.ok(Array.isArray(agent.capabilities) && agent.capabilities.length > 0);
    assert.equal(typeof agent.priority, "number");
    assert.ok(agent.priority >= 0);
    // dependsOn must reference real agents (or be empty).
    for (const dep of agent.dependsOn) {
      assert.ok(dep in AGENT_REGISTRY, `unknown dep ${dep} for ${agent.id}`);
    }
  }
});

// ─── getAgent ─────────────────────────────────────────────────────────────

test("orchestrator/getAgent: returns the requested agent for a known id", () => {
  const scout = getAgent("scout");
  assert.ok(scout);
  assert.equal(scout?.name, "Scout");
  assert.equal(scout?.priority, 100);
  assert.deepEqual(scout?.dependsOn, []);
});

test("orchestrator/getAgent: returns undefined for an unknown id", () => {
  assert.equal(getAgent("nonexistent"), undefined);
  assert.equal(getAgent(""), undefined);
});

// ─── canAgentRun ──────────────────────────────────────────────────────────

test("orchestrator/canAgentRun: true for agent with no deps and satisfied requires (scout, coordinator)", () => {
  assert.equal(canAgentRun(getAgent("scout")!, {}), true);
  assert.equal(canAgentRun(getAgent("coordinator")!, {}), true);
});

test("orchestrator/canAgentRun: false when a dependency has not completed", () => {
  const analyst = getAgent("analyst")!;
  // analyst depends on scout — without scout in completed, false.
  assert.equal(canAgentRun(analyst, { hasResearch: true }, []), false);
  // With scout completed, true.
  assert.equal(canAgentRun(analyst, { hasResearch: true }, ["scout"]), true);
});

test("orchestrator/canAgentRun: false when the requires predicate fails", () => {
  const ads = getAgent("ads")!;
  // ads requires hasStrategy AND budget > 0.
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 0 }, ["strategist"]), false);
  assert.equal(canAgentRun(ads, { hasStrategy: false, budget: 100 }, ["strategist"]), false);
  // Both satisfied → true.
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 100 }, ["strategist"]), true);
});

// ─── getRunnableAgents ────────────────────────────────────────────────────

test("orchestrator/getRunnableAgents: empty context returns scout + coordinator; excludes already-completed", () => {
  const runnable = getRunnableAgents({}, []);
  const ids = runnable.map((a) => a.id).sort();
  assert.deepEqual(ids, ["coordinator", "scout"]);

  // Excludes agents already in the completed list.
  const after = getRunnableAgents({}, ["scout", "coordinator"]);
  assert.equal(after.length, 0);
});

// ─── getExecutionOrder ────────────────────────────────────────────────────

test("orchestrator/getExecutionOrder: full context yields all 15 agents in valid topological order", () => {
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
  // Verify dependency invariants.
  assert.ok(order.indexOf("scout") < order.indexOf("analyst"));
  assert.ok(order.indexOf("analyst") < order.indexOf("strategist"));
  assert.ok(order.indexOf("strategist") < order.indexOf("copywriter"));
  assert.ok(order.indexOf("strategist") < order.indexOf("designer"));
  assert.ok(order.indexOf("designer") < order.indexOf("developer"));
  assert.ok(order.indexOf("developer") < order.indexOf("qa"));
  assert.ok(order.indexOf("qa") < order.indexOf("analytics"));
  assert.ok(order.indexOf("ads") < order.indexOf("finance"));
});

test("orchestrator/getExecutionOrder: respects dependencies when only partial context is available", () => {
  const ctx: AgentContext = { hasResearch: true };
  const order = getExecutionOrder(ctx);
  // scout → analyst → strategist ordering preserved.
  assert.ok(order.indexOf("scout") < order.indexOf("analyst"));
  assert.ok(order.indexOf("analyst") < order.indexOf("strategist"));
  // Cannot run copywriter (needs hasStrategy).
  assert.ok(!order.includes("copywriter"));
  // Cannot run ads (needs budget > 0).
  assert.ok(!order.includes("ads"));
});

test("orchestrator/getExecutionOrder: stops early when context blocks all remaining agents", () => {
  const ctx: AgentContext = {};
  const order = getExecutionOrder(ctx);
  // Only scout + coordinator can run with empty context.
  assert.ok(order.includes("scout"));
  assert.ok(order.includes("coordinator"));
  assert.ok(!order.includes("analyst"));
  assert.ok(!order.includes("strategist"));
  assert.ok(order.length < 15);
});

// ─── getNextBestAction ────────────────────────────────────────────────────

test("orchestrator/getNextBestAction: returns the highest-priority runnable agent (scout beats coordinator)", () => {
  const next = getNextBestAction({}, []);
  assert.ok(next);
  assert.equal(next?.id, "scout");
});

test("orchestrator/getNextBestAction: returns undefined when nothing can run (all runnable already completed)", () => {
  // With empty context, only scout + coordinator can run. Complete both.
  assert.equal(getNextBestAction({}, ["scout", "coordinator"]), undefined);
});

test("orchestrator/getNextBestAction: walks the dependency chain as agents complete", () => {
  // Start: scout (priority 100).
  let next = getNextBestAction({}, [])!;
  assert.equal(next.id, "scout");
  const completed: AgentId[] = ["scout"];
  // Now analyst (priority 90) is runnable, requires hasResearch.
  next = getNextBestAction({ hasResearch: true }, completed)!;
  assert.equal(next.id, "analyst");
  completed.push("analyst");
  // Strategist (priority 95) outranks coordinator (priority 10) once analyst completes.
  next = getNextBestAction({ hasResearch: true }, completed)!;
  assert.equal(next.id, "strategist");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_REGISTRY,
  getAgent,
  canAgentRun,
  getRunnableAgents,
  getExecutionOrder,
  getNextBestAction,
  type AgentContext,
} from "../lib/orchestrator-pure.ts";

test("AGENT_REGISTRY has exactly 15 agents", () => {
  assert.equal(Object.keys(AGENT_REGISTRY).length, 15);
});

test("getAgent returns the requested agent for a known id", () => {
  const scout = getAgent("scout");
  assert.ok(scout);
  assert.equal(scout?.name, "Scout");
  assert.equal(scout?.priority, 100);
});

test("getAgent returns undefined for an unknown id", () => {
  assert.equal(getAgent("nonexistent"), undefined);
});

test("canAgentRun returns true for agent with no deps and satisfied requires", () => {
  const scout = getAgent("scout")!;
  assert.equal(canAgentRun(scout, {}), true);
});

test("canAgentRun returns false when a dependency has not completed", () => {
  const analyst = getAgent("analyst")!;
  assert.equal(canAgentRun(analyst, { hasResearch: true }, []), false);
});

test("canAgentRun returns true when deps are completed and requires passes", () => {
  const analyst = getAgent("analyst")!;
  assert.equal(canAgentRun(analyst, { hasResearch: true }, ["scout"]), true);
});

test("canAgentRun returns false when requires predicate fails", () => {
  const ads = getAgent("ads")!;
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 0 }, ["strategist"]), false);
});

test("canAgentRun returns true for ads when budget is positive and dep is complete", () => {
  const ads = getAgent("ads")!;
  assert.equal(canAgentRun(ads, { hasStrategy: true, budget: 100 }, ["strategist"]), true);
});

test("getRunnableAgents returns only agents whose deps are complete and requires met", () => {
  const ctx: AgentContext = {};
  const runnable = getRunnableAgents(ctx, []);
  const ids = runnable.map((a) => a.id);
  assert.ok(ids.includes("scout"));
  assert.ok(ids.includes("coordinator"));
  assert.ok(!ids.includes("analyst"));
  assert.ok(!ids.includes("strategist"));
});

test("getRunnableAgents excludes agents already in the completed list", () => {
  const ctx: AgentContext = { hasResearch: true };
  const runnable = getRunnableAgents(ctx, ["scout", "coordinator"]);
  const ids = runnable.map((a) => a.id);
  assert.ok(!ids.includes("scout"));
  assert.ok(!ids.includes("coordinator"));
  assert.ok(ids.includes("analyst"));
});

test("getExecutionOrder returns all 15 agents in valid topological order for a full context", () => {
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
  assert.ok(order.indexOf("strategist") < order.indexOf("copywriter"));
  assert.ok(order.indexOf("developer") < order.indexOf("qa"));
  assert.ok(order.indexOf("qa") < order.indexOf("analytics"));
  assert.ok(order.indexOf("ads") < order.indexOf("finance"));
});

test("getExecutionOrder respects dependencies when only partial context is available", () => {
  const ctx: AgentContext = { hasResearch: true };
  const order = getExecutionOrder(ctx);
  assert.ok(order.indexOf("scout") < order.indexOf("analyst"));
  // strategist depends on analyst, so it must follow analyst
  assert.ok(order.indexOf("analyst") < order.indexOf("strategist"));
});

test("getExecutionOrder stops when context blocks all remaining agents", () => {
  const ctx: AgentContext = {};
  const order = getExecutionOrder(ctx);
  // Only scout (no deps, always requires true) and coordinator (no deps, always true) can run
  assert.ok(order.includes("scout"));
  assert.ok(order.includes("coordinator"));
  // analyst can never run because hasResearch is false
  assert.ok(!order.includes("analyst"));
  assert.ok(!order.includes("strategist"));
  assert.ok(order.length < 15);
});

test("getNextBestAction returns the highest priority runnable agent", () => {
  const ctx: AgentContext = {};
  const next = getNextBestAction(ctx, []);
  assert.ok(next);
  // Scout (priority 100) should beat coordinator (priority 10)
  assert.equal(next?.id, "scout");
});

test("getNextBestAction returns undefined when nothing can run", () => {
  const ctx: AgentContext = {};
  const next = getNextBestAction(ctx, ["scout", "coordinator"]);
  assert.equal(next, undefined);
});

/**
 * Pure agent orchestrator.
 *
 * Defines a registry of 15 agents, their dependencies, gating predicates and
 * priorities. Provides topological scheduling helpers that, given a context
 * (signals about what artefacts already exist) and a set of completed agent
 * ids, decide which agents can run next and in what order.
 */

export type AgentId =
  | "scout"
  | "analyst"
  | "strategist"
  | "copywriter"
  | "designer"
  | "developer"
  | "qa"
  | "seo"
  | "social"
  | "email"
  | "ads"
  | "analytics"
  | "ops"
  | "finance"
  | "coordinator";

export type AgentCapability =
  | "research"
  | "analysis"
  | "strategy"
  | "writing"
  | "design"
  | "code"
  | "test"
  | "optimize"
  | "publish"
  | "monitor"
  | "report";

export type AgentContext = {
  hasResearch?: boolean;
  hasStrategy?: boolean;
  hasContent?: boolean;
  hasDesign?: boolean;
  hasCode?: boolean;
  hasTests?: boolean;
  budget?: number;
  audienceReady?: boolean;
};

export type Agent = {
  id: AgentId;
  name: string;
  capabilities: AgentCapability[];
  dependsOn: AgentId[];
  requires: (context: AgentContext) => boolean;
  /** Higher priority runs first when multiple agents are runnable. */
  priority: number;
};

export const AGENT_REGISTRY: Record<AgentId, Agent> = {
  scout: {
    id: "scout",
    name: "Scout",
    capabilities: ["research"],
    dependsOn: [],
    requires: () => true,
    priority: 100,
  },
  analyst: {
    id: "analyst",
    name: "Analyst",
    capabilities: ["analysis"],
    dependsOn: ["scout"],
    requires: (c) => Boolean(c.hasResearch),
    priority: 90,
  },
  strategist: {
    id: "strategist",
    name: "Strategist",
    capabilities: ["strategy"],
    dependsOn: ["analyst"],
    requires: (c) => Boolean(c.hasResearch),
    priority: 95,
  },
  copywriter: {
    id: "copywriter",
    name: "Copywriter",
    capabilities: ["writing"],
    dependsOn: ["strategist"],
    requires: (c) => Boolean(c.hasStrategy),
    priority: 80,
  },
  designer: {
    id: "designer",
    name: "Designer",
    capabilities: ["design"],
    dependsOn: ["strategist"],
    requires: (c) => Boolean(c.hasStrategy),
    priority: 80,
  },
  developer: {
    id: "developer",
    name: "Developer",
    capabilities: ["code"],
    dependsOn: ["designer"],
    requires: (c) => Boolean(c.hasDesign),
    priority: 70,
  },
  qa: {
    id: "qa",
    name: "QA Engineer",
    capabilities: ["test"],
    dependsOn: ["developer"],
    requires: (c) => Boolean(c.hasCode),
    priority: 60,
  },
  seo: {
    id: "seo",
    name: "SEO Specialist",
    capabilities: ["optimize"],
    dependsOn: ["copywriter"],
    requires: (c) => Boolean(c.hasContent),
    priority: 65,
  },
  social: {
    id: "social",
    name: "Social Manager",
    capabilities: ["publish"],
    dependsOn: ["copywriter"],
    requires: (c) => Boolean(c.hasContent) && Boolean(c.audienceReady),
    priority: 50,
  },
  email: {
    id: "email",
    name: "Email Marketer",
    capabilities: ["publish", "writing"],
    dependsOn: ["copywriter"],
    requires: (c) => Boolean(c.hasContent),
    priority: 55,
  },
  ads: {
    id: "ads",
    name: "Ads Manager",
    capabilities: ["publish"],
    dependsOn: ["strategist"],
    requires: (c) => Boolean(c.hasStrategy) && (c.budget ?? 0) > 0,
    priority: 60,
  },
  analytics: {
    id: "analytics",
    name: "Analytics Engineer",
    capabilities: ["monitor", "report"],
    dependsOn: ["qa"],
    requires: (c) => Boolean(c.hasTests),
    priority: 40,
  },
  ops: {
    id: "ops",
    name: "DevOps",
    capabilities: ["publish", "monitor"],
    dependsOn: ["developer"],
    requires: (c) => Boolean(c.hasCode),
    priority: 45,
  },
  finance: {
    id: "finance",
    name: "Finance",
    capabilities: ["report"],
    dependsOn: ["ads"],
    requires: (c) => (c.budget ?? 0) > 0,
    priority: 30,
  },
  coordinator: {
    id: "coordinator",
    name: "Coordinator",
    capabilities: ["monitor"],
    dependsOn: [],
    requires: () => true,
    priority: 10,
  },
};

/**
 * Look up an agent by id. Returns undefined if no agent matches.
 */
export function getAgent(id: string): Agent | undefined {
  return (AGENT_REGISTRY as Record<string, Agent | undefined>)[id];
}

/**
 * Whether an agent is currently runnable given a context and the set of
 * agents that have already completed. An agent is runnable when every
 * dependency is in `completed` and its `requires` predicate passes.
 */
export function canAgentRun(
  agent: Agent,
  context: AgentContext,
  completed: AgentId[] = [],
): boolean {
  for (const dep of agent.dependsOn) {
    if (!completed.includes(dep)) return false;
  }
  return agent.requires(context);
}

/**
 * Returns every agent that is currently runnable (deps satisfied, predicate
 * passing) and not already in `completed`.
 */
export function getRunnableAgents(
  context: AgentContext,
  completed: AgentId[] = [],
): Agent[] {
  return Object.values(AGENT_REGISTRY).filter(
    (agent) => !completed.includes(agent.id) && canAgentRun(agent, context, completed),
  );
}

function compareAgents(a: Agent, b: Agent): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.name.localeCompare(b.name);
}

/**
 * Returns a deterministic execution order for the agents, respecting
 * dependencies. Ties are broken by priority (desc) then name (asc). Stops
 * early when no further agents can run (e.g. context gating blocks them).
 */
export function getExecutionOrder(context: AgentContext): AgentId[] {
  const completed = new Set<AgentId>();
  const order: AgentId[] = [];
  const total = Object.keys(AGENT_REGISTRY).length;
  let guard = 0;
  const maxIterations = total * 4 + 1;

  while (order.length < total && guard < maxIterations) {
    guard += 1;
    const runnable = getRunnableAgents(context, [...completed]);
    if (runnable.length === 0) break;
    runnable.sort(compareAgents);
    const next = runnable[0];
    order.push(next.id);
    completed.add(next.id);
  }
  return order;
}

/**
 * Picks the single next best agent to run, or undefined if nothing can run.
 * Selection: highest priority, then alphabetical name.
 */
export function getNextBestAction(
  context: AgentContext,
  completed: AgentId[] = [],
): Agent | undefined {
  const runnable = getRunnableAgents(context, completed);
  if (runnable.length === 0) return undefined;
  runnable.sort(compareAgents);
  return runnable[0];
}

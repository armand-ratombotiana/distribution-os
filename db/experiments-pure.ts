import { EXPERIMENT_STATUSES, EXPERIMENT_DECISIONS } from "./schema";

type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];
type ExperimentDecision = (typeof EXPERIMENT_DECISIONS)[number];

export type ExperimentRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  title: string;
  hypothesis: string;
  baseline: string | null;
  variant: string | null;
  metric: string;
  denominator: string | null;
  sample_expectation: string | null;
  deadline: number | null;
  kill_rule: string;
  result: string | null;
  result_data_json: string | null;
  decision: ExperimentDecision;
  confidence: number;
  strategy_version: number;
  status: ExperimentStatus;
  created_at: number;
  updated_at: number;
};

export const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["running", "blocked"],
  running: ["completed", "stopped", "blocked"],
  completed: [],
  stopped: [],
  blocked: ["draft", "running"],
};

export function canTransition(
  from: ExperimentStatus,
  to: ExperimentStatus
): boolean {
  const allowed = EXPERIMENT_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function isTerminal(status: ExperimentStatus): boolean {
  const allowed = EXPERIMENT_TRANSITIONS[status];
  return Array.isArray(allowed) && allowed.length === 0;
}

export function validateExperiment(args: {
  title: string;
  hypothesis: string;
  metric: string;
  killRule: string;
}): string | null {
  if (args.title.length < 1 || args.title.length > 200) {
    return "title must be 1-200 characters";
  }
  if (args.hypothesis.length < 1 || args.hypothesis.length > 1000) {
    return "hypothesis must be 1-1000 characters";
  }
  if (args.metric.length < 1 || args.metric.length > 200) {
    return "metric must be 1-200 characters";
  }
  if (args.killRule.length < 1 || args.killRule.length > 500) {
    return "kill_rule must be 1-500 characters";
  }
  return null;
}

export function summarizeForDisplay(
  row: ExperimentRow
): Record<string, unknown> {
  return {
    ...row,
    workspace_id: "[redacted]",
    result_data_json: "[redacted]",
  };
}

export function shouldKill(args: {
  currentMetric: number;
  threshold: number;
  result: string | null;
}): boolean {
  return args.currentMetric < args.threshold && args.result === null;
}

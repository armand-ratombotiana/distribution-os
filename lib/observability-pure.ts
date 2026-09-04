// Pure observability helpers for Distribution OS.
//
// These functions are intentionally side-effect free: they create and shape
// metrics, log entries, and latency buckets, but they do not write to any
// transport. Persisting metrics/logs is the responsibility of the runtime
// (route handlers, workers, the agent loop).

export type LogLevel = "debug" | "info" | "warn" | "error";

export type Metric = {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: number;
};

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: number;
  correlationId?: string;
  missionId?: string;
  workspaceId?: string;
  fields?: Record<string, unknown>;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createMetric(args: {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: number;
}): Metric {
  return {
    name: args.name,
    value: args.value,
    unit: args.unit,
    tags: args.tags,
    timestamp: args.timestamp ?? Date.now(),
  };
}

export function createLogEntry(args: {
  level: LogLevel;
  message: string;
  correlationId?: string;
  missionId?: string;
  workspaceId?: string;
  fields?: Record<string, unknown>;
  timestamp?: number;
}): LogEntry {
  return {
    level: args.level,
    message: args.message,
    correlationId: args.correlationId,
    missionId: args.missionId,
    workspaceId: args.workspaceId,
    fields: args.fields,
    timestamp: args.timestamp ?? Date.now(),
  };
}

function formatFieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatLogLine(entry: LogEntry): string {
  const ts = new Date(entry.timestamp).toISOString();
  const corr = entry.correlationId ? ` [${entry.correlationId}]` : "";
  const context: string[] = [];
  if (entry.missionId) context.push(`mission=${entry.missionId}`);
  if (entry.workspaceId) context.push(`workspace=${entry.workspaceId}`);
  const ctxStr = context.length ? ` ${context.join(" ")}` : "";
  const fields = entry.fields
    ? Object.entries(entry.fields)
        .map(([k, v]) => `${k}=${formatFieldValue(v)}`)
        .join(" ")
    : "";
  const fieldsStr = fields ? ` ${fields}` : "";
  return `${ts}${corr}${ctxStr} ${entry.level.toUpperCase()}${fieldsStr} ${entry.message}`;
}

export function shouldLog(
  entry: LogEntry,
  config: { minLevel?: LogLevel; correlationId?: string } = {}
): boolean {
  if (
    config.correlationId !== undefined &&
    entry.correlationId !== config.correlationId
  ) {
    return false;
  }
  const minLevel = config.minLevel ?? "info";
  return LEVEL_ORDER[entry.level] >= LEVEL_ORDER[minLevel];
}

const DEFAULT_BUCKET_BOUNDS = [50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;

export type LatencyBuckets = {
  bounds: readonly number[];
  buckets: Record<string, number>;
  values: number[];
  count: number;
  sum: number;
};

export function createLatencyBuckets(
  bounds: readonly number[] = DEFAULT_BUCKET_BOUNDS
): LatencyBuckets {
  const buckets: Record<string, number> = { "+Inf": 0 };
  for (const bound of bounds) {
    buckets[`<=${bound}`] = 0;
  }
  return {
    bounds,
    buckets,
    values: [],
    count: 0,
    sum: 0,
  };
}

export function recordLatency(
  state: LatencyBuckets,
  ms: number
): LatencyBuckets {
  const next: LatencyBuckets = {
    bounds: state.bounds,
    buckets: { ...state.buckets },
    values: [...state.values, ms],
    count: state.count + 1,
    sum: state.sum + ms,
  };

  let placed = false;
  for (const bound of state.bounds) {
    if (ms <= bound) {
      const key = `<=${bound}`;
      next.buckets[key] = (next.buckets[key] ?? 0) + 1;
      placed = true;
      break;
    }
  }
  if (!placed) {
    next.buckets["+Inf"] = (next.buckets["+Inf"] ?? 0) + 1;
  }
  return next;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[clamped];
}

export function calculateP50(values: number[]): number {
  return percentile(values, 50);
}

export function calculateP99(values: number[]): number {
  return percentile(values, 99);
}

export function calculateErrorRate(total: number, errors: number): number {
  if (total <= 0) return 0;
  if (errors < 0) return 0;
  return errors / total;
}

let correlationCounter = 0;

export function generateCorrelationId(prefix?: string): string {
  const now = Date.now();
  correlationCounter = (correlationCounter + 1) % 1_000_000;
  const rand = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  const counter = correlationCounter.toString(36).padStart(4, "0");
  const ts = now.toString(36);
  const p = prefix ? `${prefix}-` : "";
  return `${p}${ts}-${counter}-${rand}`;
}

export const MISSION_METRICS = {
  missions_created: {
    type: "counter",
    unit: "missions",
    description: "Number of missions created.",
  },
  missions_advanced: {
    type: "counter",
    unit: "advances",
    description: "Number of mission stage advances.",
  },
  cycle_count: {
    type: "gauge",
    unit: "cycles",
    description: "Current learning cycle for a mission.",
  },
  stage_duration_ms: {
    type: "histogram",
    unit: "ms",
    description: "Time spent in each mission stage.",
  },
  first_payment_latency_ms: {
    type: "histogram",
    unit: "ms",
    description: "Latency from mission creation to first confirmed payment.",
  },
  approval_pending_count: {
    type: "gauge",
    unit: "approvals",
    description: "Pending approvals in the action queue.",
  },
  evidence_collected: {
    type: "counter",
    unit: "evidence",
    description: "Evidence items collected.",
  },
  experiments_run: {
    type: "counter",
    unit: "experiments",
    description: "Experiments started.",
  },
  actions_executed: {
    type: "counter",
    unit: "actions",
    description: "Actions executed after approval.",
  },
  payments_confirmed: {
    type: "counter",
    unit: "payments",
    description: "Payments confirmed and attributed to a mission.",
  },
} as const;

export const SLO_TARGETS = {
  api_p99_latency_ms: 1000,
  api_p50_latency_ms: 250,
  api_error_rate: 0.01,
  mission_advance_success_rate: 0.99,
  observability_retention_days: 30,
  audit_event_loss_rate: 0.001,
  connector_health_check_interval_ms: 60_000,
} as const;

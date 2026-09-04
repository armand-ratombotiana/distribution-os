/**
 * Pure alerting primitives.
 *
 * An alert is a typed signal that something noteworthy has happened.
 * The alerting helpers decide whether a signal should fire an alert
 * (severity threshold, suppression window, dedupe key) and produce a
 * human-readable message. No I/O.
 */

export type AlertLevel =
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "critical";

export const ALERT_LEVEL_RANK: Record<AlertLevel, number> = {
  debug: 10,
  info: 20,
  warning: 30,
  error: 40,
  critical: 50,
};

export interface Alert {
  id: string;
  /** Stable kind, used for dedupe. */
  kind: string;
  level: AlertLevel;
  title: string;
  message: string;
  /** Source system / component that emitted the alert. */
  source: string;
  /** Epoch milliseconds when the alert was raised. */
  createdAtMs: number;
  /** Optional labels for routing / filtering. */
  labels?: Record<string, string>;
  /** Optional numeric value triggering the alert (e.g. p99 latency). */
  value?: number;
}

export interface AlertContext {
  alert: Alert;
  /** Minimum level required for an alert to fire. */
  minLevel: AlertLevel;
  /** Last time the same (kind, source) alerted, for suppression. */
  lastFiredAtMs?: number;
  /** Current time. */
  nowMs: number;
  /** Minimum gap (ms) between two alerts of the same kind+source. */
  suppressionWindowMs: number;
  /** Active dedupe keys (kind+source hash) within the suppression window. */
  activeDedupeKeys?: ReadonlySet<string>;
}

/**
 * Decide whether an alert should fire given the context.
 *
 *   - Level below `minLevel` → suppressed.
 *   - Same kind+source alerted within `suppressionWindowMs` → suppressed.
 *   - Otherwise → fires.
 */
export function shouldAlert(context: AlertContext):
  | { shouldAlert: true }
  | { shouldAlert: false; reason: string } {
  const { alert, minLevel, lastFiredAtMs, nowMs, suppressionWindowMs } = context;

  if (ALERT_LEVEL_RANK[alert.level] < ALERT_LEVEL_RANK[minLevel]) {
    return {
      shouldAlert: false,
      reason: `alert level ${alert.level} below threshold ${minLevel}`,
    };
  }

  const dedupeKey = dedupeKeyFor(alert);
  if (context.activeDedupeKeys?.has(dedupeKey)) {
    return {
      shouldAlert: false,
      reason: `dedupe key ${dedupeKey} is already active`,
    };
  }

  if (lastFiredAtMs !== undefined && nowMs - lastFiredAtMs < suppressionWindowMs) {
    return {
      shouldAlert: false,
      reason: "suppressed: within suppression window",
    };
  }

  return { shouldAlert: true };
}

/**
 * Build a stable dedupe key from an alert's kind and source.
 */
export function dedupeKeyFor(alert: Pick<Alert, "kind" | "source">): string {
  return `${alert.kind}:${alert.source}`;
}

/**
 * Build a human-readable message for an alert, including level, source,
 * kind, optional value, and optional labels.
 */
export function getAlertMessage(alert: Alert): string {
  const parts: string[] = [
    `[${alert.level.toUpperCase()}]`,
    alert.title,
    `(${alert.source}/${alert.kind})`,
  ];
  if (alert.value !== undefined) {
    parts.push(`value=${alert.value}`);
  }
  if (alert.labels && Object.keys(alert.labels).length > 0) {
    const labelStr = Object.entries(alert.labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    parts.push(`[${labelStr}]`);
  }
  parts.push("—", alert.message);
  return parts.join(" ");
}

/**
 * Whether the alert level is at or above `critical`.
 */
export function isCritical(alert: Alert): boolean {
  return alert.level === "critical";
}

/**
 * Compare two alert levels. Returns a negative number when `a` is less
 * severe than `b`, zero when equal, positive when `a` is more severe.
 */
export function compareAlertLevels(a: AlertLevel, b: AlertLevel): number {
  return ALERT_LEVEL_RANK[a] - ALERT_LEVEL_RANK[b];
}

/**
 * Sort alerts by severity (most severe first), then by createdAtMs
 * (newest first). Stable on equal severity+time.
 */
export function sortBySeverity(alerts: ReadonlyArray<Alert>): Alert[] {
  return [...alerts].sort((a, b) => {
    const levelDiff = ALERT_LEVEL_RANK[b.level] - ALERT_LEVEL_RANK[a.level];
    if (levelDiff !== 0) return levelDiff;
    return b.createdAtMs - a.createdAtMs;
  });
}

/**
 * Construct an alert with sensible defaults.
 */
export function makeAlert(
  partial: Partial<Alert> & Pick<Alert, "id" | "kind" | "title" | "message" | "source" | "createdAtMs">,
): Alert {
  return {
    level: "info",
    ...partial,
  };
}

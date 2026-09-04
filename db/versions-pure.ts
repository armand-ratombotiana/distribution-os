/**
 * Pure, dependency-free helpers for the `mission_versions` and
 * `strategy_versions` tables.
 *
 * Versioning is append-only: every change creates a new row with a bumped
 * `version_number` and a human-readable `change_reason`. These helpers
 * encode the validation, diffing and display rules used by the UI and the
 * audit pipeline.
 */

export type MissionVersionRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  version_number: number;
  mission_json: string;
  change_reason: string;
  created_by: string;
  created_at: number;
};

export type StrategyVersionRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  version_number: number;
  strategy_json: string;
  hypothesis: string;
  confidence: number; // 0-100
  change_reason: string;
  created_by: string;
  created_at: number;
};

export type VersionKind = "mission" | "strategy";

export type ChangeReasonValidationResult = {
  valid: boolean;
  errors: string[];
};

export type VersionDiff = {
  added: string[];
  removed: string[];
  changed: { key: string; before: unknown; after: unknown }[];
  unchanged: string[];
  has_changes: boolean;
};

export type MissionVersionSummary = {
  id: string;
  mission_id: string;
  version_number: number;
  change_reason: string;
  created_by: string;
  created_at: number;
  mission_field_count: number;
  is_initial: boolean;
};

export type StrategyVersionSummary = {
  id: string;
  mission_id: string;
  version_number: number;
  hypothesis: string;
  confidence: number;
  change_reason: string;
  created_by: string;
  created_at: number;
  strategy_field_count: number;
  confidence_band: "low" | "medium" | "high";
  is_initial: boolean;
};

const MIN_CHANGE_REASON_LENGTH = 3;
const MAX_CHANGE_REASON_LENGTH = 500;
const DEFAULT_CONFIDENCE_THRESHOLD = 10;

/**
 * Build a stable, URL-safe version id prefixed with the kind of version.
 */
export function buildVersionId(kind: VersionKind, seed?: string): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const safeSeed = (seed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const prefix = kind === "mission" ? "mission_version" : "strategy_version";
  return safeSeed ? `${prefix}_${time}_${rand}_${safeSeed}` : `${prefix}_${time}_${rand}`;
}

export function validateChangeReason(reason: string | null | undefined): ChangeReasonValidationResult {
  const errors: string[] = [];
  if (!reason || typeof reason !== "string") {
    errors.push("change_reason is required");
    return { valid: false, errors };
  }
  const trimmed = reason.trim();
  if (trimmed.length < MIN_CHANGE_REASON_LENGTH) {
    errors.push(`change_reason must be at least ${MIN_CHANGE_REASON_LENGTH} characters`);
  }
  if (reason.length > MAX_CHANGE_REASON_LENGTH) {
    errors.push(`change_reason must be ${MAX_CHANGE_REASON_LENGTH} characters or less`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Compare two JSON-encoded payloads field by field at the top level.
 *
 * Non-object payloads are compared by reference; arrays are treated as a
 * single opaque value (deep equality is intentionally not performed here —
 * callers that need semantic diffs should normalize before persisting).
 */
export function diffVersions(prevJson: string | null | undefined, nextJson: string | null | undefined): VersionDiff {
  const prev = safeParseObject(prevJson);
  const next = safeParseObject(nextJson);
  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: { key: string; before: unknown; after: unknown }[] = [];
  const unchanged: string[] = [];

  for (const key of nextKeys) {
    if (!prevKeys.has(key)) {
      added.push(key);
      continue;
    }
    const a = prev[key];
    const b = next[key];
    if (JSON.stringify(a) === JSON.stringify(b)) {
      unchanged.push(key);
    } else {
      changed.push({ key, before: a, after: b });
    }
  }
  for (const key of prevKeys) {
    if (!nextKeys.has(key)) {
      removed.push(key);
    }
  }
  return {
    added: added.sort(),
    removed: removed.sort(),
    changed,
    unchanged: unchanged.sort(),
    has_changes: added.length > 0 || removed.length > 0 || changed.length > 0,
  };
}

export function summarizeVersionForDisplay(row: MissionVersionRow): MissionVersionSummary {
  const fields = safeParseObject(row.mission_json);
  return {
    id: row.id,
    mission_id: row.mission_id,
    version_number: row.version_number,
    change_reason: row.change_reason,
    created_by: row.created_by,
    created_at: row.created_at,
    mission_field_count: Object.keys(fields).length,
    is_initial: row.version_number <= 1,
  };
}

export function summarizeStrategyVersionForDisplay(row: StrategyVersionRow): StrategyVersionSummary {
  const fields = safeParseObject(row.strategy_json);
  return {
    id: row.id,
    mission_id: row.mission_id,
    version_number: row.version_number,
    hypothesis: row.hypothesis,
    confidence: row.confidence,
    change_reason: row.change_reason,
    created_by: row.created_by,
    created_at: row.created_at,
    strategy_field_count: Object.keys(fields).length,
    confidence_band: confidenceBand(row.confidence),
    is_initial: row.version_number <= 1,
  };
}

/**
 * Compute the next version number from the latest known version.
 *
 * Returns 1 when no prior version exists (null/undefined or non-positive
 * input) so the first persisted version is always 1.
 */
export function nextVersionNumber(latest: number | null | undefined): number {
  if (latest === null || latest === undefined) return 1;
  if (!Number.isFinite(latest) || latest < 1) return 1;
  return Math.floor(latest) + 1;
}

/**
 * Returns true when the absolute delta between two confidence scores crosses
 * the configured significance threshold (default 10 percentage points).
 */
export function isConfidenceChangeSignificant(
  prev: number,
  next: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
): boolean {
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return false;
  if (!Number.isFinite(threshold) || threshold < 0) return false;
  return Math.abs(next - prev) >= threshold;
}

function safeParseObject(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function confidenceBand(confidence: number): "low" | "medium" | "high" {
  if (!Number.isFinite(confidence) || confidence < 0) return "low";
  if (confidence >= 70) return "high";
  if (confidence >= 40) return "medium";
  return "low";
}

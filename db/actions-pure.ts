/**
 * Pure action-queue logic with zero D1 runtime dependencies.
 *
 * Everything in this module is synchronous, deterministic, and side-effect free
 * (with the single intentional exception of `hashPayload`, which delegates to
 * the platform Web Crypto.subtle digest primitive). It can be unit-tested in
 * plain Node without a Cloudflare Workers runtime or D1 binding.
 */
import { ACTION_STATUSES } from "./schema";

export { ACTION_STATUSES };

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export type ActionRisk = "low" | "medium" | "high";

/**
 * Snake_case row shape mirroring the `action_queue` SQL table.
 * Nullable columns are modelled as `T | null`.
 */
export type ActionRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  action_type: string;
  channel: string;
  title: string;
  summary: string;
  payload_json: string;
  payload_hash: string;
  risk: ActionRisk;
  status: ActionStatus;
  blocker: string | null;
  decided_by: string | null;
  decided_at: number | null;
  expires_at: number;
  idempotency_key: string;
  provider_request_json: string | null;
  provider_result_json: string | null;
  created_at: number;
  updated_at: number;
};

/**
 * Allowed forward transitions for an action.
 *
 * - `prepared`  -> approved | rejected | blocked | expired | failed
 * - `approved`  -> executed  | failed    | blocked | expired
 * - terminal states (rejected / blocked / expired / executed / failed) -> []
 */
export const ALLOWED_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  prepared: ["approved", "rejected", "blocked", "expired", "failed"],
  approved: ["executed", "failed", "blocked", "expired"],
  rejected: [],
  blocked: [],
  expired: [],
  executed: [],
  failed: [],
};

/** Returns true when `from -> to` is a permitted forward transition. */
export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** A status is terminal when it has no outgoing transitions. */
export function isTerminal(status: ActionStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/** Throws if `value` is not a member of ACTION_STATUSES; otherwise narrows. */
export function assertStatus(value: unknown): asserts value is ActionStatus {
  if (
    typeof value !== "string" ||
    !(ACTION_STATUSES as readonly string[]).includes(value)
  ) {
    throw new Error(`Invalid action status: ${String(value)}`);
  }
}

/**
 * Recursively normalises a value for canonical JSON serialisation:
 *   - object keys are sorted alphabetically (depth-first),
 *   - `undefined` values are dropped from objects,
 *   - arrays preserve order and recurse element-wise,
 *   - primitives (and null) pass through unchanged.
 *
 * The resulting string is suitable as the input to a stable hash.
 */
function normalize(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const child = source[key];
      if (child === undefined) {
        continue;
      }
      out[key] = normalize(child);
    }
    return out;
  }
  return value;
}

/** Returns a deterministic JSON string for any structured value. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/**
 * Computes a SHA-256 hex digest of the canonical JSON encoding of `payload`.
 * The digest is 64 lowercase hex characters and stable across key reorderings.
 */
export async function hashPayload(payload: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalJson(payload));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Public-safe projection of an ActionRow: redacts all sensitive material. */
export type ActionSummary = {
  id: string;
  mission_id: string;
  action_type: string;
  channel: string;
  title: string;
  summary: string;
  risk: ActionRisk;
  status: ActionStatus;
  blocker: string | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
  payload_hash: string;
};

/**
 * Returns a display-safe summary of an action row.
 *
 * Intentionally redacts: `payload_json`, `provider_request_json`,
 * `provider_result_json`, `idempotency_key`, `workspace_id`, `decided_by`.
 * The `payload_hash` is retained so callers can still deduplicate or audit
 * without seeing raw payload bytes.
 */
export function summarizeForDisplay(row: ActionRow): ActionSummary {
  return {
    id: row.id,
    mission_id: row.mission_id,
    action_type: row.action_type,
    channel: row.channel,
    title: row.title,
    summary: row.summary,
    risk: row.risk,
    status: row.status,
    blocker: row.blocker,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    payload_hash: row.payload_hash,
  };
}

/**
 * Builds the canonical idempotency key for an action.
 *
 * Format: `${workspaceId}:${missionId}:${payloadHash}`
 *
 * The key is:
 *   - deterministic (identical inputs => identical output),
 *   - tenant-isolated (workspaceId is the leading segment),
 *   - mission-scoped (missionId is the middle segment),
 *   - content-bound (payloadHash ties it to the exact payload).
 */
export function buildIdempotencyKey(
  workspaceId: string,
  missionId: string,
  payloadHash: string,
): string {
  return `${workspaceId}:${missionId}:${payloadHash}`;
}

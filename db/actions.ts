/**
 * D1 persistence layer for the `action_queue` table.
 *
 * Each function is tenant-isolated by `workspace_id` and delegates validation,
 * hashing, state-machine and display logic to the pure helpers in
 * `./actions-pure`. IDs are generated with `crypto.randomUUID()` and
 * timestamps with `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  assertStatus,
  buildIdempotencyKey,
  canTransition,
  canonicalJson,
  hashPayload,
  type ActionRisk,
  type ActionRow,
  type ActionStatus,
  type ActionSummary,
  summarizeForDisplay,
} from "./actions-pure";

export * from "./actions-pure";

export type EnqueueActionInput = {
  mission_id: string;
  action_type: string;
  channel: string;
  title: string;
  summary: string;
  payload: unknown;
  risk?: ActionRisk;
  expires_at: number;
  blocker?: string | null;
  provider_request_json?: string | null;
  provider_result_json?: string | null;
};

export type ListActionsOptions = {
  mission_id?: string;
  status?: ActionStatus;
  limit?: number;
};

/**
 * Insert a new action into the queue. The payload is canonicalised and hashed
 * so that the idempotency key is deterministic — replaying the same enqueue
 * call (same workspace + mission + payload) updates the existing row instead
 * of creating a duplicate.
 */
export async function enqueueAction(
  workspaceId: string,
  input: EnqueueActionInput,
): Promise<ActionRow> {
  const db = getRawDb();
  const now = Date.now();
  const payloadJson = canonicalJson(input.payload);
  const payloadHash = await hashPayload({
    action_type: input.action_type,
    channel: input.channel,
    title: input.title,
    summary: input.summary,
    payload: input.payload,
  });
  const idempotencyKey = buildIdempotencyKey(
    workspaceId,
    input.mission_id,
    payloadHash,
  );
  const id = `act_${crypto.randomUUID()}`;
  const risk: ActionRisk = input.risk ?? "medium";

  const existing = await db
    .prepare(
      "SELECT * FROM action_queue WHERE workspace_id = ? AND idempotency_key = ? ORDER BY created_at ASC LIMIT 1",
    )
    .bind(workspaceId, idempotencyKey)
    .first<ActionRow>();
  if (existing) {
    return existing;
  }

  await db
    .prepare(
      "INSERT INTO action_queue (id, workspace_id, mission_id, action_type, channel, title, summary, payload_json, payload_hash, risk, status, blocker, decided_by, decided_at, expires_at, idempotency_key, provider_request_json, provider_result_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, NULL, NULL, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      input.action_type,
      input.channel,
      input.title,
      input.summary,
      payloadJson,
      payloadHash,
      risk,
      input.blocker ?? null,
      input.expires_at,
      idempotencyKey,
      input.provider_request_json ?? null,
      input.provider_result_json ?? null,
      now,
      now,
    )
    .run();

  const row = await db
    .prepare(
      "SELECT * FROM action_queue WHERE workspace_id = ? AND idempotency_key = ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(workspaceId, idempotencyKey)
    .first<ActionRow>();
  if (!row) {
    throw new Error("Failed to enqueue action");
  }
  return row;
}

/**
 * List actions for a workspace, optionally filtered by mission and/or status.
 * Results are ordered by `created_at DESC` and capped at `limit` (default 50,
 * maximum 200).
 */
export async function listActions(
  workspaceId: string,
  opts: ListActionsOptions = {},
): Promise<ActionRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.status) {
    assertStatus(opts.status);
    const result = await db
      .prepare(
        "SELECT * FROM action_queue WHERE workspace_id = ? AND mission_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.status, limit)
      .all<ActionRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM action_queue WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<ActionRow>();
    return result.results;
  }
  if (opts.status) {
    assertStatus(opts.status);
    const result = await db
      .prepare(
        "SELECT * FROM action_queue WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<ActionRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM action_queue WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<ActionRow>();
  return result.results;
}

/** Fetch a single action by id within a workspace. Returns null when missing. */
export async function getAction(
  workspaceId: string,
  actionId: string,
): Promise<ActionRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM action_queue WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, actionId)
    .first<ActionRow>();
}

/**
 * Transition an action to `approved` and record the deciding actor. Refuses
 * the transition when the state machine (`canTransition`) does not permit it.
 */
export async function approveAction(
  workspaceId: string,
  actionId: string,
  decidedBy: string,
): Promise<ActionRow> {
  return transitionAction(workspaceId, actionId, "approved", decidedBy);
}

/**
 * Transition an action to `rejected` and record the deciding actor. Refuses
 * the transition when the state machine does not permit it.
 */
export async function rejectAction(
  workspaceId: string,
  actionId: string,
  decidedBy: string,
): Promise<ActionRow> {
  return transitionAction(workspaceId, actionId, "rejected", decidedBy);
}

async function transitionAction(
  workspaceId: string,
  actionId: string,
  to: ActionStatus,
  decidedBy: string,
): Promise<ActionRow> {
  const db = getRawDb();
  const current = await getAction(workspaceId, actionId);
  if (!current) {
    throw new Error(`Action not found: ${actionId}`);
  }
  if (to !== "expired" && current.expires_at <= Date.now()) {
    await transitionAction(workspaceId, actionId, "expired", "system:expiry");
    throw new Error(`Action ${actionId} has expired and cannot be approved`);
  }
  if (!canTransition(current.status, to)) {
    throw new Error(
      `Action ${actionId} cannot transition from ${current.status} to ${to}`,
    );
  }
  const now = Date.now();
  await db
    .prepare(
      "UPDATE action_queue SET status = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(to, decidedBy, now, now, workspaceId, actionId)
    .run();

  const updated = await getAction(workspaceId, actionId);
  if (!updated) {
    throw new Error(`Action disappeared after update: ${actionId}`);
  }
  return updated;
}

/**
 * Mark every action whose `expires_at` has passed (and that is still in a
 * non-terminal state) as `expired`. Returns the rows that were expired.
 *
 * Only `prepared` and `approved` actions can transition to `expired` per the
 * state machine — terminal states are left untouched.
 */
export async function expireOverdueActions(
  workspaceId: string,
  now: number = Date.now(),
): Promise<ActionRow[]> {
  const db = getRawDb();
  const candidates = await db
    .prepare(
      "SELECT * FROM action_queue WHERE workspace_id = ? AND expires_at <= ? AND status IN ('prepared', 'approved') ORDER BY expires_at ASC",
    )
    .bind(workspaceId, now)
    .all<ActionRow>();

  const expired: ActionRow[] = [];
  for (const row of candidates.results) {
    if (!canTransition(row.status, "expired")) continue;
    await db
      .prepare(
        "UPDATE action_queue SET status = 'expired', updated_at = ? WHERE workspace_id = ? AND id = ? AND status = ?",
      )
      .bind(now, workspaceId, row.id, row.status)
      .run();
    expired.push({ ...row, status: "expired", updated_at: now });
  }
  return expired;
}

/**
 * Convenience wrapper that returns a display-safe summary of an action row.
 * Re-exported from the pure module so callers can import everything from one
 * place.
 */
export function summarizeAction(row: ActionRow): ActionSummary {
  return summarizeForDisplay(row);
}

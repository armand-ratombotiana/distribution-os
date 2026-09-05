import { getRawDb } from "./index";

export type ExecutionAttemptStatus =
  | "claimed"
  | "submitting"
  | "succeeded"
  | "failed"
  | "unknown";

export type ActionExecutionAttemptRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  action_id: string;
  provider: string;
  idempotency_key: string;
  payload_hash: string;
  status: ExecutionAttemptStatus;
  attempt_count: number;
  provider_request_id: string | null;
  receipt_json: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
};

export type ExecutionAttemptSummary = Omit<
  ActionExecutionAttemptRow,
  "workspace_id" | "receipt_json"
> & { receipt: Record<string, unknown> | null };

export async function claimExecutionAttempt(input: {
  workspaceId: string;
  missionId: string;
  actionId: string;
  provider: string;
  idempotencyKey: string;
  payloadHash: string;
}): Promise<{ attempt: ActionExecutionAttemptRow; created: boolean }> {
  const db = getRawDb();
  const now = Date.now();
  const id = `att_${crypto.randomUUID()}`;
  const result = await db
    .prepare(
      "INSERT INTO action_execution_attempts (id, workspace_id, mission_id, action_id, provider, idempotency_key, payload_hash, status, attempt_count, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'claimed', 1, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING",
    )
    .bind(
      id,
      input.workspaceId,
      input.missionId,
      input.actionId,
      input.provider,
      input.idempotencyKey,
      input.payloadHash,
      now,
      now,
      now,
    )
    .run();
  const attempt = await getExecutionAttemptByKey(input.workspaceId, input.idempotencyKey);
  if (!attempt) throw new Error("Execution attempt could not be claimed");
  return { attempt, created: Number(result.meta.changes ?? 0) === 1 };
}

export async function getExecutionAttemptByKey(
  workspaceId: string,
  idempotencyKey: string,
): Promise<ActionExecutionAttemptRow | null> {
  return getRawDb()
    .prepare("SELECT * FROM action_execution_attempts WHERE workspace_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(workspaceId, idempotencyKey)
    .first<ActionExecutionAttemptRow>();
}

export async function getLatestExecutionAttempt(
  workspaceId: string,
  actionId: string,
): Promise<ActionExecutionAttemptRow | null> {
  return getRawDb()
    .prepare("SELECT * FROM action_execution_attempts WHERE workspace_id = ? AND action_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(workspaceId, actionId)
    .first<ActionExecutionAttemptRow>();
}

export async function markAttemptSubmitting(
  workspaceId: string,
  attemptId: string,
  expectedStatuses: ExecutionAttemptStatus[],
): Promise<boolean> {
  const allowed = expectedStatuses.filter((status) => ["claimed", "failed", "unknown"].includes(status));
  if (allowed.length === 0) return false;
  const placeholders = allowed.map(() => "?").join(",");
  const now = Date.now();
  const result = await getRawDb()
    .prepare(
      `UPDATE action_execution_attempts SET status = 'submitting', attempt_count = CASE WHEN status = 'claimed' THEN attempt_count ELSE attempt_count + 1 END, error_code = NULL, error_message = NULL, updated_at = ? WHERE workspace_id = ? AND id = ? AND status IN (${placeholders})`,
    )
    .bind(now, workspaceId, attemptId, ...allowed)
    .run();
  return Number(result.meta.changes ?? 0) === 1;
}

export async function finishExecutionAttempt(input: {
  workspaceId: string;
  attemptId: string;
  status: "succeeded" | "failed" | "unknown";
  providerRequestId?: string | null;
  receipt?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<ActionExecutionAttemptRow> {
  const db = getRawDb();
  const now = Date.now();
  await db
    .prepare(
      "UPDATE action_execution_attempts SET status = ?, provider_request_id = ?, receipt_json = ?, error_code = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'submitting'",
    )
    .bind(
      input.status,
      input.providerRequestId ?? null,
      input.receipt ? JSON.stringify(input.receipt) : null,
      input.errorCode ?? null,
      input.errorMessage?.slice(0, 1_000) ?? null,
      now,
      now,
      input.workspaceId,
      input.attemptId,
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM action_execution_attempts WHERE workspace_id = ? AND id = ? LIMIT 1")
    .bind(input.workspaceId, input.attemptId)
    .first<ActionExecutionAttemptRow>();
  if (!row) throw new Error("Execution attempt disappeared");
  return row;
}

export function summarizeExecutionAttempt(
  row: ActionExecutionAttemptRow | null,
): ExecutionAttemptSummary | null {
  if (!row) return null;
  let receipt: Record<string, unknown> | null = null;
  try {
    const parsed = row.receipt_json ? JSON.parse(row.receipt_json) : null;
    receipt = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    receipt = null;
  }
  const { workspace_id: _workspaceId, receipt_json: _receiptJson, ...safe } = row;
  void _workspaceId;
  void _receiptJson;
  return { ...safe, receipt };
}

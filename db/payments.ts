/**
 * D1 persistence layer for the `payments` and `touchpoints` tables.
 *
 * Tenant-isolated by `workspace_id`. Delegates payment/touchpoint lifecycle,
 * attribution scoring and display logic to `./attribution-pure` (the pure
 * module that covers both tables). IDs use `crypto.randomUUID()` and
 * timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  canTransition,
  type PaymentRow,
  type PaymentStatus,
  type TouchpointRow,
} from "./attribution-pure";

export * from "./attribution-pure";

export type RecordPaymentInput = {
  mission_id?: string | null;
  action_id?: string | null;
  experiment_id?: string | null;
  provider?: string;
  provider_payment_id: string;
  amount_cents: number;
  currency?: string;
  status?: PaymentStatus;
  attribution_confidence?: number;
  attributed_at?: number | null;
  received_at?: number;
  raw_event?: Record<string, unknown> | null;
};

export type ListPaymentsOptions = {
  mission_id?: string;
  status?: PaymentStatus;
  limit?: number;
};

export type RecordTouchpointInput = {
  mission_id: string;
  action_id?: string | null;
  experiment_id?: string | null;
  channel: string;
  event_type: string;
  occurred_at: number;
  provider_event_id?: string | null;
  raw_event?: Record<string, unknown> | null;
};

export type ListTouchpointsOptions = {
  mission_id?: string;
  action_id?: string;
  limit?: number;
};

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    ["pending", "succeeded", "refunded", "disputed", "failed"].includes(value)
  );
}

/**
 * Insert a payment row. The idempotency key is derived from
 * `workspace_id + provider + provider_payment_id` so that replayed webhook
 * events update the existing row instead of creating duplicates.
 */
export async function recordPayment(
  workspaceId: string,
  input: RecordPaymentInput,
): Promise<PaymentRow> {
  const db = getRawDb();
  const now = Date.now();
  const provider = input.provider ?? "stripe";
  const currency = input.currency ?? "usd";
  const status: PaymentStatus = input.status ?? "pending";
  if (!isPaymentStatus(status)) {
    throw new Error(`Invalid payment status: ${String(status)}`);
  }
  const receivedAt = input.received_at ?? now;
  const attributionConfidence =
    typeof input.attribution_confidence === "number" &&
    Number.isFinite(input.attribution_confidence)
      ? Math.max(0, Math.min(100, Math.floor(input.attribution_confidence)))
      : 0;
  const rawEventJson = input.raw_event ? JSON.stringify(input.raw_event) : null;

  // Look up an existing row by the natural key (workspace + provider +
  // provider_payment_id) before deciding to insert or update. This mirrors
  // the idempotency-key derivation in `buildPaymentIdempotencyKey`.
  const existing = await db
    .prepare(
      "SELECT * FROM payments WHERE workspace_id = ? AND provider = ? AND provider_payment_id = ? LIMIT 1",
    )
    .bind(workspaceId, provider, input.provider_payment_id)
    .first<PaymentRow>();

  if (existing) {
    const nextStatus: PaymentStatus = isPaymentStatus(status) ? status : existing.status;
    if (nextStatus !== existing.status && !canTransition(existing.status, nextStatus)) {
      throw new Error(
        `Payment ${existing.id} cannot transition from ${existing.status} to ${nextStatus}`,
      );
    }
    await db
      .prepare(
        "UPDATE payments SET mission_id = ?, action_id = ?, experiment_id = ?, amount_cents = ?, currency = ?, status = ?, attribution_confidence = ?, attributed_at = ?, received_at = ?, raw_event_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
      )
      .bind(
        input.mission_id ?? existing.mission_id,
        input.action_id ?? existing.action_id,
        input.experiment_id ?? existing.experiment_id,
        input.amount_cents,
        currency,
        nextStatus,
        attributionConfidence,
        input.attributed_at ?? existing.attributed_at,
        receivedAt,
        rawEventJson,
        now,
        workspaceId,
        existing.id,
      )
      .run();
    const updated = await getPayment(workspaceId, existing.id);
    if (!updated) {
      throw new Error(`Payment disappeared after update: ${existing.id}`);
    }
    return updated;
  }

  const id = `pay_${crypto.randomUUID()}`;
  await db
    .prepare(
      "INSERT INTO payments (id, workspace_id, mission_id, action_id, experiment_id, provider, provider_payment_id, amount_cents, currency, status, attribution_confidence, attributed_at, received_at, raw_event_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id ?? null,
      input.action_id ?? null,
      input.experiment_id ?? null,
      provider,
      input.provider_payment_id,
      input.amount_cents,
      currency,
      status,
      attributionConfidence,
      input.attributed_at ?? null,
      receivedAt,
      rawEventJson,
      now,
      now,
    )
    .run();

  const row = await getPayment(workspaceId, id);
  if (!row) {
    throw new Error("Failed to record payment");
  }
  return row;
}

/** Fetch a single payment by id within a workspace. */
export async function getPayment(
  workspaceId: string,
  paymentId: string,
): Promise<PaymentRow | null> {
  const db = getRawDb();
  return db
    .prepare("SELECT * FROM payments WHERE workspace_id = ? AND id = ? LIMIT 1")
    .bind(workspaceId, paymentId)
    .first<PaymentRow>();
}

/**
 * List payments for a workspace, optionally filtered by mission and/or status.
 * Ordered by `created_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listPayments(
  workspaceId: string,
  opts: ListPaymentsOptions = {},
): Promise<PaymentRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.status) {
    if (!isPaymentStatus(opts.status)) {
      throw new Error(`Invalid payment status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM payments WHERE workspace_id = ? AND mission_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.status, limit)
      .all<PaymentRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM payments WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<PaymentRow>();
    return result.results;
  }
  if (opts.status) {
    if (!isPaymentStatus(opts.status)) {
      throw new Error(`Invalid payment status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM payments WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<PaymentRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM payments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<PaymentRow>();
  return result.results;
}

/**
 * Transition a payment to a new status. Refuses the transition when the
 * payment lifecycle (`canTransition`) does not permit it.
 */
export async function updatePaymentStatus(
  workspaceId: string,
  paymentId: string,
  newStatus: PaymentStatus,
): Promise<PaymentRow> {
  if (!isPaymentStatus(newStatus)) {
    throw new Error(`Invalid payment status: ${String(newStatus)}`);
  }
  const db = getRawDb();
  const current = await getPayment(workspaceId, paymentId);
  if (!current) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (!canTransition(current.status, newStatus)) {
    throw new Error(
      `Payment ${paymentId} cannot transition from ${current.status} to ${newStatus}`,
    );
  }
  const now = Date.now();
  await db
    .prepare(
      "UPDATE payments SET status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(newStatus, now, workspaceId, paymentId)
    .run();
  const updated = await getPayment(workspaceId, paymentId);
  if (!updated) {
    throw new Error(`Payment disappeared after update: ${paymentId}`);
  }
  return updated;
}

/**
 * Insert a touchpoint row. Touchpoints are append-only — replaying the same
 * event with the same `provider_event_id` (when provided) is a no-op.
 */
export async function recordTouchpoint(
  workspaceId: string,
  input: RecordTouchpointInput,
): Promise<TouchpointRow> {
  const db = getRawDb();
  const now = Date.now();
  const rawEventJson = input.raw_event ? JSON.stringify(input.raw_event) : null;
  const providerEventId = input.provider_event_id ?? null;

  if (providerEventId) {
    const existing = await db
      .prepare(
        "SELECT * FROM touchpoints WHERE workspace_id = ? AND provider_event_id = ? LIMIT 1",
      )
      .bind(workspaceId, providerEventId)
      .first<TouchpointRow>();
    if (existing) {
      return existing;
    }
  }

  const id = `tp_${crypto.randomUUID()}`;
  await db
    .prepare(
      "INSERT INTO touchpoints (id, workspace_id, mission_id, action_id, experiment_id, channel, event_type, occurred_at, received_at, provider_event_id, raw_event_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      input.action_id ?? null,
      input.experiment_id ?? null,
      input.channel,
      input.event_type,
      input.occurred_at,
      now,
      providerEventId,
      rawEventJson,
      now,
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM touchpoints WHERE workspace_id = ? AND id = ? LIMIT 1")
    .bind(workspaceId, id)
    .first<TouchpointRow>();
  if (!row) {
    throw new Error("Failed to record touchpoint");
  }
  return row;
}

/**
 * List touchpoints for a workspace, optionally filtered by mission and/or
 * action. Ordered by `occurred_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listTouchpoints(
  workspaceId: string,
  opts: ListTouchpointsOptions = {},
): Promise<TouchpointRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.action_id) {
    const result = await db
      .prepare(
        "SELECT * FROM touchpoints WHERE workspace_id = ? AND mission_id = ? AND action_id = ? ORDER BY occurred_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.action_id, limit)
      .all<TouchpointRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM touchpoints WHERE workspace_id = ? AND mission_id = ? ORDER BY occurred_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<TouchpointRow>();
    return result.results;
  }
  if (opts.action_id) {
    const result = await db
      .prepare(
        "SELECT * FROM touchpoints WHERE workspace_id = ? AND action_id = ? ORDER BY occurred_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.action_id, limit)
      .all<TouchpointRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM touchpoints WHERE workspace_id = ? ORDER BY occurred_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<TouchpointRow>();
  return result.results;
}

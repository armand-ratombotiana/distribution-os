import { PAYMENT_STATUSES } from "./schema";

/**
 * Pure attribution helpers — no database or runtime bindings.
 *
 * These functions encode the deterministic rules that the attribution engine
 * relies on (payment lifecycle transitions, confidence scoring and PII-safe
 * display summaries). Keeping them free of side effects makes them trivial to
 * unit test and reuse from workers, API routes and migrations.
 */

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Raw D1 row shape for the `payments` table (snake_case columns). */
export type PaymentRow = {
  id: string;
  workspace_id: string;
  mission_id: string | null;
  action_id: string | null;
  experiment_id: string | null;
  provider: string;
  provider_payment_id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  attribution_confidence: number;
  attributed_at: number | null;
  received_at: number;
  raw_event_json: string | null;
  created_at: number;
  updated_at: number;
};

/** Raw D1 row shape for the `touchpoints` table (snake_case columns). */
export type TouchpointRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  action_id: string | null;
  experiment_id: string | null;
  channel: string;
  event_type: string;
  occurred_at: number;
  received_at: number;
  provider_event_id: string | null;
  raw_event_json: string | null;
  created_at: number;
};

/**
 * Allowed payment lifecycle transitions.
 *
 * - `pending` → `succeeded` | `failed`
 * - `succeeded` → `refunded` | `disputed`
 * - `refunded` / `disputed` / `failed` are terminal (no further transitions).
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["succeeded", "failed"],
  succeeded: ["refunded", "disputed"],
  refunded: [],
  disputed: [],
  failed: [],
};

/** Returns true when `from → to` is an allowed payment lifecycle transition. */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  const allowed = PAYMENT_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** A payment status is terminal when it has no outgoing transitions. */
export function isTerminal(status: PaymentStatus): boolean {
  return (PAYMENT_TRANSITIONS[status]?.length ?? 0) === 0;
}

/**
 * Formats a monetary amount (in cents) as a human-readable currency string.
 *
 * @example formatAmount(1999, "usd") → "$19.99"
 */
export function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

/**
 * Returns true when a touchpoint could plausibly be attributed to a payment.
 *
 * A touchpoint matches when it shares a mission (or a more specific action id)
 * with the payment. Either linkage is sufficient — missions are the coarse
 * attribution grain, while shared action ids represent a direct causal link.
 */
export function touchpointMatchesPayment(
  touchpoint: TouchpointRow,
  payment: PaymentRow,
): boolean {
  if (
    payment.mission_id &&
    touchpoint.mission_id &&
    touchpoint.mission_id === payment.mission_id
  ) {
    return true;
  }
  if (
    payment.action_id &&
    touchpoint.action_id &&
    touchpoint.action_id === payment.action_id
  ) {
    return true;
  }
  return false;
}

/**
 * Scores attribution confidence on a 0–100 scale.
 *
 * - 0 touchpoints → 0 (nothing to attribute to).
 * - 1 matching touchpoint → 90 (strong, direct signal).
 * - 2+ matching touchpoints → 75 (multiple paths dilute confidence).
 * - only non-matching touchpoints → 20 (weak, ambiguous signal).
 */
export function calculateAttributionConfidence(
  touchpoints: TouchpointRow[],
  payment: PaymentRow,
): number {
  if (!touchpoints || touchpoints.length === 0) return 0;
  const matching = touchpoints.filter((t) =>
    touchpointMatchesPayment(t, payment),
  ).length;
  if (matching === 0) return 20;
  if (matching === 1) return 90;
  return 75;
}

/**
 * Projects a payment row into a display-safe shape by redacting `raw_event_json`
 * (which may contain provider PII / raw customer data) and `workspace_id`
 * (which is an internal identifier that should never leak into UI surfaces).
 */
export function summarizePaymentForDisplay(
  payment: PaymentRow,
): Record<string, unknown> {
  return {
    id: payment.id,
    mission_id: payment.mission_id,
    action_id: payment.action_id,
    experiment_id: payment.experiment_id,
    provider: payment.provider,
    provider_payment_id: payment.provider_payment_id,
    amount_cents: payment.amount_cents,
    currency: payment.currency,
    status: payment.status,
    attribution_confidence: payment.attribution_confidence,
    attributed_at: payment.attributed_at,
    received_at: payment.received_at,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
    amount_formatted: formatAmount(payment.amount_cents, payment.currency),
  };
}

/**
 * Projects a touchpoint row into a display-safe shape by redacting
 * `raw_event_json` and `workspace_id`.
 */
export function summarizeTouchpointForDisplay(
  touchpoint: TouchpointRow,
): Record<string, unknown> {
  return {
    id: touchpoint.id,
    mission_id: touchpoint.mission_id,
    action_id: touchpoint.action_id,
    experiment_id: touchpoint.experiment_id,
    channel: touchpoint.channel,
    event_type: touchpoint.event_type,
    occurred_at: touchpoint.occurred_at,
    received_at: touchpoint.received_at,
    provider_event_id: touchpoint.provider_event_id,
    created_at: touchpoint.created_at,
  };
}

/**
 * Builds a deterministic idempotency key for a payment event.
 *
 * The key is scoped to the workspace + provider + provider-side payment id so
 * that replayed webhooks (same provider payment id) are de-duplicated within
 * the same workspace, while still allowing the same external id to be reused
 * across workspaces or providers without colliding.
 */
export function buildPaymentIdempotencyKey(args: {
  workspaceId: string;
  provider: string;
  providerPaymentId: string;
}): string {
  return `pay:${args.workspaceId}:${args.provider.toLowerCase()}:${args.providerPaymentId}`;
}

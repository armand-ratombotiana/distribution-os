import { getRawDb } from "../../../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { getExperiment, summarizeForDisplay } from "../../../../../db/experiments";
import {
  calculateAttributionConfidence,
  formatAmount,
  type PaymentRow,
  type TouchpointRow,
} from "../../../../../db/attribution-pure";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ experiment_id: string }>;
};

type ExperimentMetricsResponse = {
  experiment: ReturnType<typeof summarizeForDisplay>;
  metrics: {
    touchpoint_count: number;
    payment_count: number;
    succeeded_payment_count: number;
    failed_payment_count: number;
    pending_payment_count: number;
    succeeded_amount_cents: number;
    succeeded_amount_formatted: string;
    average_attribution_confidence: number;
    first_touch_at: number | null;
    last_touch_at: number | null;
    days_running: number;
    deadline_remaining_ms: number | null;
  };
  payments: Array<{
    id: string;
    status: string;
    amount_cents: number;
    currency: string;
    received_at: number;
    attribution_confidence: number;
  }>;
  generated_at: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Experiment metrics & results.
 *
 * Returns the experiment row (redacted through `summarizeForDisplay`) plus a
 * `metrics` object aggregating the touchpoints and payments associated with
 * the experiment via the `experiment_id` foreign key on both tables.
 *
 * The metrics include:
 *   - touchpoint/payment counts (total + broken down by status)
 *   - sum of succeeded payment amounts (in cents + formatted currency)
 *   - average attribution confidence (0–100) across all payments
 *   - first/last touch timestamps
 *   - `days_running` (today − `created_at`, floored)
 *   - `deadline_remaining_ms` (null when the experiment has no deadline)
 *
 * Read-only — no rows are mutated. An audit_events row with category
 * `action` and type `experiment.metrics_viewed` is logged after a successful
 * response.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { experiment_id } = await context.params;

    const experiment = await getExperiment(workspace.id, experiment_id);
    if (!experiment) {
      return Response.json(
        { error: "Experiment not found." },
        { status: 404 },
      );
    }

    const db = getRawDb();
    const touchpointsPromise = db
      .prepare(
        "SELECT id, mission_id, action_id, experiment_id, channel, event_type, occurred_at, received_at, provider_event_id, created_at FROM touchpoints WHERE workspace_id = ? AND experiment_id = ? ORDER BY occurred_at ASC",
      )
      .bind(workspace.id, experiment_id)
      .all<TouchpointRow>();
    const paymentsPromise = db
      .prepare(
        "SELECT id, workspace_id, mission_id, action_id, experiment_id, provider, provider_payment_id, amount_cents, currency, status, attribution_confidence, attributed_at, received_at, raw_event_json, created_at, updated_at FROM payments WHERE workspace_id = ? AND experiment_id = ? ORDER BY received_at DESC",
      )
      .bind(workspace.id, experiment_id)
      .all<PaymentRow>();

    const [touchpointsResult, paymentsResult] = await Promise.all([
      touchpointsPromise,
      paymentsPromise,
    ]);

    const touchpoints: TouchpointRow[] = touchpointsResult.results;
    const payments: PaymentRow[] = paymentsResult.results;

    const succeeded = payments.filter((p) => p.status === "succeeded");
    const failed = payments.filter((p) => p.status === "failed");
    const pending = payments.filter((p) => p.status === "pending");
    const succeededAmountCents = succeeded.reduce(
      (sum, p) => sum + p.amount_cents,
      0,
    );

    const confidenceScores = payments.map((p) =>
      calculateAttributionConfidence(touchpoints, p),
    );
    const averageConfidence =
      confidenceScores.length === 0
        ? 0
        : Math.round(
            confidenceScores.reduce((sum, c) => sum + c, 0) /
              confidenceScores.length,
          );

    const firstTouchAt =
      touchpoints.length === 0
        ? null
        : touchpoints.reduce(
            (min, t) => (t.occurred_at < min ? t.occurred_at : min),
            touchpoints[0].occurred_at,
          );
    const lastTouchAt =
      touchpoints.length === 0
        ? null
        : touchpoints.reduce(
            (max, t) => (t.occurred_at > max ? t.occurred_at : max),
          touchpoints[0].occurred_at,
        );

    const now = Date.now();
    const daysRunning = Math.max(
      0,
      Math.floor((now - experiment.created_at) / MS_PER_DAY),
    );
    const deadlineRemainingMs =
      experiment.deadline !== null && experiment.deadline > 0
        ? Math.max(0, experiment.deadline - now)
        : null;

    const response: ExperimentMetricsResponse = {
      experiment: summarizeForDisplay(experiment),
      metrics: {
        touchpoint_count: touchpoints.length,
        payment_count: payments.length,
        succeeded_payment_count: succeeded.length,
        failed_payment_count: failed.length,
        pending_payment_count: pending.length,
        succeeded_amount_cents: succeededAmountCents,
        succeeded_amount_formatted:
          succeeded.length > 0
            ? formatAmount(succeededAmountCents, succeeded[0].currency)
            : formatAmount(0, "usd"),
        average_attribution_confidence: averageConfidence,
        first_touch_at: firstTouchAt,
        last_touch_at: lastTouchAt,
        days_running: daysRunning,
        deadline_remaining_ms: deadlineRemainingMs,
      },
      payments: payments.map((p) => ({
        id: p.id,
        status: p.status,
        amount_cents: p.amount_cents,
        currency: p.currency,
        received_at: p.received_at,
        attribution_confidence: calculateAttributionConfidence(touchpoints, p),
      })),
      generated_at: now,
    };

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "experiment.metrics_viewed",
        resource_type: "experiment",
        resource_id: experiment_id,
        detail: {
          mission_id: experiment.mission_id,
          touchpoint_count: touchpoints.length,
          payment_count: payments.length,
          succeeded_amount_cents: succeededAmountCents,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view experiment metrics." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Experiment metrics unavailable.",
      },
      { status: 500 },
    );
  }
}

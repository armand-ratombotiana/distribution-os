import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import {
  listPayments,
  listTouchpoints,
  summarizePaymentForDisplay,
  summarizeTouchpointForDisplay,
} from "../../../../../db/payments";
import {
  calculateAttributionConfidence,
  formatAmount,
  touchpointMatchesPayment,
} from "../../../../../db/attribution-pure";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

type AttributionPayment = {
  payment: Record<string, unknown>;
  attribution_confidence: number;
  matching_touchpoint_count: number;
};

type AttributionSummary = {
  total_touchpoints: number;
  total_payments: number;
  succeeded_payment_count: number;
  succeeded_amount_cents: number;
  succeeded_amount_formatted: string;
  average_confidence: number;
};

type AttributionResponse = {
  mission_id: string;
  touchpoints: Record<string, unknown>[];
  payments: AttributionPayment[];
  summary: AttributionSummary;
  generated_at: number;
};

/**
 * Attribution analysis for a mission — combines the touchpoint and payment
 * streams and scores each payment's confidence against the mission's
 * touchpoint history.
 *
 * For every payment we count how many touchpoints share the mission
 * (or a more specific action id) with it and compute a 0–100 confidence
 * score via the pure `calculateAttributionConfidence` helper:
 *   - 0 touchpoints                 → 0  (nothing to attribute to)
 *   - 1 matching touchpoint         → 90 (strong, direct signal)
 *   - 2+ matching touchpoints       → 75 (multiple paths dilute confidence)
 *   - only non-matching touchpoints → 20 (weak, ambiguous signal)
 *
 * Read-only — no rows are mutated.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const [touchpoints, payments] = await Promise.all([
      listTouchpoints(workspace.id, { mission_id }),
      listPayments(workspace.id, { mission_id }),
    ]);

    const paymentsWithConfidence: AttributionPayment[] = payments.map(
      (payment) => {
        const matching = touchpoints.filter((touchpoint) =>
          touchpointMatchesPayment(touchpoint, payment),
        );
        const confidence = calculateAttributionConfidence(touchpoints, payment);
        return {
          payment: summarizePaymentForDisplay(payment),
          attribution_confidence: confidence,
          matching_touchpoint_count: matching.length,
        };
      },
    );

    const succeeded = payments.filter((p) => p.status === "succeeded");
    const succeededAmountCents = succeeded.reduce(
      (sum, p) => sum + p.amount_cents,
      0,
    );
    const averageConfidence =
      paymentsWithConfidence.length === 0
        ? 0
        : Math.round(
            paymentsWithConfidence.reduce(
              (sum, p) => sum + p.attribution_confidence,
              0,
            ) / paymentsWithConfidence.length,
          );

    const summary: AttributionSummary = {
      total_touchpoints: touchpoints.length,
      total_payments: payments.length,
      succeeded_payment_count: succeeded.length,
      succeeded_amount_cents: succeededAmountCents,
      succeeded_amount_formatted: succeeded.length
        ? formatAmount(
            succeededAmountCents,
            succeeded[0]?.currency ?? "usd",
          )
        : formatAmount(0, "usd"),
      average_confidence: averageConfidence,
    };

    const response: AttributionResponse = {
      mission_id,
      touchpoints: touchpoints.map(summarizeTouchpointForDisplay),
      payments: paymentsWithConfidence,
      summary,
      generated_at: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view attribution analysis." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Attribution analysis unavailable.",
      },
      { status: 500 },
    );
  }
}

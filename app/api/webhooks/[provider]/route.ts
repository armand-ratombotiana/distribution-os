import { env } from "cloudflare:workers";
import { recordPayment } from "../../../../db/payments";
import { logAuditEvent } from "../../../../db/audit";
import {
  classifyWebhookEvent,
  verifyStripeSignature,
} from "../../../../lib/webhook-signature-pure";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

/**
 * Stripe-style webhook receiver.
 *
 * Reads the raw request body, verifies the `Stripe-Signature` header against
 * the workspace's webhook secret, classifies the event type and records a
 * payment row when the event represents a payment lifecycle transition.
 *
 * Returns:
 *   503 — when `STRIPE_WEBHOOK_SECRET` is not configured (service unavailable).
 *   401 — when the signature is missing, malformed, expired or mismatches.
 *   400 — when the request body is not valid JSON.
 *   200 — when the event has been received, classified and (if applicable)
 *         recorded as a payment.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { provider } = await context.params;
    const signatureHeader = request.headers.get("stripe-signature") ?? "";
    const rawBody = await request.text();

    const runtime = env as unknown as { STRIPE_WEBHOOK_SECRET?: string };
    const secret = runtime.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return Response.json(
        { error: "Stripe webhook secret is not configured." },
        { status: 503 },
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const verification = verifyStripeSignature(
      rawBody,
      signatureHeader,
      secret,
      nowSeconds,
    );
    if (!verification.valid) {
      return Response.json(
        { error: "Invalid webhook signature." },
        { status: 401 },
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const eventType =
      typeof payload.type === "string" ? payload.type : "unknown";
    const eventClass = classifyWebhookEvent(eventType);
    const eventId =
      typeof payload.id === "string" ? payload.id : crypto.randomUUID();

    // Extract the workspace id from the event payload. Stripe does not know
    // about Distribution OS workspaces, so we require integrators to attach
    // the workspace id as `workspace_id` metadata on the source object. When
    // absent, the payment is recorded under a synthetic "unattributed" tenant
    // so the event is still observable in the audit log.
    const workspaceId =
      readWorkspaceIdFromPayload(payload) ?? "ws_unattributed";

    if (eventClass === "payment") {
      const amountCents = readAmountCents(payload);
      const currency = readCurrency(payload);
      const providerPaymentId = readProviderPaymentId(payload);
      const status = readPaymentStatus(eventType);
      if (providerPaymentId && amountCents !== null) {
        try {
          await recordPayment(workspaceId, {
            provider,
            provider_payment_id: providerPaymentId,
            amount_cents: amountCents,
            currency,
            status,
            raw_event: payload,
            received_at: Date.now(),
          });
        } catch {
          // Recording the payment must never block the webhook
          // acknowledgement — Stripe retries failed deliveries, so a transient
          // D1 error should still return 200 to stop the retry storm.
        }
      }
    }

    try {
      await logAuditEvent(workspaceId, {
        event_category: "payment",
        event_type: `webhook.${eventClass}`,
        action_id: null,
        resource_type: "webhook",
        resource_id: eventId,
        detail: {
          provider,
          event_type: eventType,
          event_class: eventClass,
          signature_timestamp: verification.timestamp,
        },
      });
    } catch {
      // Audit logging must never break the webhook acknowledgement.
    }

    return Response.json({ received: true, event_class: eventClass });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}

function readWorkspaceIdFromPayload(payload: Record<string, unknown>): string | null {
  const direct = payload.workspace_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const data = payload.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    const objectField = dataRecord.object;
    if (objectField && typeof objectField === "object") {
      const objectRecord = objectField as Record<string, unknown>;
      const meta = objectRecord.metadata;
      if (meta && typeof meta === "object") {
        const metaRecord = meta as Record<string, unknown>;
        const metaWorkspace = metaRecord.workspace_id;
        if (typeof metaWorkspace === "string" && metaWorkspace.trim()) {
          return metaWorkspace.trim();
        }
      }
    }
  }
  return null;
}

function readAmountCents(payload: Record<string, unknown>): number | null {
  const data = payload.data;
  if (!data || typeof data !== "object") return null;
  const dataRecord = data as Record<string, unknown>;
  const objectField = dataRecord.object;
  if (!objectField || typeof objectField !== "object") return null;
  const objectRecord = objectField as Record<string, unknown>;
  const amount = objectRecord.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return Math.floor(amount);
  }
  const amountReceived = objectRecord.amount_received;
  if (typeof amountReceived === "number" && Number.isFinite(amountReceived)) {
    return Math.floor(amountReceived);
  }
  return null;
}

function readCurrency(payload: Record<string, unknown>): string {
  const data = payload.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    const objectField = dataRecord.object;
    if (objectField && typeof objectField === "object") {
      const objectRecord = objectField as Record<string, unknown>;
      const currency = objectRecord.currency;
      if (typeof currency === "string" && currency.trim()) {
        return currency.trim().toLowerCase();
      }
    }
  }
  return "usd";
}

function readProviderPaymentId(payload: Record<string, unknown>): string | null {
  const data = payload.data;
  if (!data || typeof data !== "object") return null;
  const dataRecord = data as Record<string, unknown>;
  const objectField = dataRecord.object;
  if (!objectField || typeof objectField !== "object") return null;
  const objectRecord = objectField as Record<string, unknown>;
  const id = objectRecord.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

function readPaymentStatus(
  eventType: string,
): "pending" | "succeeded" | "refunded" | "disputed" | "failed" {
  if (/refund/i.test(eventType)) return "refunded";
  if (/dispute/i.test(eventType)) return "disputed";
  if (/failed|canceled|cancelled/i.test(eventType)) return "failed";
  if (/succeeded|paid|completed/i.test(eventType)) return "succeeded";
  return "pending";
}

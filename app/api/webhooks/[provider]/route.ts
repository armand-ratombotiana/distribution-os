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
    if (provider.toLowerCase() !== "stripe") {
      return Response.json({ error: "Unsupported webhook provider." }, { status: 404 });
    }
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

    // Stripe does not know Distribution OS tenancy, so the integration must
    // copy workspace_id into metadata on every relevant source object. Missing
    // tenancy is rejected rather than assigned to a synthetic shared tenant.
    const workspaceId = readMetadataValue(payload, "workspace_id");
    if (!workspaceId) {
      return Response.json(
        { error: "Stripe object metadata.workspace_id is required." },
        { status: 400 },
      );
    }

    const recordsPayment =
      ["payment", "refund", "dispute", "invoice"].includes(eventClass) ||
      eventType === "checkout.session.completed";
    if (recordsPayment) {
      const amountCents = readAmountCents(payload);
      const currency = readCurrency(payload);
      const providerPaymentId = readProviderPaymentId(payload);
      const status = readPaymentStatus(eventType);
      if (providerPaymentId && amountCents !== null) {
        await recordPayment(workspaceId, {
          mission_id: readMetadataValue(payload, "mission_id"),
          action_id: readMetadataValue(payload, "action_id"),
          experiment_id: readMetadataValue(payload, "experiment_id"),
          provider,
          provider_payment_id: providerPaymentId,
          amount_cents: amountCents,
          currency,
          status,
          attribution_confidence: readMetadataValue(payload, "action_id")
            ? 100
            : readMetadataValue(payload, "mission_id")
              ? 70
              : 0,
          attributed_at: readMetadataValue(payload, "mission_id") ? Date.now() : null,
          raw_event: payload,
          received_at: Date.now(),
        });
        // Persistence failures intentionally bubble so Stripe can retry.
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

function readMetadataValue(payload: Record<string, unknown>, key: string): string | null {
  const direct = payload[key];
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
        const value = metaRecord[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
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
  const amountPaid = objectRecord.amount_paid;
  if (typeof amountPaid === "number" && Number.isFinite(amountPaid)) {
    return Math.floor(amountPaid);
  }
  const amountTotal = objectRecord.amount_total;
  if (typeof amountTotal === "number" && Number.isFinite(amountTotal)) {
    return Math.floor(amountTotal);
  }
  const amountRefunded = objectRecord.amount_refunded;
  if (typeof amountRefunded === "number" && Number.isFinite(amountRefunded)) {
    return Math.floor(amountRefunded);
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

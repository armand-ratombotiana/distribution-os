import { env } from "cloudflare:workers";
import { recordPayment } from "../../../../db/payments";
import { logAuditEvent } from "../../../../db/audit";
import {
  classifyWebhookEvent,
  verifyStripeSignature,
} from "../../../../lib/webhook-signature-pure";
import { hashPayload } from "../../../../db/actions";
import { getRawDb } from "../../../../db/index";
import {
  resendEventState,
  verifyAndParseResendWebhook,
} from "../../../../lib/resend-webhook";

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
    if (provider.toLowerCase() === "resend") {
      return handleResendWebhook(request);
    }
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

async function handleResendWebhook(request: Request): Promise<Response> {
  const runtime = env as unknown as {
    RESEND_WEBHOOK_SECRET?: string;
    RESEND_WORKSPACE_ID?: string;
  };
  const secret = runtime.RESEND_WEBHOOK_SECRET?.trim();
  const enabledWorkspaceId = runtime.RESEND_WORKSPACE_ID?.trim();
  if (!secret || !enabledWorkspaceId) {
    return Response.json({ error: "Resend webhook verification is not configured." }, { status: 503 });
  }
  const rawBody = await request.text();
  const eventId = request.headers.get("svix-id")?.trim() ?? "";
  const timestamp = request.headers.get("svix-timestamp")?.trim() ?? "";
  const signature = request.headers.get("svix-signature")?.trim() ?? "";
  if (!eventId || !timestamp || !signature) {
    return Response.json({ error: "Missing Resend webhook signature headers." }, { status: 401 });
  }

  let event;
  try {
    event = verifyAndParseResendWebhook({ rawBody, secret, id: eventId, timestamp, signature });
  } catch {
    return Response.json({ error: "Invalid Resend webhook signature or payload." }, { status: 401 });
  }

  const db = getRawDb();
  const now = Date.now();
  const parsedOccurredAt = Date.parse(event.created_at);
  const occurredAt = Number.isFinite(parsedOccurredAt) ? parsedOccurredAt : now;
  const payloadHash = await hashPayload(event);
  const eventJson = JSON.stringify(event);
  const state = resendEventState(event.type);
  const title = `Resend ${event.type.replace("email.", "")}`;
  const eventRowId = `pwe_${crypto.randomUUID()}`;

  const existing = await db
    .prepare("SELECT id, workspace_id, action_id FROM provider_webhook_events WHERE provider = 'resend' AND provider_event_id = ? LIMIT 1")
    .bind(eventId)
    .first<{ id: string; workspace_id: string; action_id: string | null }>();
  if (existing && existing.workspace_id !== enabledWorkspaceId) {
    return Response.json(
      { error: "Resend event is already bound to another workspace." },
      { status: 409 },
    );
  }
  if (existing?.action_id) {
    return Response.json({ received: true, duplicate: true, matched: true });
  }

  const attempt = await db
    .prepare("SELECT workspace_id, mission_id, action_id FROM action_execution_attempts WHERE provider = 'resend' AND provider_request_id = ? AND workspace_id = ? AND status = 'succeeded' LIMIT 1")
    .bind(event.data.email_id, enabledWorkspaceId)
    .first<{ workspace_id: string; mission_id: string; action_id: string }>();
  if (!attempt) {
    // A signed provider event can arrive before the request thread has persisted
    // its successful execution attempt. Persist the normalized event before the
    // acknowledgement so a later redelivery or reconciliation pass can attach it.
    // The configured workspace is the only tenant this single-account sandbox
    // adapter is allowed to receive for.
    await db
      .prepare("INSERT OR IGNORE INTO provider_webhook_events (id, workspace_id, action_id, provider, provider_event_id, provider_request_id, event_type, payload_hash, occurred_at, received_at, created_at) VALUES (?, ?, NULL, 'resend', ?, ?, ?, ?, ?, ?, ?)")
      .bind(eventRowId, enabledWorkspaceId, eventId, event.data.email_id, event.type, payloadHash, occurredAt, now, now)
      .run();
    return Response.json(
      { received: true, matched: false, persisted: true },
      { status: 202 },
    );
  }

  const missionDetail = `Signed provider event ${event.type}; provider request ${event.data.email_id}.`;
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO provider_webhook_events (id, workspace_id, action_id, provider, provider_event_id, provider_request_id, event_type, payload_hash, occurred_at, received_at, created_at) VALUES (?, ?, ?, 'resend', ?, ?, ?, ?, ?, ?, ?)").bind(eventRowId, attempt.workspace_id, attempt.action_id, eventId, event.data.email_id, event.type, payloadHash, occurredAt, now, now),
    db.prepare("UPDATE provider_webhook_events SET action_id = ? WHERE workspace_id = ? AND provider = 'resend' AND provider_event_id = ? AND action_id IS NULL").bind(attempt.action_id, attempt.workspace_id, eventId),
    db.prepare("INSERT OR IGNORE INTO touchpoints (id, workspace_id, mission_id, action_id, experiment_id, channel, event_type, occurred_at, received_at, provider_event_id, raw_event_json, created_at) VALUES (?, ?, ?, ?, NULL, 'email', ?, ?, ?, ?, ?, ?)").bind(`tp_${eventId}`, attempt.workspace_id, attempt.mission_id, attempt.action_id, event.type, occurredAt, now, eventId, eventJson, now),
    db.prepare("INSERT OR IGNORE INTO evidence (id, workspace_id, mission_id, source_url, source_type, content_hash, parser_version, title, summary, extracted_facts_json, provenance_json, state, contradiction_of_id, created_at, updated_at) VALUES (?, ?, ?, NULL, 'provider_webhook', ?, '1.0', ?, ?, ?, ?, ?, NULL, ?, ?)").bind(`ev_${eventId}`, attempt.workspace_id, attempt.mission_id, payloadHash, title, `Signed Resend event ${event.type} for the submitted email.`, JSON.stringify({ provider_request_id: event.data.email_id, event_type: event.type, occurred_at: event.created_at }), JSON.stringify({ provider: "resend", svix_id: eventId, action_id: attempt.action_id }), state, now, now),
    db.prepare("INSERT INTO mission_events (mission_id, event_type, title, detail, actor, created_at) SELECT ?, 'measurement', ?, ?, 'Resend webhook', ? WHERE NOT EXISTS (SELECT 1 FROM mission_events WHERE mission_id = ? AND event_type = 'measurement' AND detail = ?)").bind(attempt.mission_id, title, missionDetail, now, attempt.mission_id, missionDetail),
  ]);

  if (["email.bounced", "email.failed", "email.complained", "email.suppressed"].includes(event.type)) {
    await db.prepare("UPDATE connector_installations SET status = CASE WHEN status IN ('healthy','connected') THEN 'degraded' ELSE status END, last_error = ?, health_checked_at = ?, updated_at = ? WHERE workspace_id = ? AND provider = 'Resend'").bind(`Signed provider event: ${event.type}`, now, now, attempt.workspace_id).run();
  }
  return Response.json({ received: true, matched: true, event_type: event.type });
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

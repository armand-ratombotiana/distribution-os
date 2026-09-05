import { Webhook } from "svix";
import { z } from "zod";

const supportedEventTypes = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.failed",
  "email.opened",
  "email.clicked",
  "email.complained",
  "email.suppressed",
] as const;

export const resendWebhookSchema = z.object({
  type: z.enum(supportedEventTypes),
  created_at: z.string().datetime({ offset: true }),
  data: z.object({
    email_id: z.string().trim().min(1).max(200),
  }).passthrough(),
}).passthrough();

export type ResendWebhookEvent = z.infer<typeof resendWebhookSchema>;

export function verifyAndParseResendWebhook(args: {
  rawBody: string;
  secret: string;
  id: string;
  timestamp: string;
  signature: string;
}): ResendWebhookEvent {
  new Webhook(args.secret).verify(args.rawBody, {
    "svix-id": args.id,
    "svix-timestamp": args.timestamp,
    "svix-signature": args.signature,
  });
  return resendWebhookSchema.parse(JSON.parse(args.rawBody));
}

export function resendEventState(eventType: ResendWebhookEvent["type"]): "observed" | "verified" {
  return eventType === "email.delivered" ? "verified" : "observed";
}

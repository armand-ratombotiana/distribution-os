/**
 * Pure webhook router.
 *
 * Classifies incoming webhook events by category, decides whether they should
 * be deduplicated, and builds stable dedup keys. Stripe helpers extract the
 * event id, payment object id and amount from Stripe's nested payload shape.
 */

export type WebhookSource = "stripe" | "github" | "slack" | "shopify" | "unknown";

export type WebhookEvent = {
  source: WebhookSource;
  type: string;
  payload: Record<string, unknown>;
  receivedAt?: number;
};

export type EventCategory =
  | "payment"
  | "refund"
  | "subscription"
  | "issue"
  | "pull_request"
  | "message"
  | "order"
  | "unknown";

export type RoutedEvent = {
  event: WebhookEvent;
  category: EventCategory;
  deduplicate: boolean;
  dedupKey?: string;
};

/**
 * Classify a webhook event into a broad category based on its source and type.
 */
export function classifyEvent(event: WebhookEvent): EventCategory {
  const type = event.type.toLowerCase();

  if (type.includes("refund") || type.includes("reversal")) {
    return "refund";
  }
  if (
    type.includes("payment") ||
    type.includes("charge") ||
    type.includes("payment_intent")
  ) {
    return "payment";
  }
  if (type.includes("subscription") || type.includes("invoice")) {
    return "subscription";
  }
  if (type.includes("issue")) {
    return "issue";
  }
  if (type.includes("pull_request") || type.includes("pr.")) {
    return "pull_request";
  }
  if (type.includes("message")) {
    return "message";
  }
  if (type.includes("order")) {
    return "order";
  }
  return "unknown";
}

/**
 * Whether an event of the given category should be deduplicated.
 * Stripe events always carry a unique event id, so they are dedup-able.
 * GitHub PR events and Shopify order events are also dedup-able.
 */
export function shouldDeduplicate(
  event: WebhookEvent,
  category: EventCategory,
): boolean {
  if (event.source === "stripe") return true;
  if (event.source === "github" && category === "pull_request") return true;
  if (event.source === "github" && category === "issue") return true;
  if (event.source === "shopify" && category === "order") return true;
  return false;
}

/**
 * Extract the Stripe event id (top-level `id` on the payload).
 * Returns undefined for non-Stripe events or when the id is missing.
 */
export function extractStripeEventId(event: WebhookEvent): string | undefined {
  if (event.source !== "stripe") return undefined;
  const id = event.payload.id;
  if (typeof id === "string") return id;
  return undefined;
}

/**
 * Extract the id of the Stripe resource nested at `data.object.id`
 * (e.g. `pi_...`, `ch_...`).
 */
export function extractStripePaymentId(event: WebhookEvent): string | undefined {
  if (event.source !== "stripe") return undefined;
  const data = event.payload.data as { object?: Record<string, unknown> } | undefined;
  const obj = data?.object;
  if (!obj) return undefined;
  const id = obj.id;
  if (typeof id === "string") return id;
  return undefined;
}

/**
 * Extract the integer amount (in the smallest currency unit, e.g. cents)
 * from a Stripe event's `data.object.amount`.
 */
export function extractStripeAmount(event: WebhookEvent): number | undefined {
  if (event.source !== "stripe") return undefined;
  const data = event.payload.data as { object?: Record<string, unknown> } | undefined;
  const obj = data?.object;
  if (!obj) return undefined;
  const amount = obj.amount;
  if (typeof amount === "number") return amount;
  return undefined;
}

/**
 * Build a stable dedup key for an event. Returns undefined when the event
 * should not be deduplicated or when insufficient identifying information is
 * present.
 */
export function buildDedupKey(
  event: WebhookEvent,
  category: EventCategory,
): string | undefined {
  if (!shouldDeduplicate(event, category)) return undefined;

  const stripeEventId = extractStripeEventId(event);
  if (stripeEventId) return `stripe:${stripeEventId}`;

  if (event.source === "github" && category === "pull_request") {
    const pr = (event.payload.pull_request as { number?: number } | undefined)?.number;
    const repo = (event.payload.repository as { full_name?: string } | undefined)
      ?.full_name;
    const action = event.type.split(".").pop();
    if (pr !== undefined && repo && action) {
      return `github:${repo}:${pr}:${action}`;
    }
    return undefined;
  }

  if (event.source === "github" && category === "issue") {
    const issue = (event.payload.issue as { number?: number } | undefined)?.number;
    const repo = (event.payload.repository as { full_name?: string } | undefined)
      ?.full_name;
    const action = event.type.split(".").pop();
    if (issue !== undefined && repo && action) {
      return `github:${repo}:issue:${issue}:${action}`;
    }
    return undefined;
  }

  if (event.source === "shopify" && category === "order") {
    const orderId = (event.payload as { id?: string | number }).id;
    if (orderId !== undefined) return `shopify:order:${orderId}`;
  }

  return undefined;
}

/**
 * Full routing pipeline: classify, decide dedup, build key.
 */
export function routeWebhookEvent(event: WebhookEvent): RoutedEvent {
  const category = classifyEvent(event);
  const deduplicate = shouldDeduplicate(event, category);
  const dedupKey = deduplicate ? buildDedupKey(event, category) : undefined;
  return {
    event,
    category,
    deduplicate,
    dedupKey,
  };
}

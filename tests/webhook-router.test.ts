import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyEvent,
  routeWebhookEvent,
  shouldDeduplicate,
  buildDedupKey,
  extractStripeEventId,
  extractStripePaymentId,
  extractStripeAmount,
  type WebhookEvent,
} from "../lib/webhook-router-pure.ts";

const stripePaymentEvent: WebhookEvent = {
  source: "stripe",
  type: "payment_intent.succeeded",
  payload: {
    id: "evt_123",
    data: {
      object: {
        id: "pi_abc",
        amount: 1999,
      },
    },
  },
};

const stripeRefundEvent: WebhookEvent = {
  source: "stripe",
  type: "charge.refunded",
  payload: {
    id: "evt_refund",
    data: { object: { id: "ch_xyz", amount: 500 } },
  },
};

const githubPREvent: WebhookEvent = {
  source: "github",
  type: "pull_request.opened",
  payload: {
    action: "opened",
    pull_request: { number: 42 },
    repository: { full_name: "acme/repo" },
  },
};

const slackMessageEvent: WebhookEvent = {
  source: "slack",
  type: "message",
  payload: { channel: "C123", text: "hello" },
};

test("classifyEvent classifies payment_intent.succeeded as payment", () => {
  assert.equal(classifyEvent(stripePaymentEvent), "payment");
});

test("classifyEvent classifies charge.refunded as refund", () => {
  assert.equal(classifyEvent(stripeRefundEvent), "refund");
});

test("classifyEvent classifies pull_request.opened as pull_request", () => {
  assert.equal(classifyEvent(githubPREvent), "pull_request");
});

test("classifyEvent classifies message as message", () => {
  assert.equal(classifyEvent(slackMessageEvent), "message");
});

test("classifyEvent returns unknown for unrecognized types", () => {
  const e: WebhookEvent = {
    source: "unknown",
    type: "something.weird",
    payload: {},
  };
  assert.equal(classifyEvent(e), "unknown");
});

test("shouldDeduplicate returns true for stripe events", () => {
  assert.equal(shouldDeduplicate(stripePaymentEvent, "payment"), true);
  assert.equal(shouldDeduplicate(stripeRefundEvent, "refund"), true);
});

test("shouldDeduplicate returns true for github pull_request events", () => {
  assert.equal(shouldDeduplicate(githubPREvent, "pull_request"), true);
});

test("shouldDeduplicate returns false for slack messages", () => {
  assert.equal(shouldDeduplicate(slackMessageEvent, "message"), false);
});

test("buildDedupKey returns stripe:<eventId> for stripe events", () => {
  assert.equal(buildDedupKey(stripePaymentEvent, "payment"), "stripe:evt_123");
  assert.equal(buildDedupKey(stripeRefundEvent, "refund"), "stripe:evt_refund");
});

test("buildDedupKey returns github:<repo>:<pr>:<action> for PR events", () => {
  assert.equal(
    buildDedupKey(githubPREvent, "pull_request"),
    "github:acme/repo:42:opened",
  );
});

test("buildDedupKey returns undefined when the event should not be deduplicated", () => {
  assert.equal(buildDedupKey(slackMessageEvent, "message"), undefined);
});

test("extractStripeEventId returns the event id and undefined for non-stripe sources", () => {
  assert.equal(extractStripeEventId(stripePaymentEvent), "evt_123");
  assert.equal(extractStripeEventId(githubPREvent), undefined);
  const missingId: WebhookEvent = {
    source: "stripe",
    type: "x.y",
    payload: {},
  };
  assert.equal(extractStripeEventId(missingId), undefined);
});

test("extractStripePaymentId returns the inner data.object.id", () => {
  assert.equal(extractStripePaymentId(stripePaymentEvent), "pi_abc");
  assert.equal(extractStripePaymentId(stripeRefundEvent), "ch_xyz");
  assert.equal(extractStripePaymentId(githubPREvent), undefined);
});

test("extractStripeAmount returns the integer amount from the payload", () => {
  assert.equal(extractStripeAmount(stripePaymentEvent), 1999);
  assert.equal(extractStripeAmount(stripeRefundEvent), 500);
  assert.equal(extractStripeAmount(githubPREvent), undefined);
});

test("routeWebhookEvent returns a routed structure with category, dedup flag and dedup key", () => {
  const routed = routeWebhookEvent(stripePaymentEvent);
  assert.equal(routed.event, stripePaymentEvent);
  assert.equal(routed.category, "payment");
  assert.equal(routed.deduplicate, true);
  assert.equal(routed.dedupKey, "stripe:evt_123");

  const routedSlack = routeWebhookEvent(slackMessageEvent);
  assert.equal(routedSlack.category, "message");
  assert.equal(routedSlack.deduplicate, false);
  assert.equal(routedSlack.dedupKey, undefined);
});

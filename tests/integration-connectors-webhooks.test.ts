import assert from "node:assert/strict";
import test from "node:test";

// Integration: connector lifecycle ↔ webhook signature & classification
//
// Webhook handlers can only fire for connectors that have reached a
// "connected"/"healthy"/"degraded" state. These tests exercise how connector
// state transitions compose with Stripe-style webhook verification and event
// classification.

import {
  CONNECTOR_TRANSITIONS,
  buildConnectorId,
  canTransition as canTransitionConnector,
  isTerminal as isTerminalConnector,
  isTokenExpired,
  needsHealthCheck,
  summarizeForDisplay as summarizeConnector,
  type ConnectorInstallationRow,
} from "../db/connectors-pure";

import { CONNECTOR_STATUSES } from "../db/schema";

import {
  STRIPE_TOLERANCE_SECONDS,
  buildWebhookDedupKey,
  classifyWebhookEvent,
  computeHmacSha256,
  isDuplicateEvent,
  parseStripeSignature,
  timingSafeEqual,
  verifyStripeSignature,
} from "../lib/webhook-signature-pure";

const baseConnector: ConnectorInstallationRow = {
  id: "ws_1:stripe",
  workspace_id: "ws_1",
  provider: "Stripe",
  category: "Commerce & Revenue",
  status: "connected",
  scopes_json: '["payments","webhooks"]',
  capabilities_json: '["charge","refund"]',
  token_reference: "secret-token-ref",
  token_expires_at: null,
  last_sync_at: null,
  last_error: null,
  health_checked_at: null,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
};

const SECRET = "whsec_test_secret";
const TIMESTAMP = 1_700_000_000;
const BODY = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });
const GOOD_SIG = computeHmacSha256(SECRET, `${TIMESTAMP}.${BODY}`);
const GOOD_HEADER = `t=${TIMESTAMP},v1=${GOOD_SIG}`;

test("a webhook can be verified when the connector is in the 'connected' state — the active-serving predicate holds", () => {
  assert.equal(baseConnector.status, "connected");
  const result = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP);
  assert.equal(result.valid, true);
  assert.equal(result.timestamp, TIMESTAMP);
});

test("connector 'revoked' is terminal AND classifyWebhookEvent returns 'other' for unknown event types — both define terminal/unknown buckets", () => {
  assert.equal(isTerminalConnector("revoked"), true);
  assert.equal(canTransitionConnector("revoked", "authorized"), false);
  assert.equal(canTransitionConnector("revoked", "connected"), false);
  assert.equal(classifyWebhookEvent("account.updated"), "other");
  assert.equal(classifyWebhookEvent(""), "other");
});

test("verifyStripeSignature succeeds for a freshly signed payload AND classifyWebhookEvent maps payment_intent.succeeded to 'payment'", () => {
  const result = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP);
  assert.equal(result.valid, true);
  assert.equal(result.expectedSignature, GOOD_SIG);
  assert.equal(classifyWebhookEvent("payment_intent.succeeded"), "payment");
  assert.equal(classifyWebhookEvent("charge.succeeded"), "payment");
  assert.equal(classifyWebhookEvent("payment_method.attached"), "payment");
});

test("needsHealthCheck returns true for a stale 'connected' connector AND isDuplicateEvent detects webhook redelivery", () => {
  const now = 10_000;
  const staleConnector: ConnectorInstallationRow = {
    ...baseConnector,
    status: "connected",
    health_checked_at: now - 600_000,
  };
  assert.equal(needsHealthCheck(staleConnector, now), true);

  const dedupKey = buildWebhookDedupKey("stripe", "evt_1");
  assert.equal(dedupKey, "wh:stripe:evt_1");
  const seen = new Set<string>([dedupKey]);
  assert.equal(isDuplicateEvent("wh:stripe:evt_1", seen), true);
  assert.equal(isDuplicateEvent("wh:stripe:evt_2", seen), false);
  assert.equal(isDuplicateEvent("", seen), false);
});

test("canTransition(connector, setup_required→authorized) AND classifyWebhookEvent maps invoice.paid to 'invoice'", () => {
  assert.equal(canTransitionConnector("setup_required", "authorized"), true);
  assert.equal(canTransitionConnector("setup_required", "connected"), false);
  assert.equal(classifyWebhookEvent("invoice.paid"), "invoice");
  assert.equal(classifyWebhookEvent("invoice.payment_failed"), "invoice");
});

test("buildConnectorId is workspace+provider scoped; buildWebhookDedupKey is provider+eventId scoped", () => {
  const connectorId = buildConnectorId({ workspaceId: "ws_1", provider: "Stripe" });
  assert.equal(connectorId, "ws_1:stripe");
  const spaced = buildConnectorId({ workspaceId: "ws_1", provider: "Google Analytics" });
  assert.equal(spaced, "ws_1:google-analytics");

  const webhookKey = buildWebhookDedupKey("stripe", "evt_42");
  assert.equal(webhookKey, "wh:stripe:evt_42");
  assert.notEqual(buildWebhookDedupKey("github", "evt_42"), webhookKey);
});

test("summarizeForDisplay(connector) redacts token_reference AND isDuplicateEvent returns false for empty eventId", () => {
  const summary = summarizeConnector(baseConnector);
  assert.equal("token_reference" in summary, false);
  assert.equal("workspace_id" in summary, false);
  assert.equal(summary.id, "ws_1:stripe");
  assert.deepEqual(summary.scopes, ["payments", "webhooks"]);
  assert.deepEqual(summary.capabilities, ["charge", "refund"]);

  const seen = new Set<string>(["wh:stripe:evt_1"]);
  assert.equal(isDuplicateEvent("", seen), false);
});

test("verifyStripeSignature rejects expired timestamps AND isTokenExpired returns true past token_expires_at", () => {
  const expired = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP + 600);
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "expired");

  const future = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP - 600);
  assert.equal(future.valid, false);
  assert.equal(future.reason, "future_dated");

  assert.equal(isTokenExpired(1_000, 1_000), true);
  assert.equal(isTokenExpired(1_001, 1_000), false);
  assert.equal(isTokenExpired(null, 1_000), false);
});

test("classifyWebhookEvent('charge.refunded') returns 'refund' AND canTransition(connector, degraded→healthy) returns true", () => {
  assert.equal(classifyWebhookEvent("charge.refunded"), "refund");
  assert.equal(classifyWebhookEvent("charge.dispute.created"), "dispute");
  assert.equal(canTransitionConnector("degraded", "healthy"), true);
  assert.equal(canTransitionConnector("degraded", "disconnected"), true);
  assert.equal(canTransitionConnector("degraded", "revoked"), false);
});

test("parseStripeSignature returns null for malformed headers AND needsHealthCheck returns false for inactive connectors", () => {
  assert.equal(parseStripeSignature(null), null);
  assert.equal(parseStripeSignature(""), null);
  assert.equal(parseStripeSignature("garbage"), null);
  assert.equal(parseStripeSignature("t=1234"), null);
  assert.equal(parseStripeSignature("v1=abc"), null);

  const now = 10_000;
  assert.equal(
    needsHealthCheck({ ...baseConnector, status: "setup_required", health_checked_at: null }, now),
    false,
  );
  assert.equal(
    needsHealthCheck({ ...baseConnector, status: "disconnected", health_checked_at: null }, now),
    false,
  );
  assert.equal(
    needsHealthCheck({ ...baseConnector, status: "revoked", health_checked_at: null }, now),
    false,
  );
});

test("classifyWebhookEvent('customer.subscription.created') returns 'subscription' AND canTransition(connector, connected→disconnected) returns true", () => {
  assert.equal(classifyWebhookEvent("customer.subscription.created"), "subscription");
  assert.equal(classifyWebhookEvent("customer.subscription.deleted"), "subscription");
  assert.equal(canTransitionConnector("connected", "disconnected"), true);
  assert.equal(canTransitionConnector("connected", "healthy"), true);
  assert.equal(canTransitionConnector("connected", "degraded"), true);
  assert.equal(canTransitionConnector("connected", "error"), true);
  assert.equal(canTransitionConnector("connected", "authorized"), false);
});

test("computeHmacSha256 matches the known RFC 4231 vector AND isTokenExpired treats null as non-expiring", () => {
  const expected = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";
  assert.equal(
    computeHmacSha256("key", "The quick brown fox jumps over the lazy dog"),
    expected,
  );
  // isTokenExpired with null returns false (does not expire)
  assert.equal(isTokenExpired(null, Number.MAX_SAFE_INTEGER), false);
  // With explicit expiry in the future, not expired
  assert.equal(isTokenExpired(Date.now() + 60_000, Date.now()), false);
});

test("timingSafeEqual returns false for different-length strings AND canTransition(connector, error→connected) returns false (must recover via authorized)", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
  assert.equal(timingSafeEqual("", "a"), false);
  assert.equal(timingSafeEqual("", ""), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);

  // error → connected is NOT allowed (must go through authorized)
  assert.equal(canTransitionConnector("error", "connected"), false);
  assert.equal(canTransitionConnector("error", "authorized"), true);
  assert.equal(canTransitionConnector("error", "disconnected"), true);
});

test("verifyStripeSignature returns 'signature_mismatch' for a tampered payload AND canTransition(connector, revoked→authorized) returns false (terminal)", () => {
  const tamperedBody = BODY.replace("evt_1", "evt_2");
  const result = verifyStripeSignature(tamperedBody, GOOD_HEADER, SECRET, TIMESTAMP);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature_mismatch");
  assert.equal(result.timestamp, TIMESTAMP);

  // revoked is terminal
  assert.equal(canTransitionConnector("revoked", "authorized"), false);
  assert.equal(canTransitionConnector("revoked", "connected"), false);
  assert.equal(canTransitionConnector("revoked", "disconnected"), false);
});

test("STRIPE_TOLERANCE_SECONDS is 300 (5 min) AND CONNECTOR_STATUSES exposes 8 statuses including 'error'", () => {
  assert.equal(STRIPE_TOLERANCE_SECONDS, 300);
  assert.equal(CONNECTOR_STATUSES.length, 8);
  assert.deepEqual(
    [...CONNECTOR_STATUSES].sort(),
    [
      "authorized",
      "connected",
      "degraded",
      "disconnected",
      "error",
      "healthy",
      "revoked",
      "setup_required",
    ],
  );
  assert.deepEqual(CONNECTOR_TRANSITIONS.setup_required, ["authorized", "disconnected"]);
  assert.deepEqual(CONNECTOR_TRANSITIONS.revoked, []);
});

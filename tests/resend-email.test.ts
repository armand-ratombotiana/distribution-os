import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "svix";

import type { WorkspaceSettingsRow } from "../db/workspace-settings-pure.ts";
import {
  buildResendIdempotencyKey,
  buildResendRequest,
  evaluateResendExecutionPolicy,
  hourInTimezone,
  parseRecipientAllowlist,
  resendEmailPayloadSchema,
  sendWithResend,
} from "../lib/resend-email.ts";
import {
  resendEventState,
  verifyAndParseResendWebhook,
} from "../lib/resend-webhook.ts";

const payload = resendEmailPayloadSchema.parse({
  provider: "resend",
  from: "hello@example.com",
  to: ["founder@example.net"],
  subject: "A measured product update",
  text: "Here is the evidence we gathered this week.",
  projected_cost_cents: 2,
});

const settings: WorkspaceSettingsRow = {
  id: "st_1",
  workspace_id: "ws_1",
  monthly_budget_cents: 100,
  monthly_spent_cents: 10,
  daily_budget_cents: 20,
  daily_spent_cents: 5,
  per_action_budget_cents: 5,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  timezone: "UTC",
  forbidden_claims_json: "[]",
  brand_voice_json: "{}",
  retention_days: 365,
  auto_approve_low_risk: 0,
  max_daily_actions: 10,
  created_at: 1,
  updated_at: 1,
};

const configuration = {
  apiKey: "re_secret",
  fromEmail: payload.from,
  workspaceId: "ws_1",
  allowedRecipients: "founder@example.net",
};

test("resend payload is strict and limited to one recipient", () => {
  assert.equal(resendEmailPayloadSchema.safeParse(payload).success, true);
  assert.equal(resendEmailPayloadSchema.safeParse({ ...payload, to: ["a@example.com", "b@example.com"] }).success, false);
  assert.equal(resendEmailPayloadSchema.safeParse({ ...payload, html: "<b>hidden</b>" }).success, false);
});

test("execution policy allows only configured tenant, sender and recipient", () => {
  const allowed = evaluateResendExecutionPolicy({ payload, settings, workspaceId: "ws_1", currentHour: 12, actionsToday: 0, configuration, connectorInstalled: true });
  assert.deepEqual(allowed, { allowed: true, recipients: ["founder@example.net"] });
  assert.equal(evaluateResendExecutionPolicy({ payload, settings, workspaceId: "ws_2", currentHour: 12, actionsToday: 0, configuration, connectorInstalled: true }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ payload: { ...payload, from: "other@example.com" }, settings, workspaceId: "ws_1", currentHour: 12, actionsToday: 0, configuration, connectorInstalled: true }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ payload: { ...payload, to: ["other@example.net"] }, settings, workspaceId: "ws_1", currentHour: 12, actionsToday: 0, configuration, connectorInstalled: true }).allowed, false);
});

test("execution policy enforces connector, quiet hours, rate, budget and claims", () => {
  const base = { payload, settings, workspaceId: "ws_1", currentHour: 12, actionsToday: 0, configuration, connectorInstalled: true };
  assert.equal(evaluateResendExecutionPolicy({ ...base, connectorInstalled: false }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ ...base, currentHour: 23 }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ ...base, actionsToday: 10 }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ ...base, payload: { ...payload, projected_cost_cents: 6 } }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ ...base, payload: { ...payload, text: "Guaranteed revenue overnight." } }).allowed, false);
  assert.equal(evaluateResendExecutionPolicy({ ...base, settings: { ...settings, forbidden_claims_json: '["secret promise"]' }, payload: { ...payload, text: "Our secret promise applies." } }).allowed, false);
});

test("allowlist and timezone helpers are deterministic", () => {
  assert.deepEqual(parseRecipientAllowlist(" A@EXAMPLE.COM, b@example.com, a@example.com "), ["a@example.com", "b@example.com"]);
  assert.equal(hourInTimezone(new Date("2026-09-06T12:00:00Z"), "Africa/Nairobi"), 15);
});

test("request and idempotency key bind the exact action", () => {
  assert.deepEqual(buildResendRequest(payload), { from: payload.from, to: payload.to, subject: payload.subject, text: payload.text });
  const key = buildResendIdempotencyKey("act_123", "a".repeat(64));
  assert.equal(key, `distribution-os/act_123/${"a".repeat(32)}`);
  assert.ok(key.length <= 256);
});

test("Resend adapter maps confirmed, definitive and ambiguous outcomes", async () => {
  let headers: Headers | undefined;
  const confirmed = await sendWithResend({
    apiKey: "re_secret",
    idempotencyKey: "idem_1",
    payload,
    fetchImpl: async (_input, init) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    },
  });
  assert.equal(confirmed.outcome, "confirmed");
  assert.equal(headers?.get("Authorization"), "Bearer re_secret");
  assert.equal(headers?.get("Idempotency-Key"), "idem_1");

  const rejected = await sendWithResend({ apiKey: "re_secret", idempotencyKey: "idem_2", payload, fetchImpl: async () => new Response(JSON.stringify({ name: "validation_error", message: "bad sender" }), { status: 422 }) });
  assert.equal(rejected.outcome, "definitive_failure");

  const unknown = await sendWithResend({ apiKey: "re_secret", idempotencyKey: "idem_3", payload, fetchImpl: async () => { throw new Error("socket closed"); } });
  assert.equal(unknown.outcome, "ambiguous_failure");
});

test("Resend webhook verifier authenticates the raw body and classifies delivery", () => {
  const secret = `whsec_${Buffer.from("01234567890123456789012345678901").toString("base64")}`;
  const id = "msg_test_delivery";
  const now = new Date();
  const rawBody = JSON.stringify({
    type: "email.delivered",
    created_at: now.toISOString(),
    data: { email_id: "email_1", to: ["founder@example.net"] },
  });
  const webhook = new Webhook(secret);
  const signature = webhook.sign(id, now, rawBody);
  const event = verifyAndParseResendWebhook({
    rawBody,
    secret,
    id,
    timestamp: String(Math.floor(now.getTime() / 1000)),
    signature,
  });
  assert.equal(event.data.email_id, "email_1");
  assert.equal(resendEventState(event.type), "verified");
  assert.throws(() => verifyAndParseResendWebhook({ rawBody: `${rawBody} `, secret, id, timestamp: String(Math.floor(now.getTime() / 1000)), signature }));
});

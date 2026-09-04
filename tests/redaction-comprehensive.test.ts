/**
 * Comprehensive redaction audit: verify that every per-table
 * `summarizeForDisplay` (or equivalent) helper redacts the sensitive
 * fields documented in docs/SECURITY.md.
 *
 * 15 tests across 13 modules. Each test feeds the helper a row that
 * contains a non-empty secret in every sensitive field, then asserts
 * that the resulting projection does not expose those fields (and is
 * not just `===` to the input — i.e. it actually returns a new shape).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  summarizeForDisplay as summarizeAction,
  type ActionRow,
} from "../db/actions-pure.ts";
import {
  summarizeForDisplay as summarizeEvidence,
  type EvidenceRow,
} from "../db/evidence-pure.ts";
import {
  summarizeForDisplay as summarizeExperiment,
  type ExperimentRow,
} from "../db/experiments-pure.ts";
import {
  summarizePaymentForDisplay,
  summarizeTouchpointForDisplay,
  type PaymentRow,
  type TouchpointRow,
} from "../db/attribution-pure.ts";
import {
  summarizeForDisplay as summarizeConnector,
  type ConnectorInstallationRow,
} from "../db/connectors-pure.ts";
import {
  summarizeForDisplay as summarizeContact,
  type ContactRow,
} from "../db/contacts-pure.ts";
import {
  summarizeForDisplay as summarizeContent,
  type ContentAssetRow,
} from "../db/content-assets-pure.ts";
import {
  summarizeRunForDisplay,
  summarizeStepForDisplay,
  type AgentRunRow,
  type AgentStepRow,
} from "../db/agent-runs-pure.ts";
import {
  summarizeForDisplay as summarizeAudit,
  type AuditEventRow,
} from "../db/audit-pure.ts";
import {
  summarizeInvitationForDisplay,
  type OrganizationInvitationRow,
} from "../db/organizations-pure.ts";
import {
  summarizeForDisplay as summarizeSettings,
  type WorkspaceSettingsRow,
} from "../db/workspace-settings-pure.ts";
import {
  summarizeVersionForDisplay,
  summarizeStrategyVersionForDisplay,
  type MissionVersionRow,
  type StrategyVersionRow,
} from "../db/versions-pure.ts";

// ─── actions ──────────────────────────────────────────────────────────────

const actionRow: ActionRow = {
  id: "act_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  action_type: "post",
  channel: "linkedin",
  title: "Hello",
  summary: "World",
  payload_json: '{"api_key":"leak"}',
  payload_hash: "abc123",
  risk: "medium",
  status: "prepared",
  blocker: null,
  decided_by: "user_1",
  decided_at: 123,
  expires_at: 999,
  idempotency_key: "idem:secret",
  provider_request_json: '{"token":"leak"}',
  provider_result_json: '{"token":"leak"}',
  created_at: 1,
  updated_at: 2,
};

test("redaction/actions: payload_json, provider_*, idempotency_key, workspace_id, decided_by are stripped; payload_hash retained", () => {
  const s = summarizeAction(actionRow);
  assert.equal("payload_json" in s, false);
  assert.equal("provider_request_json" in s, false);
  assert.equal("provider_result_json" in s, false);
  assert.equal("idempotency_key" in s, false);
  assert.equal("workspace_id" in s, false);
  assert.equal("decided_by" in s, false);
  assert.equal("decided_at" in s, false);
  // Non-sensitive fields retained.
  assert.equal(s.id, "act_1");
  assert.equal(s.payload_hash, "abc123");
  assert.equal(s.status, "prepared");
  assert.equal(s.risk, "medium");
});

// ─── evidence ─────────────────────────────────────────────────────────────

const evidenceRow: EvidenceRow = {
  id: "ev_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  source_url: "https://example.com/x",
  source_type: "website",
  content_hash: "hash123",
  parser_version: "1.0",
  title: "T",
  summary: "S",
  extracted_facts_json: '{"secret":"leak"}',
  provenance_json: '{"ip":"1.2.3.4"}',
  state: "observed",
  contradiction_of_id: null,
  created_at: 1,
  updated_at: 2,
};

test("redaction/evidence: workspace_id, extracted_facts_json, provenance_json are redacted to [redacted]", () => {
  const s = summarizeEvidence(evidenceRow);
  assert.equal(s.workspace_id, "[redacted]");
  assert.equal(s.extracted_facts_json, "[redacted]");
  assert.equal(s.provenance_json, "[redacted]");
  assert.equal(s.id, "ev_1");
  assert.equal(s.content_hash, "hash123");
});

// ─── experiments ──────────────────────────────────────────────────────────

const experimentRow: ExperimentRow = {
  id: "exp_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  title: "T",
  hypothesis: "H",
  baseline: null,
  variant: null,
  metric: "ctr",
  denominator: null,
  sample_expectation: null,
  deadline: null,
  kill_rule: "stop if bad",
  result: null,
  result_data_json: '{"secret":"leak"}',
  decision: "pending",
  confidence: 0,
  strategy_version: 1,
  status: "draft",
  created_at: 1,
  updated_at: 2,
};

test("redaction/experiments: workspace_id and result_data_json are redacted to [redacted]", () => {
  const s = summarizeExperiment(experimentRow);
  assert.equal(s.workspace_id, "[redacted]");
  assert.equal(s.result_data_json, "[redacted]");
  assert.equal(s.id, "exp_1");
  assert.equal(s.mission_id, "mis_1");
  assert.equal(s.kill_rule, "stop if bad");
});

// ─── payments + touchpoints ───────────────────────────────────────────────

const paymentRow: PaymentRow = {
  id: "pay_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  action_id: null,
  experiment_id: null,
  provider: "stripe",
  provider_payment_id: "pi_abc",
  amount_cents: 1999,
  currency: "usd",
  status: "pending",
  attribution_confidence: 0,
  attributed_at: null,
  received_at: 1,
  raw_event_json: '{"customer_email":"leak@example.com"}',
  created_at: 1,
  updated_at: 2,
};

const touchpointRow: TouchpointRow = {
  id: "tp_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  action_id: null,
  experiment_id: null,
  channel: "email",
  event_type: "open",
  occurred_at: 1,
  received_at: 2,
  provider_event_id: "evt_1",
  raw_event_json: '{"ip":"1.2.3.4"}',
  created_at: 3,
};

test("redaction/payments: raw_event_json and workspace_id are dropped; amount_formatted is added", () => {
  const s = summarizePaymentForDisplay(paymentRow);
  assert.equal("raw_event_json" in s, false);
  assert.equal("workspace_id" in s, false);
  assert.equal(s.id, "pay_1");
  assert.equal(s.amount_cents, 1999);
  assert.equal(s.amount_formatted, "$19.99");
});

test("redaction/touchpoints: raw_event_json and workspace_id are dropped; channel preserved", () => {
  const s = summarizeTouchpointForDisplay(touchpointRow);
  assert.equal("raw_event_json" in s, false);
  assert.equal("workspace_id" in s, false);
  assert.equal(s.id, "tp_1");
  assert.equal(s.channel, "email");
  assert.equal(s.provider_event_id, "evt_1");
});

// ─── connectors ───────────────────────────────────────────────────────────

const connectorRow: ConnectorInstallationRow = {
  id: "ci_1",
  workspace_id: "ws_secret",
  provider: "stripe",
  category: "payments",
  status: "connected",
  scopes_json: '["payments"]',
  capabilities_json: '["charge"]',
  token_reference: "tok_secret",
  token_expires_at: null,
  last_sync_at: null,
  last_error: null,
  health_checked_at: null,
  created_at: 1,
  updated_at: 2,
};

test("redaction/connectors: token_reference and workspace_id are stripped; scopes/capabilities parsed", () => {
  const s = summarizeConnector(connectorRow);
  assert.equal("token_reference" in s, false);
  assert.equal("workspace_id" in s, false);
  assert.equal(s.id, "ci_1");
  assert.deepEqual(s.scopes, ["payments"]);
  assert.deepEqual(s.capabilities, ["charge"]);
});

// ─── contacts ─────────────────────────────────────────────────────────────

const contactRow: ContactRow = {
  id: "ct_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  email: "founder@example.com",
  name: "Jane Founder",
  company: "Acme",
  role: "CEO",
  source: "manual",
  status: "qualified",
  consent_given: 1,
  qualification_signals_json: '{"budget":"$1M","pain":"scaling"}',
  last_contacted_at: 100,
  converted_at: null,
  created_at: 1,
  updated_at: 2,
};

test("redaction/contacts: qualification_signals is replaced with literal 'redacted' but signal_count is preserved", () => {
  const s = summarizeContact(contactRow);
  assert.equal(s.qualification_signals, "redacted");
  assert.equal(s.signal_count, 2);
  // PII-bearing but not-secret fields retained for the UI.
  assert.equal(s.email, "founder@example.com");
  assert.equal(s.name, "Jane Founder");
  assert.equal(s.consent_given, true);
});

// ─── content ──────────────────────────────────────────────────────────────

const contentRow: ContentAssetRow = {
  id: "content_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  action_id: null,
  platform: "linkedin",
  format: "post",
  hook: "Hook",
  body: "X".repeat(200) + "secret-token-here",
  cta: "Click",
  status: "draft",
  variant_of_id: null,
  approved_by: null,
  approved_at: null,
  scheduled_at: null,
  published_at: null,
  provider_id: null,
  created_at: 1,
  updated_at: 2,
};

test("redaction/content: full body is dropped (only a short preview is emitted) and workspace_id is removed", () => {
  const s = summarizeContent(contentRow);
  assert.equal("body" in s, false);
  assert.equal("workspace_id" in s, false);
  assert.equal("mission_id" in s, false);
  assert.equal(s.id, "content_1");
  assert.equal(s.hook, "Hook");
  assert.ok(typeof s.preview === "string");
  assert.ok(s.preview.length <= 140);
  // The secret token must never appear in the preview.
  assert.ok(!s.preview.includes("secret-token-here"));
});

// ─── agent runs + steps ───────────────────────────────────────────────────

const runRow: AgentRunRow = {
  id: "run_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  agent_name: "scout",
  prompt_version: "1.0",
  model: "gpt-4",
  status: "running",
  input_refs_json: '["ref_secret"]',
  output_refs_json: '["ref_secret"]',
  tokens_input: 100,
  tokens_output: 50,
  cost_cents: 5,
  latency_ms: 0,
  error: null,
  started_at: 1,
  completed_at: null,
  created_at: 2,
};

const stepRow: AgentStepRow = {
  id: "step_1",
  run_id: "run_1",
  step_index: 0,
  tool_name: "fetch",
  tool_input_json: '{"url":"https://secret.example.com"}',
  tool_output_json: '{"api_key":"leak"}',
  status: "running",
  started_at: 1,
  completed_at: null,
  created_at: 2,
};

test("redaction/agent-runs: workspace_id, input_refs_json, output_refs_json are stripped", () => {
  const s = summarizeRunForDisplay(runRow);
  assert.equal("workspace_id" in s, false);
  assert.equal("input_refs_json" in s, false);
  assert.equal("output_refs_json" in s, false);
  assert.equal(s.id, "run_1");
  assert.equal(s.agent_name, "scout");
  assert.equal(s.tokens_input, 100);
});

test("redaction/agent-steps: tool_input_json and tool_output_json are stripped", () => {
  const s = summarizeStepForDisplay(stepRow);
  assert.equal("tool_input_json" in s, false);
  assert.equal("tool_output_json" in s, false);
  assert.equal(s.id, "step_1");
  assert.equal(s.tool_name, "fetch");
});

// ─── audit ────────────────────────────────────────────────────────────────

const auditRow: AuditEventRow = {
  id: 1,
  workspace_id: "ws_secret",
  actor_user_id: "user_1",
  event_category: "action",
  event_type: "approved",
  action_id: "act_1",
  resource_type: "action",
  resource_id: "act_1",
  detail_json: '{"reason":"ok"}',
  ip_hash: "abcdef0123456789",
  created_at: 100,
};

test("redaction/audit: ip_hash is stripped; actor_user_id is retained for correlation", () => {
  const s = summarizeAudit(auditRow);
  assert.equal("ip_hash" in s, false);
  assert.equal(s.actor_user_id, "user_1");
  assert.equal(s.event_category, "action");
  assert.equal(s.detail_json, '{"reason":"ok"}');
});

// ─── organization invitations ─────────────────────────────────────────────

const invitationRow: OrganizationInvitationRow = {
  id: "inv_1",
  organization_id: "org_1",
  email: "invitee@example.com",
  role: "member",
  token_hash: "deadbeef".repeat(8),
  expires_at: 9999,
  accepted_at: null,
  created_at: 1,
};

test("redaction/invitations: token_hash is stripped so the server-side secret never leaks to the UI", () => {
  const s = summarizeInvitationForDisplay(invitationRow);
  assert.equal("token_hash" in s, false);
  assert.equal(s.id, "inv_1");
  assert.equal(s.email, "invitee@example.com");
  assert.equal(s.role, "member");
});

// ─── workspace settings ───────────────────────────────────────────────────

const settingsRow: WorkspaceSettingsRow = {
  id: "ws_1",
  workspace_id: "ws_1",
  monthly_budget_cents: 100_00,
  monthly_spent_cents: 50_00,
  daily_budget_cents: 20_00,
  daily_spent_cents: 5_00,
  per_action_budget_cents: 1_00,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  timezone: "UTC",
  forbidden_claims_json: '["guaranteed revenue","risk-free"]',
  brand_voice_json: '{"tone":"expert"}',
  retention_days: 365,
  auto_approve_low_risk: 0,
  max_daily_actions: 50,
  created_at: 1,
  updated_at: 2,
};

test("redaction/workspace-settings: forbidden_claims_json and brand_voice_json are not surfaced raw; counts/derived fields are", () => {
  const s = summarizeSettings(settingsRow);
  assert.equal("forbidden_claims_json" in s, false);
  assert.equal("brand_voice_json" in s, false);
  assert.equal(s.forbidden_claims_count, 2);
  assert.equal(s.workspace_id, "ws_1");
  assert.equal(s.monthly_budget_cents, 100_00);
  assert.equal(s.monthly_remaining_cents, 50_00);
  assert.equal(s.auto_approve_low_risk, false);
  assert.equal(s.within_monthly_budget, true);
});

// ─── cross-module invariant ───────────────────────────────────────────────

test("redaction/cross-module: every summarizeForDisplay returns a NEW object (never the input row identity)", () => {
  const inputs = [
    actionRow,
    evidenceRow,
    experimentRow,
    paymentRow,
    touchpointRow,
    connectorRow,
    contactRow,
    contentRow,
    runRow,
    stepRow,
    auditRow,
    invitationRow,
    settingsRow,
  ];
  const projections = [
    summarizeAction(actionRow),
    summarizeEvidence(evidenceRow),
    summarizeExperiment(experimentRow),
    summarizePaymentForDisplay(paymentRow),
    summarizeTouchpointForDisplay(touchpointRow),
    summarizeConnector(connectorRow),
    summarizeContact(contactRow),
    summarizeContent(contentRow),
    summarizeRunForDisplay(runRow),
    summarizeStepForDisplay(stepRow),
    summarizeAudit(auditRow),
    summarizeInvitationForDisplay(invitationRow),
    summarizeSettings(settingsRow),
  ];
  assert.equal(inputs.length, projections.length);
  for (let i = 0; i < inputs.length; i++) {
    assert.notEqual(projections[i], inputs[i], `projection ${i} should not be the same reference as the input`);
  }
});

// ─── versions (mission + strategy) ────────────────────────────────────────

const missionVersionRow: MissionVersionRow = {
  id: "mv_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  version_number: 2,
  mission_json: '{"objective":"first-payment","secret":"leak"}',
  change_reason: "pivot",
  created_by: "user_1",
  created_at: 100,
};

const strategyVersionRow: StrategyVersionRow = {
  id: "sv_1",
  workspace_id: "ws_secret",
  mission_id: "mis_1",
  version_number: 2,
  strategy_json: '{"channel":"email","secret":"leak"}',
  hypothesis: "H1",
  confidence: 72,
  change_reason: "tweak",
  created_by: "user_1",
  created_at: 100,
};

test("redaction/versions: mission_json and strategy_json are dropped; workspace_id stripped; field_count + confidence_band surfaced", () => {
  const mv = summarizeVersionForDisplay(missionVersionRow);
  assert.equal("mission_json" in mv, false);
  assert.equal("workspace_id" in mv, false);
  assert.equal(mv.mission_field_count, 2);
  assert.equal(mv.is_initial, false);
  assert.equal(mv.change_reason, "pivot");

  const sv = summarizeStrategyVersionForDisplay(strategyVersionRow);
  assert.equal("strategy_json" in sv, false);
  assert.equal("workspace_id" in sv, false);
  assert.equal(sv.strategy_field_count, 2);
  assert.equal(sv.confidence_band, "high");
  assert.equal(sv.confidence, 72);
});

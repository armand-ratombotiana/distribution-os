/**
 * Property-based redaction tests.
 *
 * 15 tests covering every `summarizeForDisplay` helper in the codebase.
 * Each test feeds the helper a row containing a unique marker string
 * (e.g. `"MARKER-abc123"`) in EVERY sensitive field, then asserts that:
 *
 *   - The marker never appears in the projection (no leak).
 *   - The audit fields (id, created_at) are always preserved.
 *   - The projection is a NEW object (never the input row by reference).
 *
 * The marker is regenerated for each iteration so a regression that leaks
 * a specific field surfaces immediately. Inputs are produced by a
 * deterministic seeded PRNG (mulberry32) so the suite is reproducible.
 *
 * Pure: imports only `db/*-pure.ts` modules. No I/O.
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

// ─── seeded PRNG ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomMarker(rng: () => number): string {
  // 12-char marker — never appears in any legitimate field value.
  const hex = "0123456789abcdef";
  let s = "MARKER-";
  for (let i = 0; i < 12; i++) s += hex[Math.floor(rng() * 16)];
  return s;
}

function randomId(rng: () => number, prefix: string): string {
  const alnum = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = prefix + "_";
  for (let i = 0; i < 8; i++) s += alnum[Math.floor(rng() * alnum.length)];
  return s;
}

function randomTs(rng: () => number): number {
  return Math.floor(rng() * 1_700_000_000_000);
}

// Walk every leaf string in any JSON-serialisable value and return true if
// the marker appears anywhere.
function containsMarker(value: unknown, marker: string): boolean {
  if (typeof value === "string") return value.includes(marker);
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) {
    for (const v of value) if (containsMarker(v, marker)) return true;
    return false;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (containsMarker(v, marker)) return true;
  }
  return false;
}

const SAMPLES = 60;

// ─── 1. actions ───────────────────────────────────────────────────────────

test("property/redact-actions: payload_json, provider_*, idempotency_key, workspace_id never leak; payload_hash + id retained", () => {
  const rng = mulberry32(301);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "act");
    const row: ActionRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      action_type: "post",
      channel: "linkedin",
      title: "T",
      summary: "S",
      payload_json: `{"secret":"${m}"}`,
      payload_hash: "hash123",
      risk: "medium",
      status: "prepared",
      blocker: null,
      decided_by: m,
      decided_at: 1,
      expires_at: 999,
      idempotency_key: m,
      provider_request_json: `{"token":"${m}"}`,
      provider_result_json: `{"token":"${m}"}`,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeAction(row);
    assert.equal(containsMarker(s, m), false, `marker leaked: ${JSON.stringify(s)}`);
    assert.equal(s.id, id);
    assert.equal(s.payload_hash, "hash123");
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 2. evidence ──────────────────────────────────────────────────────────

test("property/redact-evidence: workspace_id, extracted_facts_json, provenance_json redacted to [redacted]; id + content_hash retained", () => {
  const rng = mulberry32(302);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "ev");
    const row: EvidenceRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      source_url: "https://example.com/x",
      source_type: "website",
      content_hash: "hash123",
      parser_version: "1.0",
      title: "T",
      summary: "S",
      extracted_facts_json: `{"secret":"${m}"}`,
      provenance_json: `{"ip":"${m}"}`,
      state: "observed",
      contradiction_of_id: null,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeEvidence(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.content_hash, "hash123");
    assert.equal(s.workspace_id, "[redacted]");
    assert.equal(s.extracted_facts_json, "[redacted]");
    assert.equal(s.provenance_json, "[redacted]");
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 3. experiments ───────────────────────────────────────────────────────

test("property/redact-experiments: workspace_id + result_data_json redacted; id + kill_rule retained", () => {
  const rng = mulberry32(303);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "exp");
    const row: ExperimentRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
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
      result_data_json: `{"secret":"${m}"}`,
      decision: "pending",
      confidence: 0,
      strategy_version: 1,
      status: "draft",
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeExperiment(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.kill_rule, "stop if bad");
    assert.equal(s.workspace_id, "[redacted]");
    assert.equal(s.result_data_json, "[redacted]");
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 4. payments ──────────────────────────────────────────────────────────

test("property/redact-payments: raw_event_json + workspace_id dropped; id + amount retained", () => {
  const rng = mulberry32(304);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "pay");
    const row: PaymentRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
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
      raw_event_json: `{"customer_email":"${m}"}`,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizePaymentForDisplay(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.amount_cents, 1999);
    assert.equal("raw_event_json" in s, false);
    assert.equal("workspace_id" in s, false);
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 5. touchpoints ───────────────────────────────────────────────────────

test("property/redact-touchpoints: raw_event_json + workspace_id dropped; id + channel retained", () => {
  const rng = mulberry32(305);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "tp");
    const row: TouchpointRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      action_id: null,
      experiment_id: null,
      channel: "email",
      event_type: "open",
      occurred_at: 1,
      received_at: 2,
      provider_event_id: "evt_1",
      raw_event_json: `{"ip":"${m}"}`,
      created_at: 100,
    };
    const s = summarizeTouchpointForDisplay(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.channel, "email");
    assert.equal("raw_event_json" in s, false);
    assert.equal("workspace_id" in s, false);
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 6. connectors ────────────────────────────────────────────────────────

test("property/redact-connectors: token_reference + workspace_id stripped; id + scopes retained", () => {
  const rng = mulberry32(306);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "ci");
    const row: ConnectorInstallationRow = {
      id,
      workspace_id: m,
      provider: "stripe",
      category: "payments",
      status: "connected",
      scopes_json: '["payments"]',
      capabilities_json: '["charge"]',
      token_reference: m,
      token_expires_at: null,
      last_sync_at: null,
      last_error: null,
      health_checked_at: null,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeConnector(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.deepEqual(s.scopes, ["payments"]);
    assert.equal("token_reference" in s, false);
    assert.equal("workspace_id" in s, false);
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 7. contacts ──────────────────────────────────────────────────────────

test("property/redact-contacts: qualification_signals replaced with 'redacted'; id + email retained", () => {
  const rng = mulberry32(307);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "ct");
    const row: ContactRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      email: "founder@example.com",
      name: "Jane Founder",
      company: "Acme",
      role: "CEO",
      source: "manual",
      status: "qualified",
      consent_given: 1,
      qualification_signals_json: `{"secret":"${m}","budget":"$1M"}`,
      last_contacted_at: 100,
      converted_at: null,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeContact(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.email, "founder@example.com");
    assert.equal(s.qualification_signals, "redacted");
    assert.equal(s.signal_count, 2);
    // ContactSummary intentionally does not surface created_at; check
    // last_contacted_at instead as the audit-relevant timestamp.
    assert.equal(s.last_contacted_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 8. content ───────────────────────────────────────────────────────────

test("property/redact-content: body + workspace_id + mission_id dropped; id + hook retained and preview never contains the secret marker", () => {
  const rng = mulberry32(308);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "content");
    const row: ContentAssetRow = {
      id,
      workspace_id: m,
      mission_id: m,
      action_id: null,
      platform: "linkedin",
      format: "post",
      hook: "Hook",
      body: "X".repeat(200) + m,
      cta: "Click",
      status: "draft",
      variant_of_id: null,
      approved_by: null,
      approved_at: null,
      scheduled_at: null,
      published_at: null,
      provider_id: null,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeContent(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.hook, "Hook");
    assert.equal("body" in s, false);
    assert.equal("workspace_id" in s, false);
    assert.equal("mission_id" in s, false);
    assert.ok(typeof s.preview === "string");
    assert.ok(s.preview.length <= 140);
    // ContentSummary intentionally does not surface created_at (only
    // lifecycle timestamps), so we do not assert on it here.
    assert.notEqual(s, row);
  }
});

// ─── 9. agent-runs ────────────────────────────────────────────────────────

test("property/redact-agent-runs: workspace_id + input/output_refs_json stripped; id + agent_name retained", () => {
  const rng = mulberry32(309);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "run");
    const row: AgentRunRow = {
      id,
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      agent_name: "scout",
      prompt_version: "1.0",
      model: "gpt-4",
      status: "running",
      input_refs_json: `["${m}"]`,
      output_refs_json: `["${m}"]`,
      tokens_input: 100,
      tokens_output: 50,
      cost_cents: 5,
      latency_ms: 0,
      error: null,
      started_at: 1,
      completed_at: null,
      created_at: 100,
    };
    const s = summarizeRunForDisplay(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.agent_name, "scout");
    assert.equal("workspace_id" in s, false);
    assert.equal("input_refs_json" in s, false);
    assert.equal("output_refs_json" in s, false);
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 10. agent-steps ──────────────────────────────────────────────────────

test("property/redact-agent-steps: tool_input_json + tool_output_json stripped; id + tool_name retained", () => {
  const rng = mulberry32(310);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "step");
    const row: AgentStepRow = {
      id,
      run_id: randomId(rng, "run"),
      step_index: 0,
      tool_name: "fetch",
      tool_input_json: `{"url":"${m}"}`,
      tool_output_json: `{"api_key":"${m}"}`,
      status: "running",
      started_at: 1,
      completed_at: null,
      created_at: 100,
    };
    const s = summarizeStepForDisplay(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal(s.id, id);
    assert.equal(s.tool_name, "fetch");
    assert.equal("tool_input_json" in s, false);
    assert.equal("tool_output_json" in s, false);
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 11. audit ────────────────────────────────────────────────────────────

test("property/redact-audit: ip_hash stripped; actor_user_id + event_category retained for correlation", () => {
  const rng = mulberry32(311);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const row: AuditEventRow = {
      id: 1 + i,
      // Audit's summarizeForDisplay only redacts ip_hash; workspace_id is
      // intentionally retained because audit rows are already scoped to a
      // workspace at query time. Use a non-marker value here.
      workspace_id: "ws_1",
      actor_user_id: "user_1",
      event_category: "action",
      event_type: "approved",
      action_id: "act_1",
      resource_type: "action",
      resource_id: "act_1",
      detail_json: '{"reason":"ok"}',
      ip_hash: m,
      created_at: 100,
    };
    const s = summarizeAudit(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal("ip_hash" in s, false);
    assert.equal(s.actor_user_id, "user_1");
    assert.equal(s.event_category, "action");
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 12. organization invitations ─────────────────────────────────────────

test("property/redact-invitations: token_hash stripped; id + email retained", () => {
  const rng = mulberry32(312);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const id = randomId(rng, "inv");
    const row: OrganizationInvitationRow = {
      id,
      organization_id: "org_1",
      email: "invitee@example.com",
      role: "member",
      token_hash: m.repeat(8).slice(0, 64),
      expires_at: 9999,
      accepted_at: null,
      created_at: 100,
    };
    const s = summarizeInvitationForDisplay(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal("token_hash" in s, false);
    assert.equal(s.id, id);
    assert.equal(s.email, "invitee@example.com");
    assert.equal(s.created_at, 100);
    assert.notEqual(s, row);
  }
});

// ─── 13. workspace settings ───────────────────────────────────────────────

test("property/redact-settings: forbidden_claims_json + brand_voice_json not surfaced raw; counts/derived fields retained", () => {
  const rng = mulberry32(313);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const row: WorkspaceSettingsRow = {
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
      forbidden_claims_json: `["${m}","risk-free"]`,
      brand_voice_json: `{"tone":"${m}"}`,
      retention_days: 365,
      auto_approve_low_risk: 0,
      max_daily_actions: 50,
      created_at: 100,
      updated_at: 101,
    };
    const s = summarizeSettings(row);
    assert.equal(containsMarker(s, m), false);
    assert.equal("forbidden_claims_json" in s, false);
    assert.equal("brand_voice_json" in s, false);
    assert.equal(s.workspace_id, "ws_1");
    assert.equal(s.forbidden_claims_count, 2);
    assert.equal(s.monthly_remaining_cents, 50_00);
    assert.equal(s.within_monthly_budget, true);
    assert.notEqual(s, row);
  }
});

// ─── 14. mission versions + strategy versions ─────────────────────────────

test("property/redact-versions: mission_json + strategy_json dropped; field_count + confidence_band surfaced; no marker leak", () => {
  const rng = mulberry32(314);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    const mvRow: MissionVersionRow = {
      id: randomId(rng, "mv"),
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      version_number: 2,
      mission_json: `{"objective":"first-payment","secret":"${m}"}`,
      change_reason: "pivot",
      created_by: "user_1",
      created_at: 100,
    };
    const mv = summarizeVersionForDisplay(mvRow);
    assert.equal(containsMarker(mv, m), false);
    assert.equal("mission_json" in mv, false);
    assert.equal("workspace_id" in mv, false);
    assert.equal(mv.mission_field_count, 2);
    assert.equal(mv.created_at, 100);
    assert.notEqual(mv, mvRow);

    const svRow: StrategyVersionRow = {
      id: randomId(rng, "sv"),
      workspace_id: m,
      mission_id: randomId(rng, "mis"),
      version_number: 2,
      strategy_json: `{"channel":"email","secret":"${m}"}`,
      hypothesis: "H1",
      confidence: 72,
      change_reason: "tweak",
      created_by: "user_1",
      created_at: 100,
    };
    const sv = summarizeStrategyVersionForDisplay(svRow);
    assert.equal(containsMarker(sv, m), false);
    assert.equal("strategy_json" in sv, false);
    assert.equal("workspace_id" in sv, false);
    assert.equal(sv.strategy_field_count, 2);
    assert.equal(sv.confidence_band !== undefined, true);
    assert.equal(sv.created_at, 100);
    assert.notEqual(sv, svRow);
  }
});

// ─── 15. cross-module: every projection is a new object AND no marker leaks across all modules ─

test("property/redact-cross-module: across all 15 helpers, projections are new objects and the marker never appears", () => {
  const rng = mulberry32(315);
  for (let i = 0; i < SAMPLES; i++) {
    const m = randomMarker(rng);
    // Build a row for each module, each carrying the marker in every sensitive field.
    const actionRow: ActionRow = {
      id: randomId(rng, "act"), workspace_id: m, mission_id: "mis", action_type: "post", channel: "linkedin",
      title: "T", summary: "S", payload_json: `{"s":"${m}"}`, payload_hash: "h", risk: "medium",
      status: "prepared", blocker: null, decided_by: m, decided_at: 1, expires_at: 9,
      idempotency_key: m, provider_request_json: m, provider_result_json: m, created_at: 1, updated_at: 2,
    };
    const evidenceRow: EvidenceRow = {
      id: randomId(rng, "ev"), workspace_id: m, mission_id: "mis", source_url: "https://x.example.com",
      source_type: "website", content_hash: "h", parser_version: "1", title: "T", summary: "S",
      extracted_facts_json: `{"s":"${m}"}`, provenance_json: `{"s":"${m}"}`, state: "observed",
      contradiction_of_id: null, created_at: 1, updated_at: 2,
    };
    const expRow: ExperimentRow = {
      id: randomId(rng, "exp"), workspace_id: m, mission_id: "mis", title: "T", hypothesis: "H",
      baseline: null, variant: null, metric: "ctr", denominator: null, sample_expectation: null,
      deadline: null, kill_rule: "stop", result: null, result_data_json: `{"s":"${m}"}`,
      decision: "pending", confidence: 0, strategy_version: 1, status: "draft", created_at: 1, updated_at: 2,
    };
    const paymentRow: PaymentRow = {
      id: randomId(rng, "pay"), workspace_id: m, mission_id: "mis", action_id: null, experiment_id: null,
      provider: "stripe", provider_payment_id: "pi", amount_cents: 1999, currency: "usd", status: "pending",
      attribution_confidence: 0, attributed_at: null, received_at: 1, raw_event_json: `{"s":"${m}"}`,
      created_at: 1, updated_at: 2,
    };
    const tpRow: TouchpointRow = {
      id: randomId(rng, "tp"), workspace_id: m, mission_id: "mis", action_id: null, experiment_id: null,
      channel: "email", event_type: "open", occurred_at: 1, received_at: 2, provider_event_id: "evt",
      raw_event_json: `{"s":"${m}"}`, created_at: 1,
    };
    const connRow: ConnectorInstallationRow = {
      id: randomId(rng, "ci"), workspace_id: m, provider: "stripe", category: "payments", status: "connected",
      scopes_json: '["payments"]', capabilities_json: '["charge"]', token_reference: m, token_expires_at: null,
      last_sync_at: null, last_error: null, health_checked_at: null, created_at: 1, updated_at: 2,
    };
    const contactRow: ContactRow = {
      id: randomId(rng, "ct"), workspace_id: m, mission_id: "mis", email: "a@b.com", name: "X", company: "Y",
      role: "Z", source: "manual", status: "qualified", consent_given: 1,
      qualification_signals_json: `{"s":"${m}"}`, last_contacted_at: 1, converted_at: null, created_at: 1, updated_at: 2,
    };
    const contentRow: ContentAssetRow = {
      id: randomId(rng, "content"), workspace_id: m, mission_id: m, action_id: null, platform: "linkedin",
      format: "post", hook: "H", body: "X".repeat(200) + m, cta: "C", status: "draft", variant_of_id: null,
      approved_by: null, approved_at: null, scheduled_at: null, published_at: null, provider_id: null,
      created_at: 1, updated_at: 2,
    };
    const runRow: AgentRunRow = {
      id: randomId(rng, "run"), workspace_id: m, mission_id: "mis", agent_name: "scout", prompt_version: "1",
      model: "gpt-4", status: "running", input_refs_json: `["${m}"]`, output_refs_json: `["${m}"]`,
      tokens_input: 1, tokens_output: 1, cost_cents: 1, latency_ms: 0, error: null,
      started_at: 1, completed_at: null, created_at: 1,
    };
    const stepRow: AgentStepRow = {
      id: randomId(rng, "step"), run_id: "run", step_index: 0, tool_name: "fetch",
      tool_input_json: `{"s":"${m}"}`, tool_output_json: `{"s":"${m}"}`, status: "running",
      started_at: 1, completed_at: null, created_at: 1,
    };
    const auditRow: AuditEventRow = {
      // Audit's summarizeForDisplay only redacts ip_hash; workspace_id is
      // intentionally retained by the audit module (audit queries are
      // already scoped by workspace at the SQL layer). Use a non-marker
      // workspace_id so the cross-module "no marker leak" invariant holds.
      id: i + 1, workspace_id: "ws_1", actor_user_id: "user", event_category: "action", event_type: "approved",
      action_id: "act", resource_type: "action", resource_id: "act", detail_json: "{}", ip_hash: m, created_at: 1,
    };
    const invRow: OrganizationInvitationRow = {
      id: randomId(rng, "inv"), organization_id: "org", email: "a@b.com", role: "member",
      token_hash: m.repeat(8).slice(0, 64), expires_at: 1, accepted_at: null, created_at: 1,
    };
    const settingsRow: WorkspaceSettingsRow = {
      id: "ws_1", workspace_id: "ws_1", monthly_budget_cents: 100_00, monthly_spent_cents: 50_00,
      daily_budget_cents: 20_00, daily_spent_cents: 5_00, per_action_budget_cents: 1_00,
      quiet_hours_start: 22, quiet_hours_end: 8, timezone: "UTC",
      forbidden_claims_json: `["${m}"]`, brand_voice_json: `{"s":"${m}"}`, retention_days: 365,
      auto_approve_low_risk: 0, max_daily_actions: 50, created_at: 1, updated_at: 2,
    };
    const mvRow: MissionVersionRow = {
      id: randomId(rng, "mv"), workspace_id: m, mission_id: "mis", version_number: 1,
      mission_json: `{"s":"${m}"}`, change_reason: "x", created_by: "u", created_at: 1,
    };
    const svRow: StrategyVersionRow = {
      id: randomId(rng, "sv"), workspace_id: m, mission_id: "mis", version_number: 1,
      strategy_json: `{"s":"${m}"}`, hypothesis: "H", confidence: 50, change_reason: "x",
      created_by: "u", created_at: 1,
    };

    const inputs = [actionRow, evidenceRow, expRow, paymentRow, tpRow, connRow, contactRow, contentRow, runRow, stepRow, auditRow, invRow, settingsRow, mvRow, svRow];
    const projections = [
      summarizeAction(actionRow),
      summarizeEvidence(evidenceRow),
      summarizeExperiment(expRow),
      summarizePaymentForDisplay(paymentRow),
      summarizeTouchpointForDisplay(tpRow),
      summarizeConnector(connRow),
      summarizeContact(contactRow),
      summarizeContent(contentRow),
      summarizeRunForDisplay(runRow),
      summarizeStepForDisplay(stepRow),
      summarizeAudit(auditRow),
      summarizeInvitationForDisplay(invRow),
      summarizeSettings(settingsRow),
      summarizeVersionForDisplay(mvRow),
      summarizeStrategyVersionForDisplay(svRow),
    ];
    assert.equal(inputs.length, projections.length);
    for (let j = 0; j < projections.length; j++) {
      assert.notEqual(projections[j], inputs[j], `projection ${j} is the same reference as the input`);
      assert.equal(containsMarker(projections[j], m), false, `marker leaked in projection ${j}: ${JSON.stringify(projections[j]).slice(0, 200)}`);
    }
  }
});

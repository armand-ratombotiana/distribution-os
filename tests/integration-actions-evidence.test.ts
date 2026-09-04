import assert from "node:assert/strict";
import test from "node:test";

// Integration: action queue ↔ evidence ledger
//
// These tests exercise cross-module invariants between `actions-pure` and
// `evidence-pure`: shared hash semantics, parallel state machines, and the
// redaction contracts that hold when actions reference evidence by hash.

import {
  ACTION_STATUSES,
  ALLOWED_TRANSITIONS,
  assertStatus,
  buildIdempotencyKey,
  canTransition as canTransitionAction,
  canonicalJson as canonicalJsonAction,
  hashPayload,
  isTerminal as isTerminalAction,
  summarizeForDisplay as summarizeAction,
  type ActionRow,
} from "../db/actions-pure";

import {
  EVIDENCE_TRANSITIONS,
  buildEvidenceId,
  canTransition as canTransitionEvidence,
  canonicalJson as canonicalJsonEvidence,
  hashContent,
  isTerminal as isTerminalEvidence,
  summarizeForDisplay as summarizeEvidence,
  type EvidenceRow,
} from "../db/evidence-pure";

const baseAction: ActionRow = {
  id: "act_1",
  workspace_id: "ws_1",
  mission_id: "m_1",
  action_type: "send_email",
  channel: "email",
  title: "Welcome email",
  summary: "Send welcome email to the new lead",
  payload_json: JSON.stringify({ to: "founder@example.com", body: "hi" }),
  payload_hash: "abc123",
  risk: "medium",
  status: "prepared",
  blocker: null,
  decided_by: null,
  decided_at: null,
  expires_at: 1_700_000_000,
  idempotency_key: "ws_1:m_1:abc123",
  provider_request_json: null,
  provider_result_json: null,
  created_at: 1_690_000_000,
  updated_at: 1_690_000_000,
};

const baseEvidence: EvidenceRow = {
  id: "ev_ws_1_m_1_deadbeef",
  workspace_id: "ws_1",
  mission_id: "m_1",
  source_url: "https://example.com/page",
  source_type: "website",
  content_hash: "deadbeef",
  parser_version: "1.0",
  title: "Pricing page observed",
  summary: "The pricing page lists three tiers.",
  extracted_facts_json: '{"tiers":3}',
  provenance_json: '{"fetchedAt":1700000000}',
  state: "observed",
  contradiction_of_id: null,
  created_at: 1_700_000_000,
  updated_at: 1_700_000_001,
};

test("hashPayload (actions) and hashContent (evidence) both return 64-char hex digests for the same payload", async () => {
  const payload = { b: 2, a: 1, c: { z: 1, y: 2 } };
  const actionHash = await hashPayload(payload);
  const evidenceHash = await hashContent(payload);
  assert.match(actionHash, /^[0-9a-f]{64}$/);
  assert.match(evidenceHash, /^[0-9a-f]{64}$/);
  assert.equal(actionHash.length, 64);
  assert.equal(evidenceHash.length, 64);
});

test("canonicalJson in both modules produces stable output regardless of insertion order", () => {
  // action canonicalJson sorts keys recursively
  const aSorted = canonicalJsonAction({ z: 1, a: 2, m: { y: 1, b: 2 } });
  const aSorted2 = canonicalJsonAction({ a: 2, m: { b: 2, y: 1 }, z: 1 });
  assert.equal(aSorted, aSorted2);

  // evidence canonicalJson also produces a stable, deterministic string
  const eSorted = canonicalJsonEvidence({ z: 1, a: 2, m: { y: 1, b: 2 } });
  const eSorted2 = canonicalJsonEvidence({ a: 2, m: { b: 2, y: 1 }, z: 1 });
  assert.equal(eSorted, eSorted2);
});

test("action 'executed' is terminal while evidence 'verified' may still transition to stale or contradicted", () => {
  assert.equal(isTerminalAction("executed"), true);
  assert.equal(isTerminalEvidence("verified"), false);
  assert.deepEqual(EVIDENCE_TRANSITIONS.verified, ["stale", "contradicted"]);
});

test("action prepared→approved→executed and evidence observed→verified run side-by-side as forward-only state machines", () => {
  // Action chain
  assert.equal(canTransitionAction("prepared", "approved"), true);
  assert.equal(canTransitionAction("approved", "executed"), true);
  assert.equal(canTransitionAction("executed", "prepared"), false);

  // Evidence chain
  assert.equal(canTransitionEvidence("observed", "verified"), true);
  assert.equal(canTransitionEvidence("verified", "observed"), false);
});

test("buildIdempotencyKey (action) is tenant-isolated while buildEvidenceId (evidence) is content-bound", () => {
  const actionKey = buildIdempotencyKey("ws_1", "m_1", "deadbeef");
  assert.equal(actionKey, "ws_1:m_1:deadbeef");

  const evidenceId = buildEvidenceId({
    workspaceId: "ws_1",
    missionId: "m_1",
    contentHash: "deadbeef",
  });
  assert.equal(evidenceId, "ev_ws_1_m_1_deadbeef");

  // Both are deterministic for identical inputs
  assert.equal(
    buildIdempotencyKey("ws_1", "m_1", "deadbeef"),
    actionKey,
  );
  assert.equal(
    buildEvidenceId({
      workspaceId: "ws_1",
      missionId: "m_1",
      contentHash: "deadbeef",
    }),
    evidenceId,
  );

  // Both isolate tenants
  assert.notEqual(
    buildIdempotencyKey("ws_2", "m_1", "deadbeef"),
    actionKey,
  );
  assert.notEqual(
    buildEvidenceId({
      workspaceId: "ws_2",
      missionId: "m_1",
      contentHash: "deadbeef",
    }),
    evidenceId,
  );
});

test("summarizeForDisplay redacts sensitive fields in both action and evidence rows", () => {
  const actionSummary = summarizeAction(baseAction);
  assert.equal("payload_json" in actionSummary, false);
  assert.equal("provider_request_json" in actionSummary, false);
  assert.equal("provider_result_json" in actionSummary, false);
  assert.equal("idempotency_key" in actionSummary, false);
  assert.equal("workspace_id" in actionSummary, false);
  assert.equal(actionSummary.payload_hash, "abc123");

  const evidenceSummary = summarizeEvidence(baseEvidence);
  assert.equal(evidenceSummary.workspace_id, "[redacted]");
  assert.equal(evidenceSummary.extracted_facts_json, "[redacted]");
  assert.equal(evidenceSummary.provenance_json, "[redacted]");
  assert.equal(evidenceSummary.content_hash, "deadbeef");
});

test("when action.payload_hash equals evidence.content_hash, the action references the same source content as the evidence", async () => {
  const sharedPayload = { hello: "world", n: 42 };
  const actionHash = await hashPayload(sharedPayload);
  const evidenceHash = await hashContent(sharedPayload);
  // Both modules hash canonical JSON with SHA-256 → identical digests.
  assert.equal(actionHash, evidenceHash);
  // The action may safely reference the evidence row by content_hash.
  assert.equal(actionHash.length, 64);
});

test("action 'rejected' is terminal AND evidence 'rejected' is terminal — neither can be revived through its state machine", () => {
  assert.equal(isTerminalAction("rejected"), true);
  assert.equal(isTerminalEvidence("rejected"), true);
  assert.deepEqual(ALLOWED_TRANSITIONS.rejected, []);
  assert.deepEqual(EVIDENCE_TRANSITIONS.rejected, []);
  for (const target of ACTION_STATUSES) {
    assert.equal(canTransitionAction("rejected", target), false);
  }
  assert.equal(canTransitionEvidence("rejected", "observed"), false);
  assert.equal(canTransitionEvidence("rejected", "verified"), false);
});

test("an approved action whose evidence later becomes 'contradicted' may itself transition to 'blocked' (composable state machines)", () => {
  // Evidence moves from verified → contradicted
  assert.equal(canTransitionEvidence("verified", "contradicted"), true);
  // Action moves from approved → blocked
  assert.equal(canTransitionAction("approved", "blocked"), true);
  // Action cannot move approved → prepared (no downgrade)
  assert.equal(canTransitionAction("approved", "prepared"), false);
  // Evidence cannot move contradicted → observed (no revive; only verified or stale)
  assert.equal(canTransitionEvidence("contradicted", "observed"), false);
  assert.equal(canTransitionEvidence("contradicted", "verified"), true);
  assert.equal(canTransitionEvidence("contradicted", "stale"), true);
});

test("hashPayload is type-sensitive and hashContent produces a different digest for different inputs", async () => {
  const aNumber = await hashPayload({ a: 1 });
  const aString = await hashPayload({ a: "1" });
  assert.notEqual(aNumber, aString);

  const evA = await hashContent({ a: 1 });
  const evB = await hashContent({ a: 2 });
  assert.notEqual(evA, evB);
});

test("assertStatus throws on unknown action status while evidence state machine handles unknown states defensively", () => {
  assert.throws(() => assertStatus("unknown"), /Invalid action status/);
  assert.throws(() => assertStatus(null), /Invalid action status/);
  // Evidence canTransition returns false for unknown states
  assert.equal(canTransitionEvidence("unknown_state" as never, "verified"), false);
  // isTerminal on an unknown state returns false (defensive default)
  assert.equal(isTerminalEvidence("unknown_state" as never), false);
});

test("ACTION_STATUSES exposes exactly 7 statuses while EVIDENCE_STATES exposes 7 states including 'needed'", () => {
  assert.equal(ACTION_STATUSES.length, 7);
  assert.deepEqual(
    [...ACTION_STATUSES].sort(),
    ["approved", "blocked", "executed", "expired", "failed", "prepared", "rejected"],
  );
  assert.equal(Object.keys(EVIDENCE_TRANSITIONS).length, 7);
  assert.deepEqual(
    [...Object.keys(EVIDENCE_TRANSITIONS)].sort(),
    ["contradicted", "inferred", "needed", "observed", "rejected", "stale", "verified"],
  );
});

test("action 'blocked' and 'expired' are terminal AND evidence 'stale' may transition to observed (re-observation)", () => {
  assert.equal(isTerminalAction("blocked"), true);
  assert.equal(isTerminalAction("expired"), true);
  assert.equal(isTerminalAction("failed"), true);

  // evidence 'stale' is not terminal — it can be re-observed or rejected
  assert.equal(isTerminalEvidence("stale"), false);
  assert.deepEqual(EVIDENCE_TRANSITIONS.stale, ["observed", "rejected"]);
});

test("canonicalJson in actions drops undefined values recursively while evidence canonicalJson emits a literal token", () => {
  // action canonicalJson drops undefined recursively (key+value elided)
  const aDropped = canonicalJsonAction({ a: 1, b: undefined, c: { d: undefined, e: 2 } });
  assert.equal(aDropped, JSON.stringify({ a: 1, c: { e: 2 } }));

  // evidence canonicalJson does NOT drop undefined: it passes the value through
  // JSON.stringify(undefined) === undefined (the JS value, not a string) and
  // string concatenation renders it as the literal text "undefined".
  const eSerialized = canonicalJsonEvidence({ a: 1, b: undefined });
  assert.equal(typeof eSerialized, "string");
  assert.ok(eSerialized.includes("undefined"));
  assert.equal(eSerialized, '{"a":1,"b":undefined}');
});

test("action 'prepared' transitions to approved|rejected|blocked|expired|failed — five sinks matching the five non-terminal evidence transitions from 'observed'", () => {
  // Action: prepared has 5 sinks
  assert.deepEqual(
    [...ALLOWED_TRANSITIONS.prepared].sort(),
    ["approved", "blocked", "expired", "failed", "rejected"],
  );
  // Evidence: observed has 5 sinks
  assert.deepEqual(
    [...EVIDENCE_TRANSITIONS.observed].sort(),
    ["contradicted", "inferred", "rejected", "stale", "verified"],
  );
  // Same fan-out width lets the two machines progress in lock-step.
  assert.equal(
    ALLOWED_TRANSITIONS.prepared.length,
    EVIDENCE_TRANSITIONS.observed.length,
  );
});

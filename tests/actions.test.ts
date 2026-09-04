import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_STATUSES,
  ALLOWED_TRANSITIONS,
  assertStatus,
  buildIdempotencyKey,
  canTransition,
  canonicalJson,
  hashPayload,
  isTerminal,
  summarizeForDisplay,
  type ActionRow,
} from "../db/actions-pure";

const baseRow: ActionRow = {
  id: "act_1",
  workspace_id: "ws_1",
  mission_id: "m_1",
  action_type: "send_email",
  channel: "email",
  title: "Welcome email",
  summary: "Send welcome email to the new lead",
  payload_json: JSON.stringify({ to: "secret@example.com", body: "hi" }),
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

test("state machine exposes exactly 7 statuses", () => {
  assert.deepEqual(
    [...ACTION_STATUSES].sort(),
    ["approved", "blocked", "executed", "expired", "failed", "prepared", "rejected"],
  );
  assert.equal(Object.keys(ALLOWED_TRANSITIONS).length, 7);
  for (const status of ACTION_STATUSES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, status),
      `ALLOWED_TRANSITIONS missing ${status}`,
    );
  }
});

test("prepared transitions to approved, rejected, blocked, expired, failed", () => {
  for (const to of ["approved", "rejected", "blocked", "expired", "failed"] as const) {
    assert.equal(canTransition("prepared", to), true);
  }
  // prepared cannot skip approval and go straight to executed
  assert.equal(canTransition("prepared", "executed"), false);
  // no self-transition
  assert.equal(canTransition("prepared", "prepared"), false);
});

test("approved transitions to executed, failed, blocked, expired", () => {
  assert.deepEqual(
    [...ALLOWED_TRANSITIONS.approved].sort(),
    ["blocked", "executed", "expired", "failed"],
  );
  for (const to of ["executed", "failed", "blocked", "expired"] as const) {
    assert.equal(canTransition("approved", to), true);
  }
  // approved cannot be re-approved or downgraded to rejected
  assert.equal(canTransition("approved", "approved"), false);
  assert.equal(canTransition("approved", "rejected"), false);
  assert.equal(canTransition("approved", "prepared"), false);
});

test("rejected, blocked, expired, executed, failed are terminal", () => {
  for (const status of [
    "rejected",
    "blocked",
    "expired",
    "executed",
    "failed",
  ] as const) {
    assert.equal(isTerminal(status), true);
    assert.deepEqual(ALLOWED_TRANSITIONS[status], []);
    // no outgoing transitions to any status
    for (const target of ACTION_STATUSES) {
      assert.equal(canTransition(status, target), false);
    }
  }
});

test("prepared and approved are non-terminal", () => {
  assert.equal(isTerminal("prepared"), false);
  assert.equal(isTerminal("approved"), false);
  assert.notEqual(ALLOWED_TRANSITIONS.prepared.length, 0);
  assert.notEqual(ALLOWED_TRANSITIONS.approved.length, 0);
});

test("canonicalJson sorts object keys recursively", () => {
  const out = canonicalJson({ b: 2, a: 1, c: { z: 1, y: 2 } });
  assert.equal(out, JSON.stringify({ a: 1, b: 2, c: { y: 2, z: 1 } }));
});

test("canonicalJson drops undefined values (nested)", () => {
  const out = canonicalJson({
    a: 1,
    b: undefined,
    c: { d: undefined, e: 2 },
  });
  assert.equal(out, JSON.stringify({ a: 1, c: { e: 2 } }));
});

test("canonicalJson handles arrays: order preserved, elements recurse", () => {
  const out = canonicalJson([
    { b: 2, a: 1 },
    { d: 4, c: 3 },
  ]);
  assert.equal(out, JSON.stringify([{ a: 1, b: 2 }, { c: 3, d: 4 }]));
});

test("hashPayload returns a stable 64-char lowercase hex digest", async () => {
  const h1 = await hashPayload({ a: 1, b: [1, 2, { z: 1, y: 2 }] });
  const h2 = await hashPayload({ b: [1, 2, { y: 2, z: 1 }], a: 1 });
  assert.equal(h1.length, 64);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, h2);
});

test("hashPayload differs for different payloads", async () => {
  const h1 = await hashPayload({ a: 1 });
  const h2 = await hashPayload({ a: 2 });
  assert.notEqual(h1, h2);
});

test("hashPayload is type-sensitive (number vs string)", async () => {
  const h1 = await hashPayload({ a: 1 });
  const h2 = await hashPayload({ a: "1" });
  assert.notEqual(h1, h2);
});

test("summarizeForDisplay redacts payload_json and other sensitive fields", () => {
  const summary = summarizeForDisplay(baseRow);
  // safe fields are preserved
  assert.equal(summary.id, "act_1");
  assert.equal(summary.mission_id, "m_1");
  assert.equal(summary.action_type, "send_email");
  assert.equal(summary.channel, "email");
  assert.equal(summary.title, "Welcome email");
  assert.equal(summary.summary, "Send welcome email to the new lead");
  assert.equal(summary.risk, "medium");
  assert.equal(summary.status, "prepared");
  assert.equal(summary.blocker, null);
  assert.equal(summary.expires_at, 1_700_000_000);
  assert.equal(summary.created_at, 1_690_000_000);
  assert.equal(summary.updated_at, 1_690_000_000);
  assert.equal(summary.payload_hash, "abc123");
  // sensitive fields must not leak as own properties
  assert.equal("payload_json" in summary, false);
  assert.equal("provider_request_json" in summary, false);
  assert.equal("provider_result_json" in summary, false);
  assert.equal("idempotency_key" in summary, false);
  assert.equal("workspace_id" in summary, false);
  assert.equal("decided_by" in summary, false);
  assert.equal("decided_at" in summary, false);
});

test("state machine refuses unknown status via assertStatus", () => {
  assert.throws(() => assertStatus("unknown"), /Invalid action status/);
  assert.throws(() => assertStatus("PREPARED"), /Invalid action status/);
  assert.throws(() => assertStatus(123), /Invalid action status/);
  assert.throws(() => assertStatus(null), /Invalid action status/);
  assert.throws(() => assertStatus(undefined), /Invalid action status/);
  // valid statuses pass without throwing
  for (const status of ACTION_STATUSES) {
    assertStatus(status);
  }
});

test("buildIdempotencyKey is deterministic and tenant-isolated", async () => {
  const hash = await hashPayload({ a: 1, b: 2 });
  const k1 = buildIdempotencyKey("ws_1", "m_1", hash);
  const k2 = buildIdempotencyKey("ws_1", "m_1", hash);
  assert.equal(k1, k2);
  assert.equal(k1, `ws_1:m_1:${hash}`);
  // tenant isolation: a different workspace yields a different key
  const kOtherWorkspace = buildIdempotencyKey("ws_2", "m_1", hash);
  assert.notEqual(k1, kOtherWorkspace);
  // mission isolation: a different mission yields a different key
  const kOtherMission = buildIdempotencyKey("ws_1", "m_2", hash);
  assert.notEqual(k1, kOtherMission);
  // payload isolation: a different hash yields a different key
  const kOtherHash = buildIdempotencyKey("ws_1", "m_1", "deadbeef");
  assert.notEqual(k1, kOtherHash);
});

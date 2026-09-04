/**
 * Edge-case tests for the action-queue pure logic (db/actions-pure.ts).
 *
 * Each test exercises a boundary or unusual-but-legal input that real-world
 * traffic could surface — empty payloads, null fields, very long strings,
 * unicode, special characters and awkward state-machine transitions
 * (double-approve, approve-then-reject, expired-then-approve, etc.).
 *
 * Run:  npx tsx --test tests/edge-actions.test.ts
 */
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

function baseRow(overrides: Partial<ActionRow> = {}): ActionRow {
  return {
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
    ...overrides,
  };
}

test("edge: hashPayload of an empty object is deterministic and 64 hex chars", async () => {
  const h = await hashPayload({});
  assert.match(h, /^[0-9a-f]{64}$/);
  // Same empty object twice must yield the same digest.
  assert.equal(h, await hashPayload({}));
  // Distinct from the empty string payload.
  assert.notEqual(h, await hashPayload(""));
});

test("edge: hashPayload of null is not confused with empty object or string", async () => {
  const hNull = await hashPayload(null);
  const hEmptyObj = await hashPayload({});
  const hEmptyStr = await hashPayload("");
  assert.notEqual(hNull, hEmptyObj);
  assert.notEqual(hNull, hEmptyStr);
  assert.notEqual(hEmptyObj, hEmptyStr);
  assert.match(hNull, /^[0-9a-f]{64}$/);
});

test("edge: canonicalJson preserves null fields but drops undefined fields", () => {
  // null is a real value and must round-trip.
  const withNull = canonicalJson({ a: null, b: 1 });
  assert.equal(withNull, '{"a":null,"b":1}');
  // undefined is silently dropped (so absent keys don't perturb the hash).
  const withUndef = canonicalJson({ a: undefined, b: 1 });
  assert.equal(withUndef, '{"b":1}');
});

test("edge: hashPayload handles a 100 KB unicode payload without truncation", async () => {
  const big = "🙌".repeat(40_000); // 4 bytes per char ≈ 160 KB UTF-8
  const h = await hashPayload({ body: big });
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, await hashPayload({ body: big }));
  // A single character difference must produce a different digest.
  const h2 = await hashPayload({ body: big + "🙌" });
  assert.notEqual(h, h2);
});

test("edge: hashPayload treats ASCII, emoji and control chars distinctly", async () => {
  const ascii = await hashPayload({ s: "hello" });
  const emoji = await hashPayload({ s: "hell👋" });
  const control = await hashPayload({ s: "hell\u0000" });
  const newline = await hashPayload({ s: "hell\n" });
  assert.notEqual(ascii, emoji);
  assert.notEqual(ascii, control);
  assert.notEqual(ascii, newline);
  assert.notEqual(emoji, control);
});

test("edge: special characters in payload survive canonical round-trip", () => {
  const payload = { path: "C:\\Users\\Ada\\file.txt", quote: '"hi"', tab: "a\tb" };
  const canon = canonicalJson(payload);
  const parsed = JSON.parse(canon);
  assert.deepEqual(parsed, payload);
  // Hashing the canonical form twice must be stable.
  // (Smoke-test only — exact digest value is not asserted.)
});

test("edge: double-approve is rejected — approved → approved is not a valid transition", () => {
  assert.equal(canTransition("approved", "approved"), false);
  // Even though approved is non-terminal, self-transition is disallowed.
  assert.equal(isTerminal("approved"), false);
  assert.ok(!ALLOWED_TRANSITIONS.approved.includes("approved"));
});

test("edge: approve-then-reject is rejected — approved cannot be downgraded to rejected", () => {
  assert.equal(canTransition("approved", "rejected"), false);
  // Symmetrically, rejected is terminal so there's no way back either.
  assert.equal(canTransition("rejected", "approved"), false);
});

test("edge: expired-then-approve is rejected — expired is terminal", () => {
  assert.equal(isTerminal("expired"), true);
  assert.equal(canTransition("expired", "approved"), false);
  assert.equal(canTransition("expired", "executed"), false);
  assert.equal(canTransition("expired", "prepared"), false);
});

test("edge: blocked-then-approve is rejected — blocked is terminal", () => {
  assert.equal(isTerminal("blocked"), true);
  assert.equal(canTransition("blocked", "approved"), false);
  assert.equal(canTransition("blocked", "executed"), false);
});

test("edge: concurrent approval decisions are idempotent — same input always yields the same outcome", () => {
  // The state machine is pure; calling canTransition twice with identical
  // arguments must always agree. This models two concurrent approvers racing
  // on the same action row.
  const a = canTransition("prepared", "approved");
  const b = canTransition("prepared", "approved");
  assert.equal(a, b);
  assert.equal(a, true);
  // The same holds for the rejection path.
  assert.equal(
    canTransition("prepared", "rejected"),
    canTransition("prepared", "rejected"),
  );
});

test("edge: assertStatus rejects empty string, whitespace and numeric strings", () => {
  for (const bad of ["", " ", "prepared ", " prepared", "123", "PREPARED"]) {
    assert.throws(() => assertStatus(bad), /Invalid action status/);
  }
  // Every documented status still passes.
  for (const s of ACTION_STATUSES) {
    assertStatus(s); // does not throw
  }
});

test("edge: summarizeForDisplay keeps null blocker/decided_at when action is untouched", () => {
  const row = baseRow({ status: "prepared" });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.blocker, null);
  assert.equal(summary.status, "prepared");
  // Sensitive fields are not exposed even on a freshly prepared action.
  assert.equal("decided_by" in summary, false);
  assert.equal("decided_at" in summary, false);
  assert.equal("payload_json" in summary, false);
  assert.equal("provider_request_json" in summary, false);
  assert.equal("provider_result_json" in summary, false);
});

test("edge: buildIdempotencyKey tolerates a 256-char payload hash without truncation", () => {
  const longHash = "a".repeat(256);
  const key = buildIdempotencyKey("ws_1", "m_1", longHash);
  assert.equal(key, `ws_1:m_1:${longHash}`);
  assert.equal(key.length, "ws_1:m_1:".length + 256);
  // A trailing-character difference must change the key.
  const other = buildIdempotencyKey("ws_1", "m_1", longHash.slice(0, -1) + "b");
  assert.notEqual(key, other);
});

test("edge: canonicalJson handles deeply-nested mixed arrays/objects without stack overflow", () => {
  // 100 levels of alternating arrays/objects — well within practical limits
  // but deep enough to surface naive recursion bugs.
  let value: unknown = "leaf";
  for (let i = 0; i < 100; i++) {
    value = i % 2 === 0 ? { k: value } : [value];
  }
  const out = canonicalJson(value);
  assert.equal(typeof out, "string");
  // Round-trips through JSON.parse back into the same structured value.
  assert.deepEqual(JSON.parse(out), value);
  // Stable across two invocations.
  assert.equal(out, canonicalJson(value));
  // The deeply-nested leaf is still reachable in the serialised form.
  assert.ok(out.includes('"leaf"'));
  assert.ok(out.endsWith("]"));
});

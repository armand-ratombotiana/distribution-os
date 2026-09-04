/**
 * Edge-case tests for the evidence pure logic (db/evidence-pure.ts).
 *
 * Each test exercises a boundary: empty content, null source_url, very long
 * summaries, duplicate hashes, contradiction chains, state loops, etc.
 *
 * Run:  npx tsx --test tests/edge-evidence.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_TRANSITIONS,
  buildEvidenceId,
  canTransition,
  canonicalJson,
  hashContent,
  isTerminal,
  summarizeForDisplay,
  type EvidenceRow,
} from "../db/evidence-pure";

function baseRow(overrides: Partial<EvidenceRow> = {}): EvidenceRow {
  return {
    id: "ev_1",
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
    ...overrides,
  };
}

test("edge: hashContent of empty string and empty object produce distinct digests", async () => {
  const hEmptyStr = await hashContent("");
  const hEmptyObj = await hashContent({});
  const hEmptyArr = await hashContent([]);
  assert.match(hEmptyStr, /^[0-9a-f]{64}$/);
  assert.notEqual(hEmptyStr, hEmptyObj);
  assert.notEqual(hEmptyStr, hEmptyArr);
  assert.notEqual(hEmptyObj, hEmptyArr);
  // Empty string is stable.
  assert.equal(hEmptyStr, await hashContent(""));
});

test("edge: hashContent of null is distinct from empty object", async () => {
  const hNull = await hashContent(null);
  const hEmpty = await hashContent({});
  assert.match(hNull, /^[0-9a-f]{64}$/);
  assert.notEqual(hNull, hEmpty);
});

test("edge: row with null source_url is still summarised and redacted", () => {
  const row = baseRow({ source_url: null, source_type: "manual" });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.source_url, null);
  assert.equal(summary.source_type, "manual");
  // Redactions still apply.
  assert.equal(summary.workspace_id, "[redacted]");
  assert.equal(summary.extracted_facts_json, "[redacted]");
  assert.equal(summary.provenance_json, "[redacted]");
});

test("edge: very long summary (10k chars) survives canonicalJson round-trip", () => {
  const long = "x".repeat(10_000);
  const row = baseRow({ summary: long });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.summary, long);
  assert.equal((summary.summary as string).length, 10_000);
});

test("edge: duplicate content hashes produce the same digest (deduplication contract)", async () => {
  const a = await hashContent({ body: "duplicate" });
  const b = await hashContent({ body: "duplicate" });
  assert.equal(a, b);
  // Even when the object key order differs, the canonical form must agree.
  const c = await hashContent({ body: "duplicate", extra: 1 });
  const d = await hashContent({ extra: 1, body: "duplicate" });
  assert.equal(c, d);
  assert.notEqual(a, c); // different content → different hash
});

test("edge: contradiction chain — contradicted → verified → stale is allowed", () => {
  assert.equal(canTransition("contradicted", "verified"), true);
  assert.equal(canTransition("verified", "stale"), true);
  assert.equal(canTransition("stale", "observed"), true);
  // Full chain: contradicted → verified → stale → observed → verified
  assert.equal(
    canTransition("contradicted", "verified") &&
      canTransition("verified", "stale") &&
      canTransition("stale", "observed") &&
      canTransition("observed", "verified"),
    true,
  );
});

test("edge: state loop observed → verified → contradicted → verified is permitted", () => {
  // observed → verified
  assert.equal(canTransition("observed", "verified"), true);
  // verified → contradicted
  assert.equal(canTransition("verified", "contradicted"), true);
  // contradicted → verified (loop back)
  assert.equal(canTransition("contradicted", "verified"), true);
  // The loop is non-trivial — verify each leg is explicitly listed.
  assert.ok(EVIDENCE_TRANSITIONS.observed.includes("verified"));
  assert.ok(EVIDENCE_TRANSITIONS.verified.includes("contradicted"));
  assert.ok(EVIDENCE_TRANSITIONS.contradicted.includes("verified"));
});

test("edge: stale → observed is the only resurrection path out of stale", () => {
  assert.deepEqual(EVIDENCE_TRANSITIONS.stale, ["observed", "rejected"]);
  assert.equal(canTransition("stale", "observed"), true);
  assert.equal(canTransition("stale", "rejected"), true);
  // Cannot shortcut from stale to verified/inferred/contradicted.
  assert.equal(canTransition("stale", "verified"), false);
  assert.equal(canTransition("stale", "inferred"), false);
  assert.equal(canTransition("stale", "contradicted"), false);
});

test("edge: rejected is terminal — no escape from the rejected state", () => {
  assert.equal(isTerminal("rejected"), true);
  for (const target of Object.keys(EVIDENCE_TRANSITIONS) as Array<
    keyof typeof EVIDENCE_TRANSITIONS
  >) {
    assert.equal(canTransition("rejected", target), false);
  }
});

test("edge: needed → observed jumps directly without passing through inferred", () => {
  assert.deepEqual(EVIDENCE_TRANSITIONS.needed, ["observed", "rejected"]);
  assert.equal(canTransition("needed", "observed"), true);
  assert.equal(canTransition("needed", "rejected"), true);
  // No shortcut to inferred / verified.
  assert.equal(canTransition("needed", "inferred"), false);
  assert.equal(canTransition("needed", "verified"), false);
  assert.equal(canTransition("needed", "contradicted"), false);
});

test("edge: buildEvidenceId is stable across hash collisions in different missions", () => {
  const idA = buildEvidenceId({
    workspaceId: "ws_1",
    missionId: "m_A",
    contentHash: "deadbeef",
  });
  const idB = buildEvidenceId({
    workspaceId: "ws_1",
    missionId: "m_B",
    contentHash: "deadbeef",
  });
  assert.notEqual(idA, idB); // mission-scoped
  assert.equal(idA, "ev_ws_1_m_A_deadbeef");
  assert.equal(idB, "ev_ws_1_m_B_deadbeef");
});

test("edge: canonicalJson serialises undefined values as the literal token 'undefined'", () => {
  // Unlike the actions-pure canonicalJson (which drops undefined), the
  // evidence variant stringifies every key value via JSON.stringify — and
  // JSON.stringify(undefined) returns the bare token "undefined", producing
  // invalid JSON. This edge case is documented so callers know to filter
  // undefined before hashing evidence payloads.
  const out = canonicalJson({ a: 1, b: undefined });
  assert.equal(out, '{"a":1,"b":undefined}');
  // Valid JSON is still produced when undefined keys are absent.
  assert.equal(canonicalJson({ a: 1 }), '{"a":1}');
});

test("edge: hashContent is type-sensitive — number 1 vs string '1' differ", async () => {
  const h1 = await hashContent({ n: 1 });
  const h2 = await hashContent({ n: "1" });
  assert.notEqual(h1, h2);
});

test("edge: contradiction_of_id is preserved when set (chain of contradictions)", () => {
  const row = baseRow({
    state: "contradicted",
    contradiction_of_id: "ev_parent_1",
  });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.contradiction_of_id, "ev_parent_1");
  assert.equal(summary.state, "contradicted");
});

test("edge: summarizeForDisplay preserves updated_at > created_at ordering from source row", () => {
  const row = baseRow({
    created_at: 1_700_000_000,
    updated_at: 1_700_000_500,
  });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.created_at, 1_700_000_000);
  assert.equal(summary.updated_at, 1_700_000_500);
  assert.ok(summary.updated_at >= summary.created_at);
});

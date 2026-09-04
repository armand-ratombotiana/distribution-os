import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_TRANSITIONS,
  canTransition,
  isTerminal,
  canonicalJson,
  hashContent,
  summarizeForDisplay,
  buildEvidenceId,
  type EvidenceRow,
} from "../db/evidence-pure";

const baseRow: EvidenceRow = {
  id: "ev_1",
  workspace_id: "ws_abc",
  mission_id: "msn_xyz",
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
  created_at: 1700000000,
  updated_at: 1700000001,
};

test("EVIDENCE_TRANSITIONS allows observed to move to inferred, verified, contradicted, stale, rejected", () => {
  assert.deepEqual(EVIDENCE_TRANSITIONS.observed, [
    "inferred",
    "verified",
    "contradicted",
    "stale",
    "rejected",
  ]);
});

test("EVIDENCE_TRANSITIONS maps rejected to an empty array and needed to observed and rejected only", () => {
  assert.deepEqual(EVIDENCE_TRANSITIONS.rejected, []);
  assert.deepEqual(EVIDENCE_TRANSITIONS.needed, ["observed", "rejected"]);
});

test("canTransition returns true for observed -> verified", () => {
  assert.equal(canTransition("observed", "verified"), true);
});

test("canTransition returns false for rejected -> observed because rejected is terminal", () => {
  assert.equal(canTransition("rejected", "observed"), false);
});

test("canTransition returns false when the target is not listed (observed -> needed)", () => {
  assert.equal(canTransition("observed", "needed"), false);
});

test("isTerminal returns true for rejected", () => {
  assert.equal(isTerminal("rejected"), true);
});

test("isTerminal returns false for observed", () => {
  assert.equal(isTerminal("observed"), false);
});

test("canonicalJson sorts object keys alphabetically and is stable regardless of insertion order", () => {
  const a = canonicalJson({ z: 1, a: 2, m: { y: 1, b: 2 } });
  const b = canonicalJson({ a: 2, m: { b: 2, y: 1 }, z: 1 });
  assert.equal(a, b);
  assert.equal(a, `{"a":2,"m":{"b":2,"y":1},"z":1}`);
});

test("hashContent returns a 64 character lowercase hex SHA-256 digest", async () => {
  const digest = await hashContent({ hello: "world" });
  assert.match(digest, /^[0-9a-f]{64}$/);
});

test("hashContent produces different digests for different inputs", async () => {
  const first = await hashContent({ a: 1, b: 2 });
  const second = await hashContent({ a: 1, b: 3 });
  assert.notEqual(first, second);
});

test("summarizeForDisplay redacts workspace_id, extracted_facts_json, and provenance_json", () => {
  const summary = summarizeForDisplay(baseRow);
  assert.equal(summary.workspace_id, "[redacted]");
  assert.equal(summary.extracted_facts_json, "[redacted]");
  assert.equal(summary.provenance_json, "[redacted]");
  assert.equal(summary.id, baseRow.id);
  assert.equal(summary.title, baseRow.title);
});

test("buildEvidenceId returns a deterministic identifier from workspace, mission, and content hash", () => {
  const id = buildEvidenceId({
    workspaceId: "ws_abc",
    missionId: "msn_xyz",
    contentHash: "deadbeef",
  });
  assert.equal(id, "ev_ws_abc_msn_xyz_deadbeef");
  const again = buildEvidenceId({
    workspaceId: "ws_abc",
    missionId: "msn_xyz",
    contentHash: "deadbeef",
  });
  assert.equal(id, again);
});

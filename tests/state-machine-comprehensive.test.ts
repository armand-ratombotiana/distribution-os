/**
 * Comprehensive state-machine coverage for every lifecycle in Distribution OS.
 *
 * Each of the eight state machines is exercised with:
 *   - all permitted forward transitions,
 *   - rejection of invalid transitions (terminal → anything, disallowed edges),
 *   - the documented set of terminal states.
 *
 * 20 tests, all pure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canTransition as canTransitionAction,
  isTerminal as isTerminalAction,
  ALLOWED_TRANSITIONS as ACTION_TRANSITIONS,
} from "../db/actions-pure.ts";
import {
  canTransition as canTransitionEvidence,
  isTerminal as isTerminalEvidence,
  EVIDENCE_TRANSITIONS,
} from "../db/evidence-pure.ts";
import {
  canTransition as canTransitionExperiment,
  isTerminal as isTerminalExperiment,
  EXPERIMENT_TRANSITIONS,
} from "../db/experiments-pure.ts";
import {
  canTransition as canTransitionPayment,
  isTerminal as isTerminalPayment,
  PAYMENT_TRANSITIONS,
} from "../db/attribution-pure.ts";
import {
  canTransition as canTransitionConnector,
  isTerminal as isTerminalConnector,
  CONNECTOR_TRANSITIONS,
} from "../db/connectors-pure.ts";
import {
  canTransition as canTransitionContact,
  isTerminal as isTerminalContact,
  CONTACT_TRANSITIONS,
} from "../db/contacts-pure.ts";
import {
  canTransition as canTransitionContent,
  isTerminal as isTerminalContent,
  CONTENT_TRANSITIONS,
} from "../db/content-assets-pure.ts";
import {
  canTransitionRun,
  isTerminalRun,
  canTransitionStep,
  STEP_STATUSES,
} from "../db/agent-runs-pure.ts";
import {
  ACTION_STATUSES,
  EVIDENCE_STATES,
  EXPERIMENT_STATUSES,
  PAYMENT_STATUSES,
  CONNECTOR_STATUSES,
  CONTACT_STATUSES,
  CONTENT_STATUSES,
  AGENT_RUN_STATUSES,
} from "../db/schema.ts";

// Helper: every pair (a, b) where the transition IS allowed.
function allowedPairs(table: Record<string, readonly string[]>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [from, tos] of Object.entries(table)) {
    for (const to of tos) out.push([from, to]);
  }
  return out;
}

// Helper: every pair (a, b) where the transition is NOT allowed.
function disallowedPairs(
  table: Record<string, readonly string[]>,
  statuses: readonly string[],
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const from of statuses) {
    for (const to of statuses) {
      if (from === to) continue;
      if (!(table[from] ?? []).includes(to)) out.push([from, to]);
    }
  }
  return out;
}

// ─── 1. Actions (7 statuses, 5 terminal: rejected/blocked/expired/executed/failed) ─

test("state/actions: ACTION_STATUSES enumerates 7 statuses and 5 are terminal", () => {
  assert.equal(ACTION_STATUSES.length, 7);
  assert.deepEqual([...ACTION_STATUSES], [
    "prepared",
    "approved",
    "rejected",
    "blocked",
    "expired",
    "executed",
    "failed",
  ]);
  const terminals = ACTION_STATUSES.filter(isTerminalAction);
  assert.deepEqual([...terminals].sort(), [
    "blocked",
    "executed",
    "expired",
    "failed",
    "rejected",
  ]);
});

test("state/actions: prepared → {approved, rejected, blocked, expired, failed}; approved → {executed, failed, blocked, expired}", () => {
  assert.deepEqual(ACTION_TRANSITIONS.prepared, [
    "approved",
    "rejected",
    "blocked",
    "expired",
    "failed",
  ]);
  assert.deepEqual(ACTION_TRANSITIONS.approved, [
    "executed",
    "failed",
    "blocked",
    "expired",
  ]);
  for (const [from, to] of allowedPairs(ACTION_TRANSITIONS)) {
    assert.equal(canTransitionAction(from as never, to as never), true);
  }
  // Disallowed transitions (e.g. terminal → anything) must return false.
  for (const [from, to] of disallowedPairs(ACTION_TRANSITIONS, [...ACTION_STATUSES])) {
    assert.equal(canTransitionAction(from as never, to as never), false);
  }
});

// ─── 2. Evidence (7 states, 1 terminal: rejected) ────────────────────────

test("state/evidence: EVIDENCE_STATES has 7 entries and rejected is the only terminal state", () => {
  assert.equal(EVIDENCE_STATES.length, 7);
  assert.deepEqual([...EVIDENCE_STATES].sort(), [
    "contradicted",
    "inferred",
    "needed",
    "observed",
    "rejected",
    "stale",
    "verified",
  ]);
  assert.equal(isTerminalEvidence("rejected"), true);
  for (const s of EVIDENCE_STATES) {
    if (s !== "rejected") assert.equal(isTerminalEvidence(s), false);
  }
});

test("state/evidence: every transition in EVIDENCE_TRANSITIONS is allowed and every other pair is rejected", () => {
  // Spot-check key transitions.
  assert.equal(canTransitionEvidence("observed", "verified"), true);
  assert.equal(canTransitionEvidence("verified", "contradicted"), true);
  assert.equal(canTransitionEvidence("stale", "observed"), true);
  assert.equal(canTransitionEvidence("needed", "observed"), true);
  // Invalid transitions.
  assert.equal(canTransitionEvidence("rejected", "observed"), false);
  assert.equal(canTransitionEvidence("observed", "needed"), false);
  assert.equal(canTransitionEvidence("verified", "needed"), false);
  // Full table sweep.
  for (const [from, to] of allowedPairs(EVIDENCE_TRANSITIONS)) {
    assert.equal(canTransitionEvidence(from as never, to as never), true);
  }
  for (const [from, to] of disallowedPairs(EVIDENCE_TRANSITIONS, [...EVIDENCE_STATES])) {
    assert.equal(canTransitionEvidence(from as never, to as never), false);
  }
});

// ─── 3. Experiments (5 statuses, 2 terminal: completed/stopped) ──────────

test("state/experiments: EXPERIMENT_STATUSES has 5 entries; completed and stopped are terminal", () => {
  assert.equal(EXPERIMENT_STATUSES.length, 5);
  assert.deepEqual([...EXPERIMENT_STATUSES].sort(), [
    "blocked",
    "completed",
    "draft",
    "running",
    "stopped",
  ]);
  assert.equal(isTerminalExperiment("completed"), true);
  assert.equal(isTerminalExperiment("stopped"), true);
  assert.equal(isTerminalExperiment("draft"), false);
  assert.equal(isTerminalExperiment("running"), false);
  assert.equal(isTerminalExperiment("blocked"), false);
});

test("state/experiments: draft→running/blocked; running→completed/stopped/blocked; blocked→draft/running", () => {
  assert.deepEqual(EXPERIMENT_TRANSITIONS.draft, ["running", "blocked"]);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.running, ["completed", "stopped", "blocked"]);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.blocked, ["draft", "running"]);
  // Terminals have no outgoing edges.
  assert.deepEqual(EXPERIMENT_TRANSITIONS.completed, []);
  assert.deepEqual(EXPERIMENT_TRANSITIONS.stopped, []);
  // Blocked cannot jump directly to completed (must pass through running).
  assert.equal(canTransitionExperiment("blocked", "completed"), false);
  assert.equal(canTransitionExperiment("completed", "draft"), false);
});

// ─── 4. Payments (5 statuses, 3 terminal: refunded/disputed/failed) ──────

test("state/payments: PAYMENT_STATUSES has 5 entries; refunded, disputed, failed are terminal", () => {
  assert.equal(PAYMENT_STATUSES.length, 5);
  assert.deepEqual([...PAYMENT_STATUSES].sort(), [
    "disputed",
    "failed",
    "pending",
    "refunded",
    "succeeded",
  ]);
  for (const t of ["refunded", "disputed", "failed"] as const) {
    assert.equal(isTerminalPayment(t), true);
  }
  for (const t of ["pending", "succeeded"] as const) {
    assert.equal(isTerminalPayment(t), false);
  }
});

test("state/payments: pending→succeeded/failed; succeeded→refunded/disputed; terminals have no outgoing", () => {
  assert.deepEqual(PAYMENT_TRANSITIONS.pending, ["succeeded", "failed"]);
  assert.deepEqual(PAYMENT_TRANSITIONS.succeeded, ["refunded", "disputed"]);
  for (const t of ["refunded", "disputed", "failed"] as const) {
    assert.deepEqual(PAYMENT_TRANSITIONS[t], []);
  }
  // Disallowed jumps.
  assert.equal(canTransitionPayment("pending", "refunded"), false);
  assert.equal(canTransitionPayment("succeeded", "pending"), false);
  assert.equal(canTransitionPayment("failed", "pending"), false);
  assert.equal(canTransitionPayment("refunded", "succeeded"), false);
});

// ─── 5. Connectors (8 statuses, 1 terminal: revoked) ─────────────────────

test("state/connectors: CONNECTOR_STATUSES has 8 entries and revoked is the only terminal state", () => {
  assert.equal(CONNECTOR_STATUSES.length, 8);
  assert.deepEqual([...CONNECTOR_STATUSES].sort(), [
    "authorized",
    "connected",
    "degraded",
    "disconnected",
    "error",
    "healthy",
    "revoked",
    "setup_required",
  ]);
  assert.equal(isTerminalConnector("revoked"), true);
  for (const s of CONNECTOR_STATUSES) {
    if (s !== "revoked") assert.equal(isTerminalConnector(s), false);
  }
});

test("state/connectors: setup_required→authorized/disconnected; error can recover to authorized; disconnected→setup_required", () => {
  assert.deepEqual(CONNECTOR_TRANSITIONS.setup_required, ["authorized", "disconnected"]);
  assert.deepEqual(CONNECTOR_TRANSITIONS.error, ["authorized", "disconnected"]);
  assert.deepEqual(CONNECTOR_TRANSITIONS.disconnected, ["setup_required"]);
  assert.deepEqual(CONNECTOR_TRANSITIONS.revoked, []);
  // Connected can move between healthy/degraded and disconnect/error.
  assert.ok(CONNECTOR_TRANSITIONS.connected.includes("healthy"));
  assert.ok(CONNECTOR_TRANSITIONS.connected.includes("degraded"));
  assert.ok(CONNECTOR_TRANSITIONS.healthy.includes("degraded"));
  // Disallowed jumps: revoked cannot be left; setup_required cannot jump to healthy.
  assert.equal(canTransitionConnector("revoked", "authorized"), false);
  assert.equal(canTransitionConnector("setup_required", "healthy"), false);
  assert.equal(canTransitionConnector("disconnected", "connected"), false);
});

// ─── 6. Contacts (8 statuses, 3 terminal: converted/rejected/unsubscribed) ─

test("state/contacts: CONTACT_STATUSES has 8 entries; converted, rejected, unsubscribed are terminal", () => {
  assert.equal(CONTACT_STATUSES.length, 8);
  assert.deepEqual([...CONTACT_STATUSES].sort(), [
    "contacted",
    "converted",
    "meeting",
    "new",
    "qualified",
    "rejected",
    "replied",
    "unsubscribed",
  ]);
  for (const t of ["converted", "rejected", "unsubscribed"] as const) {
    assert.equal(isTerminalContact(t), true);
  }
  for (const s of CONTACT_STATUSES) {
    if (!["converted", "rejected", "unsubscribed"].includes(s)) {
      assert.equal(isTerminalContact(s), false);
    }
  }
});

test("state/contacts: new→qualified/contacted/rejected; replied→meeting/converted/rejected; contacted→replied/rejected/qualified", () => {
  assert.deepEqual(CONTACT_TRANSITIONS.new, ["qualified", "contacted", "rejected"]);
  assert.deepEqual(CONTACT_TRANSITIONS.replied, ["meeting", "converted", "rejected"]);
  assert.deepEqual(CONTACT_TRANSITIONS.contacted, ["replied", "rejected", "qualified"]);
  assert.deepEqual(CONTACT_TRANSITIONS.meeting, ["converted", "rejected"]);
  // Terminals have no outgoing edges.
  for (const t of ["converted", "rejected", "unsubscribed"] as const) {
    assert.deepEqual(CONTACT_TRANSITIONS[t], []);
  }
  // Disallowed jumps.
  assert.equal(canTransitionContact("converted", "new"), false);
  assert.equal(canTransitionContact("new", "meeting"), false);
  assert.equal(canTransitionContact("unsubscribed", "qualified"), false);
});

// ─── 7. Content (7 statuses, 1 terminal: archived) ───────────────────────

test("state/content: CONTENT_STATUSES has 7 entries and archived is the only terminal state", () => {
  assert.equal(CONTENT_STATUSES.length, 7);
  assert.deepEqual([...CONTENT_STATUSES].sort(), [
    "approved",
    "archived",
    "draft",
    "failed",
    "in_review",
    "published",
    "scheduled",
  ]);
  assert.equal(isTerminalContent("archived"), true);
  for (const s of CONTENT_STATUSES) {
    if (s !== "archived") assert.equal(isTerminalContent(s), false);
  }
});

test("state/content: draft→in_review/archived; approved→scheduled/published/archived; failed→draft/archived; published→archived", () => {
  assert.deepEqual(CONTENT_TRANSITIONS.draft, ["in_review", "archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.in_review, ["approved", "draft", "archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.approved, ["scheduled", "published", "archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.scheduled, ["published", "approved", "failed"]);
  assert.deepEqual(CONTENT_TRANSITIONS.published, ["archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.failed, ["draft", "archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.archived, []);
  // Disallowed jumps.
  assert.equal(canTransitionContent("archived", "draft"), false);
  assert.equal(canTransitionContent("draft", "published"), false);
  assert.equal(canTransitionContent("published", "draft"), false);
});

// ─── 8. Agent runs (4 statuses, 3 terminal: completed/failed/cancelled) ───

test("state/agent-runs: AGENT_RUN_STATUSES has 4 entries; completed, failed, cancelled are terminal", () => {
  assert.equal(AGENT_RUN_STATUSES.length, 4);
  assert.deepEqual([...AGENT_RUN_STATUSES].sort(), [
    "cancelled",
    "completed",
    "failed",
    "running",
  ]);
  for (const t of ["completed", "failed", "cancelled"] as const) {
    assert.equal(isTerminalRun(t), true);
  }
  assert.equal(isTerminalRun("running"), false);
});

test("state/agent-runs: running→completed/failed/cancelled; terminal states cannot move", () => {
  assert.equal(canTransitionRun("running", "completed"), true);
  assert.equal(canTransitionRun("running", "failed"), true);
  assert.equal(canTransitionRun("running", "cancelled"), true);
  // Cannot leave a terminal state.
  assert.equal(canTransitionRun("completed", "running"), false);
  assert.equal(canTransitionRun("failed", "completed"), false);
  assert.equal(canTransitionRun("cancelled", "running"), false);
  // Cannot "re-start" from running to running.
  assert.equal(canTransitionRun("running", "running"), false);
});

// ─── 9–12. Additional transition-coverage invariants ──────────────────────

test("state/actions: every terminal status has an empty ALLOWED_TRANSITIONS list", () => {
  const terminals = ACTION_STATUSES.filter(isTerminalAction);
  assert.equal(terminals.length, 5);
  for (const t of terminals) {
    assert.deepEqual(
      ACTION_TRANSITIONS[t],
      [],
      `${t} should have no outgoing transitions`,
    );
  }
});

test("state/evidence: needed→observed, stale→observed, contradicted→verified are recoverable; rejected is fully isolated", () => {
  // Recoverable paths.
  assert.equal(canTransitionEvidence("needed", "observed"), true);
  assert.equal(canTransitionEvidence("stale", "observed"), true);
  assert.equal(canTransitionEvidence("contradicted", "verified"), true);
  // rejected is a true sink — nothing leaves.
  assert.equal(canTransitionEvidence("rejected", "observed"), false);
  assert.equal(canTransitionEvidence("rejected", "verified"), false);
  // observed / inferred / stale may transition to rejected; verified may not.
  assert.equal(canTransitionEvidence("observed", "rejected"), true);
  assert.equal(canTransitionEvidence("inferred", "rejected"), true);
  assert.equal(canTransitionEvidence("stale", "rejected"), true);
  assert.equal(canTransitionEvidence("verified", "rejected"), false);
});

test("state/connectors: revoked is fully isolated (no inbound, no outbound); error is recoverable to authorized", () => {
  // No outbound from revoked.
  for (const s of CONNECTOR_STATUSES) {
    assert.equal(canTransitionConnector("revoked", s), false);
  }
  // No other status lists revoked as a valid target.
  for (const from of CONNECTOR_STATUSES) {
    if (from === "revoked") continue;
    assert.equal(canTransitionConnector(from, "revoked"), false);
  }
  // error is recoverable.
  assert.equal(canTransitionConnector("error", "authorized"), true);
  assert.equal(canTransitionConnector("error", "disconnected"), true);
});

test("state/agent-runs: STEP_STATUSES mirrors run statuses and canTransitionStep allows only running→terminal", () => {
  assert.deepEqual([...STEP_STATUSES].sort(), [
    "cancelled",
    "completed",
    "failed",
    "running",
  ]);
  // running → any terminal is allowed.
  assert.equal(canTransitionStep("running", "completed"), true);
  assert.equal(canTransitionStep("running", "failed"), true);
  assert.equal(canTransitionStep("running", "cancelled"), true);
  // Terminal → anything is rejected.
  assert.equal(canTransitionStep("completed", "running"), false);
  assert.equal(canTransitionStep("failed", "cancelled"), false);
  assert.equal(canTransitionStep("cancelled", "failed"), false);
  // Self-loop not allowed.
  assert.equal(canTransitionStep("running", "running"), false);
});

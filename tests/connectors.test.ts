import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECTOR_TRANSITIONS,
  buildConnectorId,
  canTransition,
  isTerminal,
  isTokenExpired,
  needsHealthCheck,
  parseCapabilities,
  parseScopes,
  summarizeForDisplay,
  type ConnectorInstallationRow,
} from "../db/connectors-pure.ts";

const baseRow: ConnectorInstallationRow = {
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

function makeRow(
  overrides: Partial<ConnectorInstallationRow> = {},
): ConnectorInstallationRow {
  return { ...baseRow, ...overrides };
}

test("canTransition allows setup_required → authorized and setup_required → disconnected", () => {
  assert.equal(canTransition("setup_required", "authorized"), true);
  assert.equal(canTransition("setup_required", "disconnected"), true);
});

test("canTransition disallows setup_required → connected/healthy and other skips", () => {
  assert.equal(canTransition("setup_required", "connected"), false);
  assert.equal(canTransition("setup_required", "healthy"), false);
  assert.equal(canTransition("setup_required", "revoked"), false);
});

test("canTransition allows authorized → connected, disconnected and error", () => {
  assert.equal(canTransition("authorized", "connected"), true);
  assert.equal(canTransition("authorized", "disconnected"), true);
  assert.equal(canTransition("authorized", "error"), true);
  assert.equal(canTransition("authorized", "healthy"), false);
});

test("canTransition allows connected → healthy, degraded, disconnected and error", () => {
  for (const to of ["healthy", "degraded", "disconnected", "error"] as const) {
    assert.equal(canTransition("connected", to), true);
  }
  assert.equal(canTransition("connected", "authorized"), false);
});

test("canTransition allows disconnected → setup_required and error → authorized/disconnected", () => {
  assert.equal(canTransition("disconnected", "setup_required"), true);
  assert.equal(canTransition("error", "authorized"), true);
  assert.equal(canTransition("error", "disconnected"), true);
  assert.equal(canTransition("error", "connected"), false);
});

test("revoked is terminal: canTransition returns false for every target", () => {
  for (const target of Object.keys(CONNECTOR_TRANSITIONS) as Array<
    keyof typeof CONNECTOR_TRANSITIONS
  >) {
    assert.equal(canTransition("revoked", target), false);
  }
  assert.deepEqual(CONNECTOR_TRANSITIONS.revoked, []);
});

test("isTerminal returns true only for revoked", () => {
  assert.equal(isTerminal("revoked"), true);
  for (const status of [
    "setup_required",
    "authorized",
    "connected",
    "healthy",
    "degraded",
    "disconnected",
    "error",
  ] as const) {
    assert.equal(isTerminal(status), false);
  }
});

test("isTokenExpired treats null as non-expiring and compares against now", () => {
  const now = 1_000;
  assert.equal(isTokenExpired(null, now), false);
  assert.equal(isTokenExpired(999, now), true);
  assert.equal(isTokenExpired(1000, now), true);
  assert.equal(isTokenExpired(1001, now), false);
});

test("needsHealthCheck returns true for active connectors never checked and false for inactive ones", () => {
  const now = 10_000;
  assert.equal(
    needsHealthCheck(makeRow({ status: "connected", health_checked_at: null }), now),
    true,
  );
  assert.equal(
    needsHealthCheck(makeRow({ status: "healthy", health_checked_at: null }), now),
    true,
  );
  assert.equal(
    needsHealthCheck(makeRow({ status: "setup_required", health_checked_at: null }), now),
    false,
  );
  assert.equal(
    needsHealthCheck(makeRow({ status: "disconnected", health_checked_at: null }), now),
    false,
  );
  assert.equal(
    needsHealthCheck(makeRow({ status: "revoked", health_checked_at: null }), now),
    false,
  );
});

test("needsHealthCheck returns true when stale and false when fresh", () => {
  const now = 10_000;
  const interval = 5 * 60 * 1000;
  assert.equal(
    needsHealthCheck(
      makeRow({ status: "connected", health_checked_at: now - interval - 1 }),
      now,
      interval,
    ),
    true,
  );
  assert.equal(
    needsHealthCheck(
      makeRow({ status: "healthy", health_checked_at: now - 1 }),
      now,
      interval,
    ),
    false,
  );
  assert.equal(
    needsHealthCheck(
      makeRow({ status: "degraded", health_checked_at: now - interval }),
      now,
      interval,
    ),
    false,
  );
});

test("summarizeForDisplay redacts token_reference and workspace_id and parses scopes/capabilities", () => {
  const summary = summarizeForDisplay(baseRow);
  assert.equal("token_reference" in summary, false);
  assert.equal("workspace_id" in summary, false);
  assert.equal(summary.id, "ws_1:stripe");
  assert.equal(summary.provider, "Stripe");
  assert.equal(summary.status, "connected");
  assert.deepEqual(summary.scopes, ["payments", "webhooks"]);
  assert.deepEqual(summary.capabilities, ["charge", "refund"]);
});

test("parseScopes and parseCapabilities return arrays for valid JSON and [] for invalid", () => {
  assert.deepEqual(parseScopes('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseCapabilities('["x"]'), ["x"]);
  assert.deepEqual(parseScopes("[]"), []);
  assert.deepEqual(parseScopes(null), []);
  assert.deepEqual(parseScopes(undefined), []);
  assert.deepEqual(parseScopes("not-json"), []);
  assert.deepEqual(parseScopes('{"foo":1}'), []);
  assert.deepEqual(parseScopes('["a",1,true]'), ["a"]);
  assert.deepEqual(parseCapabilities('"not-an-array"'), []);
});

test("buildConnectorId is deterministic and slugifies the provider", () => {
  const a = buildConnectorId({ workspaceId: "ws_1", provider: "Stripe" });
  const aRepeat = buildConnectorId({ workspaceId: "ws_1", provider: "stripe" });
  const spaced = buildConnectorId({
    workspaceId: "ws_1",
    provider: "Google Analytics",
  });
  const other = buildConnectorId({ workspaceId: "ws_2", provider: "Stripe" });

  assert.equal(a, aRepeat);
  assert.equal(a, "ws_1:stripe");
  assert.equal(spaced, "ws_1:google-analytics");
  assert.notEqual(a, other);
});

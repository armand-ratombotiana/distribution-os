/**
 * Edge-case tests for the connectors pure logic (db/connectors-pure.ts).
 *
 * Each test exercises a boundary: unknown provider, very long scopes, null
 * token, expired token, disconnected → setup_required, revoked terminal, etc.
 *
 * Run:  npx tsx --test tests/edge-connectors.test.ts
 */
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
} from "../db/connectors-pure";

function baseRow(overrides: Partial<ConnectorInstallationRow> = {}): ConnectorInstallationRow {
  return {
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
    ...overrides,
  };
}

test("edge: buildConnectorId tolerates an unknown provider name and slugifies it", () => {
  // An unknown provider must still produce a deterministic, URL-safe id.
  // Note: the impl collapses runs of non-alphanumerics but does NOT trim
  // leading/trailing hyphens, so trailing punctuation produces a trailing hyphen.
  const id = buildConnectorId({ workspaceId: "ws_1", provider: "UnknownProvider 9000!!" });
  assert.equal(id, "ws_1:unknownprovider-9000-");
  // Stable across calls.
  assert.equal(
    id,
    buildConnectorId({ workspaceId: "ws_1", provider: "UnknownProvider 9000!!" }),
  );
  // Different workspace yields a different id (tenant isolation).
  assert.notEqual(
    id,
    buildConnectorId({ workspaceId: "ws_2", provider: "UnknownProvider 9000!!" }),
  );
  // A clean alphanumeric provider has no hyphens.
  assert.equal(
    buildConnectorId({ workspaceId: "ws_1", provider: "UnknownProvider9000" }),
    "ws_1:unknownprovider9000",
  );
});

test("edge: very long scopes JSON (1000 entries) parses without truncation", () => {
  const scopes = Array.from({ length: 1000 }, (_, i) => `scope_${i}`);
  const row = baseRow({ scopes_json: JSON.stringify(scopes) });
  const parsed = parseScopes(row.scopes_json);
  assert.equal(parsed.length, 1000);
  assert.equal(parsed[0], "scope_0");
  assert.equal(parsed[999], "scope_999");
});

test("edge: null token_expires_at means 'does not expire' (isTokenExpired=false)", () => {
  assert.equal(isTokenExpired(null, 1_000_000_000), false);
  assert.equal(isTokenExpired(null, 0), false);
  // A non-null expiry strictly in the past returns true.
  assert.equal(isTokenExpired(999_999_999, 1_000_000_000), true);
  // Exactly equal to now is treated as expired (avoids same-tick races).
  assert.equal(isTokenExpired(1_000_000_000, 1_000_000_000), true);
  // A future expiry is not expired.
  assert.equal(isTokenExpired(1_000_000_001, 1_000_000_000), false);
});

test("edge: null token_reference is redacted from the summary view", () => {
  // The summary must not surface token_reference even when it is null — the
  // field name itself must be absent so the UI never reaches for it.
  const row = baseRow({ token_reference: null });
  const summary = summarizeForDisplay(row);
  assert.equal("token_reference" in summary, false);
  assert.equal("workspace_id" in summary, false);
});

test("edge: disconnected → setup_required is the only valid exit from disconnected", () => {
  assert.deepEqual(CONNECTOR_TRANSITIONS.disconnected, ["setup_required"]);
  assert.equal(canTransition("disconnected", "setup_required"), true);
  // No shortcut back to authorized/connected from disconnected.
  assert.equal(canTransition("disconnected", "authorized"), false);
  assert.equal(canTransition("disconnected", "connected"), false);
  assert.equal(canTransition("disconnected", "error"), false);
  assert.equal(canTransition("disconnected", "revoked"), false);
});

test("edge: revoked is terminal — no recovery path out of revoked", () => {
  assert.equal(isTerminal("revoked"), true);
  for (const target of Object.keys(CONNECTOR_TRANSITIONS) as Array<
    keyof typeof CONNECTOR_TRANSITIONS
  >) {
    assert.equal(canTransition("revoked", target), false);
  }
  assert.deepEqual(CONNECTOR_TRANSITIONS.revoked, []);
});

test("edge: error → authorized (recovery) and error → disconnected are valid", () => {
  assert.equal(canTransition("error", "authorized"), true);
  assert.equal(canTransition("error", "disconnected"), true);
  // Cannot jump from error straight to connected/healthy.
  assert.equal(canTransition("error", "connected"), false);
  assert.equal(canTransition("error", "healthy"), false);
  assert.equal(canTransition("error", "degraded"), false);
});

test("edge: healthy ↔ degraded two-way transition (degradation then recovery)", () => {
  assert.equal(canTransition("healthy", "degraded"), true);
  assert.equal(canTransition("degraded", "healthy"), true);
  // Both can also drop to disconnected or error.
  assert.equal(canTransition("healthy", "disconnected"), true);
  assert.equal(canTransition("healthy", "error"), true);
  assert.equal(canTransition("degraded", "disconnected"), true);
  assert.equal(canTransition("degraded", "error"), true);
});

test("edge: needsHealthCheck ignores connectors in setup_required/revoked/error/disconnected states", () => {
  const now = 1_000_000_000;
  for (const status of [
    "setup_required",
    "authorized",
    "disconnected",
    "revoked",
    "error",
  ] as const) {
    assert.equal(
      needsHealthCheck(
        baseRow({ status, health_checked_at: null }),
        now,
      ),
      false,
      `${status} should not be health-checked`,
    );
  }
});

test("edge: needsHealthCheck fires for connected/healthy/degraded when never checked", () => {
  const now = 1_000_000_000;
  for (const status of ["connected", "healthy", "degraded"] as const) {
    assert.equal(
      needsHealthCheck(baseRow({ status, health_checked_at: null }), now),
      true,
      `${status} should be health-checked on first run`,
    );
  }
});

test("edge: needsHealthCheck at exactly intervalMs since last check is NOT stale (strict greater-than)", () => {
  const now = 1_000_000_000;
  const interval = 5 * 60 * 1000;
  assert.equal(
    needsHealthCheck(
      baseRow({ status: "connected", health_checked_at: now - interval }),
      now,
      interval,
    ),
    false,
  );
  // 1ms past the interval triggers a check.
  assert.equal(
    needsHealthCheck(
      baseRow({ status: "connected", health_checked_at: now - interval - 1 }),
      now,
      interval,
    ),
    true,
  );
});

test("edge: parseScopes filters out non-string entries silently", () => {
  // Mixed types in the JSON array are filtered — only strings are kept.
  assert.deepEqual(parseScopes('["a",1,true,null,{"x":1},["b"],"c"]'), ["a", "c"]);
  // Empty array stays empty.
  assert.deepEqual(parseScopes("[]"), []);
  // Non-array JSON returns [].
  assert.deepEqual(parseScopes('{"foo":1}'), []);
  assert.deepEqual(parseScopes('"string"'), []);
  assert.deepEqual(parseScopes("123"), []);
  assert.deepEqual(parseScopes("not-json"), []);
  assert.deepEqual(parseScopes(null), []);
  assert.deepEqual(parseScopes(undefined), []);
  // capabilities parser behaves identically.
  assert.deepEqual(parseCapabilities('["x",1]'), ["x"]);
  assert.deepEqual(parseCapabilities(null), []);
});

test("edge: summarizeForDisplay surfaces last_error string when set", () => {
  const row = baseRow({ last_error: "rate_limit_exceeded" });
  const summary = summarizeForDisplay(row);
  assert.equal(summary.last_error, "rate_limit_exceeded");
  // And surfaces null when no error is recorded.
  const ok = summarizeForDisplay(baseRow({ last_error: null }));
  assert.equal(ok.last_error, null);
});

test("edge: buildConnectorId collapses runs of non-alphanumerics into a single hyphen (no trimming)", () => {
  // The implementation only collapses runs; it does NOT trim leading/trailing
  // hyphens, so whitespace around the provider name leaks into the id.
  assert.equal(
    buildConnectorId({ workspaceId: "ws_1", provider: "  Foo!!!Bar???Baz  " }),
    "ws_1:-foo-bar-baz-",
  );
  // A provider consisting entirely of non-alphanumerics slugifies to a single
  // hyphen (the regex collapses runs of disallowed chars into one "-").
  assert.equal(
    buildConnectorId({ workspaceId: "ws_1", provider: "___" }),
    "ws_1:-",
  );
  // Empty provider produces an empty slug — the id ends with the trailing colon.
  assert.equal(buildConnectorId({ workspaceId: "ws_1", provider: "" }), "ws_1:");
  // A clean alphanumeric provider produces a hyphen-free slug.
  assert.equal(buildConnectorId({ workspaceId: "ws_1", provider: "Stripe" }), "ws_1:stripe");
});

test("edge: authorized is NOT terminal — it must reach connected before serving traffic", () => {
  assert.equal(isTerminal("authorized"), false);
  assert.equal(canTransition("authorized", "connected"), true);
  assert.equal(canTransition("authorized", "disconnected"), true);
  assert.equal(canTransition("authorized", "error"), true);
  // Cannot go from authorized straight to healthy (must pass through connected).
  assert.equal(canTransition("authorized", "healthy"), false);
  assert.equal(canTransition("authorized", "degraded"), false);
});

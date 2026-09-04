import { CONNECTOR_STATUSES } from "./schema";

/**
 * Pure connector-installation helpers — no database or runtime bindings.
 *
 * These functions encode the connector lifecycle (status transitions, token
 * expiry, health-check scheduling) and PII-safe display projections. Keeping
 * them side-effect free makes the rules easy to unit test and reuse from
 * workers, API routes and background health jobs.
 */

export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

/** Raw D1 row shape for the `connector_installations` table (snake_case). */
export type ConnectorInstallationRow = {
  id: string;
  workspace_id: string;
  provider: string;
  category: string;
  status: ConnectorStatus;
  scopes_json: string;
  capabilities_json: string;
  token_reference: string | null;
  token_expires_at: number | null;
  last_sync_at: number | null;
  last_error: string | null;
  health_checked_at: number | null;
  created_at: number;
  updated_at: number;
};

/**
 * Allowed connector lifecycle transitions.
 *
 * The model is: `setup_required` → `authorized` → `connected` → (`healthy` |
 * `degraded`) ↔, with `disconnected` always reachable from an active state and
 * `error` recoverable back to `authorized`. `revoked` is terminal.
 */
export const CONNECTOR_TRANSITIONS: Record<ConnectorStatus, ConnectorStatus[]> =
  {
    setup_required: ["authorized", "disconnected"],
    authorized: ["connected", "disconnected", "error"],
    connected: ["healthy", "degraded", "disconnected", "error"],
    healthy: ["degraded", "disconnected", "error"],
    degraded: ["healthy", "disconnected", "error"],
    disconnected: ["setup_required"],
    revoked: [],
    error: ["authorized", "disconnected"],
  };

/** Returns true when `from → to` is an allowed connector transition. */
export function canTransition(
  from: ConnectorStatus,
  to: ConnectorStatus,
): boolean {
  const allowed = CONNECTOR_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** A connector status is terminal when it has no outgoing transitions. */
export function isTerminal(status: ConnectorStatus): boolean {
  return (CONNECTOR_TRANSITIONS[status]?.length ?? 0) === 0;
}

/**
 * Returns true when a token has expired.
 *
 * A null expiry is treated as "does not expire" (returns false). An expiry at
 * or before `now` is considered expired — the `<=` comparison avoids race
 * conditions where a token expires in the same tick as the check.
 */
export function isTokenExpired(
  expiresAt: number | null,
  now: number,
): boolean {
  if (expiresAt == null) return false;
  return expiresAt <= now;
}

const HEALTHY_STATUSES: ReadonlySet<ConnectorStatus> = new Set([
  "connected",
  "healthy",
  "degraded",
]);

/**
 * Returns true when an active connector is due for a health check.
 *
 * Only connectors in an actively-serving state (`connected`, `healthy`,
 * `degraded`) are health-checked. A connector that has never been checked, or
 * whose last check is older than `intervalMs`, is considered stale.
 */
export function needsHealthCheck(
  row: ConnectorInstallationRow,
  now: number,
  intervalMs: number = 5 * 60 * 1000,
): boolean {
  if (!HEALTHY_STATUSES.has(row.status)) return false;
  if (row.health_checked_at == null) return true;
  return now - row.health_checked_at > intervalMs;
}

/**
 * Projects a connector installation into a display-safe shape by redacting
 * `token_reference` (the opaque pointer to the stored credential) and
 * `workspace_id` (an internal identifier that should not leak into UI
 * surfaces). Scopes and capabilities are parsed into arrays for convenience.
 */
export function summarizeForDisplay(
  row: ConnectorInstallationRow,
): Record<string, unknown> {
  return {
    id: row.id,
    provider: row.provider,
    category: row.category,
    status: row.status,
    scopes: parseScopes(row.scopes_json),
    capabilities: parseCapabilities(row.capabilities_json),
    token_expires_at: row.token_expires_at,
    last_sync_at: row.last_sync_at,
    last_error: row.last_error,
    health_checked_at: row.health_checked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

/**
 * Parses the `scopes_json` column into a string array.
 *
 * Returns an empty array for null/undefined input, non-array JSON, or invalid
 * JSON so callers never have to special-case malformed rows.
 */
export function parseScopes(
  scopesJson: string | null | undefined,
): string[] {
  return parseStringArray(scopesJson);
}

/**
 * Parses the `capabilities_json` column into a string array, mirroring
 * `parseScopes` semantics.
 */
export function parseCapabilities(
  capabilitiesJson: string | null | undefined,
): string[] {
  return parseStringArray(capabilitiesJson);
}

/**
 * Builds a deterministic connector installation id from a workspace id and
 * provider name. The provider is slugified (lowercased, non-alphanumerics
 * collapsed to hyphens) so the id is filesystem- and URL-safe.
 */
export function buildConnectorId(args: {
  workspaceId: string;
  provider: string;
}): string {
  const slug = args.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${args.workspaceId}:${slug}`;
}

/**
 * D1 persistence layer for the `connector_installations` table.
 *
 * Tenant-isolated by `workspace_id`. Delegates lifecycle, token-expiry and
 * display logic to `./connectors-pure`. IDs use `crypto.randomUUID()` and
 * timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildConnectorId,
  canTransition,
  type ConnectorInstallationRow,
  type ConnectorStatus,
} from "./connectors-pure";

export * from "./connectors-pure";

export type UpsertInstallationInput = {
  provider: string;
  category: string;
  status?: ConnectorStatus;
  scopes?: string[];
  capabilities?: string[];
  token_reference?: string | null;
  token_expires_at?: number | null;
  last_sync_at?: number | null;
  last_error?: string | null;
  health_checked_at?: number | null;
};

export type ListInstallationsOptions = {
  provider?: string;
  status?: ConnectorStatus;
  limit?: number;
};

export type UpdateHealthInput = {
  status?: ConnectorStatus;
  last_error?: string | null;
  last_sync_at?: number | null;
  health_checked_at?: number | null;
};

function isConnectorStatus(value: unknown): value is ConnectorStatus {
  return (
    typeof value === "string" &&
    [
      "setup_required",
      "authorized",
      "connected",
      "healthy",
      "degraded",
      "disconnected",
      "revoked",
      "error",
    ].includes(value)
  );
}

function jsonStringifyArray(values: string[] | undefined): string {
  if (!values || values.length === 0) return "[]";
  return JSON.stringify(values);
}

/**
 * Upsert a connector installation. The id is derived deterministically from
 * the workspace id and provider name (via `buildConnectorId`) so that
 * repeated calls for the same provider update the existing row.
 */
export async function upsertInstallation(
  workspaceId: string,
  input: UpsertInstallationInput,
): Promise<ConnectorInstallationRow> {
  const db = getRawDb();
  const now = Date.now();
  const id = buildConnectorId({
    workspaceId,
    provider: input.provider,
  });
  const status: ConnectorStatus = input.status ?? "setup_required";
  if (!isConnectorStatus(status)) {
    throw new Error(`Invalid connector status: ${String(status)}`);
  }
  const scopesJson = jsonStringifyArray(input.scopes);
  const capabilitiesJson = jsonStringifyArray(input.capabilities);

  await db
    .prepare(
      "INSERT INTO connector_installations (id, workspace_id, provider, category, status, scopes_json, capabilities_json, token_reference, token_expires_at, last_sync_at, last_error, health_checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET category = excluded.category, status = excluded.status, scopes_json = excluded.scopes_json, capabilities_json = excluded.capabilities_json, token_reference = COALESCE(excluded.token_reference, connector_installations.token_reference), token_expires_at = COALESCE(excluded.token_expires_at, connector_installations.token_expires_at), last_sync_at = COALESCE(excluded.last_sync_at, connector_installations.last_sync_at), last_error = excluded.last_error, health_checked_at = COALESCE(excluded.health_checked_at, connector_installations.health_checked_at), updated_at = excluded.updated_at",
    )
    .bind(
      id,
      workspaceId,
      input.provider,
      input.category,
      status,
      scopesJson,
      capabilitiesJson,
      input.token_reference ?? null,
      input.token_expires_at ?? null,
      input.last_sync_at ?? null,
      input.last_error ?? null,
      input.health_checked_at ?? null,
      now,
      now,
    )
    .run();

  const row = await getInstallation(workspaceId, id);
  if (!row) {
    throw new Error("Failed to upsert connector installation");
  }
  return row;
}

/**
 * List connector installations for a workspace, optionally filtered by
 * provider and/or status. Ordered by `updated_at DESC`, capped at `limit`
 * (default 50, max 200).
 */
export async function listInstallations(
  workspaceId: string,
  opts: ListInstallationsOptions = {},
): Promise<ConnectorInstallationRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.provider && opts.status) {
    if (!isConnectorStatus(opts.status)) {
      throw new Error(`Invalid connector status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM connector_installations WHERE workspace_id = ? AND provider = ? AND status = ? ORDER BY updated_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.provider, opts.status, limit)
      .all<ConnectorInstallationRow>();
    return result.results;
  }
  if (opts.provider) {
    const result = await db
      .prepare(
        "SELECT * FROM connector_installations WHERE workspace_id = ? AND provider = ? ORDER BY updated_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.provider, limit)
      .all<ConnectorInstallationRow>();
    return result.results;
  }
  if (opts.status) {
    if (!isConnectorStatus(opts.status)) {
      throw new Error(`Invalid connector status: ${String(opts.status)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM connector_installations WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<ConnectorInstallationRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM connector_installations WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<ConnectorInstallationRow>();
  return result.results;
}

/** Fetch a single connector installation by id within a workspace. */
export async function getInstallation(
  workspaceId: string,
  installationId: string,
): Promise<ConnectorInstallationRow | null> {
  const db = getRawDb();
  return db
    .prepare(
      "SELECT * FROM connector_installations WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, installationId)
    .first<ConnectorInstallationRow>();
}

/**
 * Transition a connector installation to a new status. Refuses the transition
 * when the connector lifecycle (`canTransition`) does not permit it.
 */
export async function updateInstallationStatus(
  workspaceId: string,
  installationId: string,
  newStatus: ConnectorStatus,
): Promise<ConnectorInstallationRow> {
  if (!isConnectorStatus(newStatus)) {
    throw new Error(`Invalid connector status: ${String(newStatus)}`);
  }
  const db = getRawDb();
  const current = await getInstallation(workspaceId, installationId);
  if (!current) {
    throw new Error(`Connector installation not found: ${installationId}`);
  }
  if (!canTransition(current.status, newStatus)) {
    throw new Error(
      `Connector ${installationId} cannot transition from ${current.status} to ${newStatus}`,
    );
  }
  const now = Date.now();
  await db
    .prepare(
      "UPDATE connector_installations SET status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(newStatus, now, workspaceId, installationId)
    .run();
  const updated = await getInstallation(workspaceId, installationId);
  if (!updated) {
    throw new Error(
      `Connector installation disappeared after update: ${installationId}`,
    );
  }
  return updated;
}

/**
 * Update the health-check fields of a connector installation. Optionally
 * transition the status (validated against the lifecycle state machine).
 * `last_error` is overwritten (pass `null` to clear), while `last_sync_at`
 * and `health_checked_at` default to `Date.now()` when omitted.
 */
export async function updateHealth(
  workspaceId: string,
  installationId: string,
  input: UpdateHealthInput,
): Promise<ConnectorInstallationRow> {
  const db = getRawDb();
  const current = await getInstallation(workspaceId, installationId);
  if (!current) {
    throw new Error(`Connector installation not found: ${installationId}`);
  }
  const now = Date.now();
  const nextStatus = input.status ?? current.status;
  if (!isConnectorStatus(nextStatus)) {
    throw new Error(`Invalid connector status: ${String(nextStatus)}`);
  }
  if (nextStatus !== current.status && !canTransition(current.status, nextStatus)) {
    throw new Error(
      `Connector ${installationId} cannot transition from ${current.status} to ${nextStatus}`,
    );
  }
  const lastSyncAt = input.last_sync_at ?? now;
  const healthCheckedAt = input.health_checked_at ?? now;
  await db
    .prepare(
      "UPDATE connector_installations SET status = ?, last_error = ?, last_sync_at = ?, health_checked_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(
      nextStatus,
      input.last_error === undefined ? current.last_error : input.last_error,
      lastSyncAt,
      healthCheckedAt,
      now,
      workspaceId,
      installationId,
    )
    .run();
  const updated = await getInstallation(workspaceId, installationId);
  if (!updated) {
    throw new Error(
      `Connector installation disappeared after update: ${installationId}`,
    );
  }
  return updated;
}

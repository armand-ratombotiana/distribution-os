import { getRawDb } from "../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../db/workspaces";

/**
 * Export all workspace data as a JSON download.
 *
 * Returns a `Content-Disposition: attachment` response whose body is a JSON
 * object containing every tenant-scoped table for the current workspace:
 *
 *   - workspace metadata, connections, settings
 *   - missions + mission_events + mission_versions + strategy_versions
 *   - experiments, evidence, contacts, actions
 *   - payments, touchpoints, agent_runs, agent_steps
 *   - audit_events (with `ip_hash` redacted)
 *   - connector_installations (with `token_reference` redacted)
 *   - content_assets
 *   - organizations, organization_memberships, organization_invitations
 *     (with `token_hash` redacted)
 *
 * The export is intended for GDPR-style data portability and operational
 * snapshots. It is read-only — no rows are mutated.
 */
export async function POST(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const db = getRawDb();
    const workspaceId = workspace.id;
    const exportedAt = Date.now();

    const [
      workspacesResult,
      connectionsResult,
      settingsResult,
      missionsResult,
      missionEventsResult,
      missionVersionsResult,
      strategyVersionsResult,
      experimentsResult,
      evidenceResult,
      contactsResult,
      actionsResult,
      paymentsResult,
      touchpointsResult,
      agentRunsResult,
      agentStepsJoinResult,
      auditEventsResult,
      connectorInstallationsResult,
      contentAssetsResult,
      organizationsResult,
      membershipsResult,
      invitationsResult,
    ] = await Promise.all([
      db
        .prepare(
          "SELECT id, owner_user_id, owner_email, display_name, plan, created_at, updated_at FROM workspaces WHERE id = ? LIMIT 1",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id, provider, category, status, scopes_json, last_sync_at, created_at, updated_at FROM workspace_connections WHERE workspace_id = ? ORDER BY updated_at DESC",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM workspace_settings WHERE workspace_id = ? LIMIT 1")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM missions WHERE workspace_id = ? ORDER BY updated_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT me.* FROM mission_events me INNER JOIN missions m ON m.id = me.mission_id WHERE m.workspace_id = ? ORDER BY me.created_at DESC LIMIT 5000",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT * FROM mission_versions WHERE workspace_id = ? ORDER BY version_number DESC LIMIT 5000",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT * FROM strategy_versions WHERE workspace_id = ? ORDER BY version_number DESC LIMIT 5000",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM experiments WHERE workspace_id = ? ORDER BY created_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM evidence WHERE workspace_id = ? ORDER BY created_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM contacts WHERE workspace_id = ? ORDER BY created_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM action_queue WHERE workspace_id = ? ORDER BY created_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM payments WHERE workspace_id = ? ORDER BY created_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM touchpoints WHERE workspace_id = ? ORDER BY occurred_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM agent_runs WHERE workspace_id = ? ORDER BY started_at DESC")
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT s.* FROM agent_steps s INNER JOIN agent_runs r ON r.id = s.run_id WHERE r.workspace_id = ? ORDER BY s.started_at DESC LIMIT 10000",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id, workspace_id, actor_user_id, event_category, event_type, action_id, resource_type, resource_id, detail_json, created_at FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 10000",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id, workspace_id, provider, category, status, scopes_json, capabilities_json, token_expires_at, last_sync_at, last_error, health_checked_at, created_at, updated_at FROM connector_installations WHERE workspace_id = ? ORDER BY updated_at DESC",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare("SELECT * FROM content_assets WHERE workspace_id = ? ORDER BY created_at DESC")
        .bind(workspaceId)
        .all(),
      // Organizations, memberships and invitations are scoped by organization_id
      // which equals the workspace id (1:1 mapping, see db/organizations.ts).
      db
        .prepare("SELECT * FROM organizations WHERE id = ? LIMIT 1")
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id, organization_id, user_id, role, created_at, updated_at FROM organization_memberships WHERE organization_id = ? ORDER BY created_at ASC",
        )
        .bind(workspaceId)
        .all(),
      db
        .prepare(
          "SELECT id, organization_id, email, role, expires_at, accepted_at, created_at FROM organization_invitations WHERE organization_id = ? ORDER BY created_at DESC",
        )
        .bind(workspaceId)
        .all(),
    ]);

    const payload = {
      workspace_id: workspaceId,
      exported_at: exportedAt,
      schema_version: 1,
      tables: {
        workspaces: workspacesResult.results,
        workspace_connections: connectionsResult.results,
        workspace_settings: settingsResult.results,
        missions: missionsResult.results,
        mission_events: missionEventsResult.results,
        mission_versions: missionVersionsResult.results,
        strategy_versions: strategyVersionsResult.results,
        experiments: experimentsResult.results,
        evidence: evidenceResult.results,
        contacts: contactsResult.results,
        action_queue: actionsResult.results,
        payments: paymentsResult.results,
        touchpoints: touchpointsResult.results,
        agent_runs: agentRunsResult.results,
        agent_steps: agentStepsJoinResult.results,
        audit_events: auditEventsResult.results,
        connector_installations: connectorInstallationsResult.results,
        content_assets: contentAssetsResult.results,
        organizations: organizationsResult.results,
        organization_memberships: membershipsResult.results,
        organization_invitations: invitationsResult.results,
      },
    };

    const body = JSON.stringify(payload, null, 2);
    const filename = `workspace-${workspaceId}-${new Date(exportedAt).toISOString().replace(/[:.]/g, "-")}.json`;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to export workspace data." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Workspace export failed.",
      },
      { status: 500 },
    );
  }
}

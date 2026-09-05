import { getRawDb } from "./index";

export type RequestIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

export type Workspace = {
  id: string;
  owner_user_id: string;
  owner_email: string;
  display_name: string;
  plan: string;
  created_at: number;
  updated_at: number;
};

export type WorkspaceConnection = {
  id: string;
  provider: string;
  category: string;
  status: string;
  scopes_json: string;
  last_sync_at: number | null;
  updated_at: number;
};

function decodeName(request: Request) {
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (!encoded || encoding !== "percent-encoded-utf-8") return null;
  try { return decodeURIComponent(encoded); } catch { return null; }
}

export function requireRequestIdentity(request: Request): RequestIdentity {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim();
  if (!userId || !email) throw new Error("AUTH_REQUIRED");
  return { userId, email, displayName: decodeName(request) || email.split("@")[0] };
}

export async function ensureWorkspace(identity: RequestIdentity) {
  const db = getRawDb();
  const existing = await db
    .prepare("SELECT * FROM workspaces WHERE owner_user_id = ? LIMIT 1")
    .bind(identity.userId)
    .first<Workspace>();
  if (existing) return existing;

  const now = Date.now();
  const workspaceId = `ws_${crypto.randomUUID()}`;
  await db
    .prepare("INSERT INTO workspaces (id, owner_user_id, owner_email, display_name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, 'founder', ?, ?)")
    .bind(workspaceId, identity.userId, identity.email, identity.displayName, now, now)
    .run();
  return (await db.prepare("SELECT * FROM workspaces WHERE id = ? LIMIT 1").bind(workspaceId).first<Workspace>())!;
}

export async function getWorkspaceSnapshot(workspace: Workspace) {
  const db = getRawDb();
  const connections = await db
    .prepare("SELECT id, provider, category, status, scopes_json, last_sync_at, updated_at FROM workspace_connections WHERE workspace_id = ? ORDER BY updated_at DESC")
    .bind(workspace.id)
    .all<WorkspaceConnection>();
  const missionCount = await db.prepare("SELECT COUNT(*) AS count FROM missions WHERE workspace_id = ?").bind(workspace.id).first<{ count: number }>();
  return {
    workspace: {
      id: workspace.id,
      display_name: workspace.display_name,
      owner_email: workspace.owner_email,
      plan: workspace.plan,
    },
    connections: connections.results,
    mission_count: missionCount?.count || 0,
  };
}

export async function requestConnector(workspaceId: string, provider: string, category: string) {
  const db = getRawDb();
  const now = Date.now();
  const id = `${workspaceId}:${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  await db.prepare("INSERT INTO workspace_connections (id, workspace_id, provider, category, status, scopes_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'setup_required', '[]', ?, ?) ON CONFLICT(id) DO UPDATE SET category = excluded.category, updated_at = excluded.updated_at").bind(id, workspaceId, provider, category, now, now).run();
  return db.prepare("SELECT id, provider, category, status, scopes_json, last_sync_at, updated_at FROM workspace_connections WHERE id = ? LIMIT 1").bind(id).first<WorkspaceConnection>();
}

export type WorkspaceStats = {
  workspace_id: string;
  total_missions: number;
  total_actions: number;
  total_evidence: number;
  total_experiments: number;
  total_payments: number;
  total_contacts: number;
  total_content: number;
  generated_at: number;
};

/**
 * Aggregate workspace-wide row counts for the seven primary content tables.
 *
 * Each count comes from a single indexed `COUNT(*)` query scoped to the
 * workspace id. The seven queries run in parallel so the call is one
 * round-trip's worth of latency. The result is suitable for KPI cards and
 * any "how big is this workspace" surface that does not need the heavier
 * `recent_activity` union returned by `getWorkspaceDashboard`.
 */
export async function getWorkspaceStats(
  workspaceId: string,
): Promise<WorkspaceStats> {
  const db = getRawDb();
  const [
    missionCountResult,
    actionCountResult,
    evidenceCountResult,
    experimentCountResult,
    paymentCountResult,
    contactCountResult,
    contentCountResult,
  ] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS count FROM missions WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM action_queue WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM evidence WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM experiments WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM payments WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM content_assets WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
  ]);

  return {
    workspace_id: workspaceId,
    total_missions: missionCountResult?.count ?? 0,
    total_actions: actionCountResult?.count ?? 0,
    total_evidence: evidenceCountResult?.count ?? 0,
    total_experiments: experimentCountResult?.count ?? 0,
    total_payments: paymentCountResult?.count ?? 0,
    total_contacts: contactCountResult?.count ?? 0,
    total_content: contentCountResult?.count ?? 0,
    generated_at: Date.now(),
  };
}

export type WorkspaceDashboard = {
  workspace_id: string;
  display_name: string;
  plan: string;
  mission_count: number;
  total_actions: number;
  total_evidence: number;
  total_experiments: number;
  total_payments: number;
  total_touchpoints: number;
  total_contacts: number;
  total_content_assets: number;
  succeeded_payment_count: number;
  pending_approval_count: number;
  recent_activity: WorkspaceDashboardActivity[];
  generated_at: number;
};

export type WorkspaceDashboardActivity = {
  kind:
    | "mission_event"
    | "action"
    | "evidence"
    | "experiment"
    | "payment"
    | "touchpoint"
    | "audit_event";
  id: string;
  title: string;
  occurred_at: number;
};

/**
 * Aggregate a workspace-wide dashboard view in a single round-trip of parallel
 * `COUNT(*)` queries plus a recent-activity union. The recent-activity list
 * interleaves the newest rows from `mission_events`, `action_queue`,
 * `evidence`, `experiments`, `payments`, `touchpoints` and `audit_events` —
 * every row is mapped to a `{kind, id, title, occurred_at}` envelope so the
 * client can render a unified timeline without a second request.
 */
export async function getWorkspaceDashboard(
  workspaceId: string,
): Promise<WorkspaceDashboard | null> {
  const db = getRawDb();
  const workspace = await db
    .prepare("SELECT id, display_name, plan FROM workspaces WHERE id = ? LIMIT 1")
    .bind(workspaceId)
    .first<Workspace>();
  if (!workspace) return null;

  const [
    missionCountResult,
    actionCountResult,
    evidenceCountResult,
    experimentCountResult,
    paymentCountResult,
    touchpointCountResult,
    contactCountResult,
    contentCountResult,
    succeededPaymentResult,
    pendingApprovalResult,
    missionEventsResult,
    actionsResult,
    evidenceResult,
    experimentsResult,
    paymentsResult,
    touchpointsResult,
    auditEventsResult,
  ] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS count FROM missions WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM action_queue WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM evidence WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM experiments WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM payments WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM touchpoints WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM contacts WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM content_assets WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM payments WHERE workspace_id = ? AND status = 'succeeded'",
      )
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM action_queue WHERE workspace_id = ? AND status = 'prepared'",
      )
      .bind(workspaceId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT id, title, created_at FROM mission_events WHERE mission_id IN (SELECT id FROM missions WHERE workspace_id = ?) ORDER BY created_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: number; title: string; created_at: number }>(),
    db
      .prepare(
        "SELECT id, title, created_at FROM action_queue WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: string; title: string; created_at: number }>(),
    db
      .prepare(
        "SELECT id, title, created_at FROM evidence WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: string; title: string; created_at: number }>(),
    db
      .prepare(
        "SELECT id, title, created_at FROM experiments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: string; title: string; created_at: number }>(),
    db
      .prepare(
        "SELECT id, status, received_at FROM payments WHERE workspace_id = ? ORDER BY received_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: string; status: string; received_at: number }>(),
    db
      .prepare(
        "SELECT id, channel, occurred_at FROM touchpoints WHERE workspace_id = ? ORDER BY occurred_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: string; channel: string; occurred_at: number }>(),
    db
      .prepare(
        "SELECT id, event_type, created_at FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 10",
      )
      .bind(workspaceId)
      .all<{ id: number; event_type: string; created_at: number }>(),
  ]);

  const activity: WorkspaceDashboardActivity[] = [];
  for (const row of missionEventsResult.results) {
    activity.push({
      kind: "mission_event",
      id: String(row.id),
      title: row.title,
      occurred_at: row.created_at,
    });
  }
  for (const row of actionsResult.results) {
    activity.push({
      kind: "action",
      id: row.id,
      title: row.title,
      occurred_at: row.created_at,
    });
  }
  for (const row of evidenceResult.results) {
    activity.push({
      kind: "evidence",
      id: row.id,
      title: row.title,
      occurred_at: row.created_at,
    });
  }
  for (const row of experimentsResult.results) {
    activity.push({
      kind: "experiment",
      id: row.id,
      title: row.title,
      occurred_at: row.created_at,
    });
  }
  for (const row of paymentsResult.results) {
    activity.push({
      kind: "payment",
      id: row.id,
      title: `payment ${row.status}`,
      occurred_at: row.received_at,
    });
  }
  for (const row of touchpointsResult.results) {
    activity.push({
      kind: "touchpoint",
      id: row.id,
      title: `touchpoint ${row.channel}`,
      occurred_at: row.occurred_at,
    });
  }
  for (const row of auditEventsResult.results) {
    activity.push({
      kind: "audit_event",
      id: String(row.id),
      title: row.event_type,
      occurred_at: row.created_at,
    });
  }
  activity.sort((a, b) => b.occurred_at - a.occurred_at);

  return {
    workspace_id: workspace.id,
    display_name: workspace.display_name,
    plan: workspace.plan,
    mission_count: missionCountResult?.count ?? 0,
    total_actions: actionCountResult?.count ?? 0,
    total_evidence: evidenceCountResult?.count ?? 0,
    total_experiments: experimentCountResult?.count ?? 0,
    total_payments: paymentCountResult?.count ?? 0,
    total_touchpoints: touchpointCountResult?.count ?? 0,
    total_contacts: contactCountResult?.count ?? 0,
    total_content_assets: contentCountResult?.count ?? 0,
    succeeded_payment_count: succeededPaymentResult?.count ?? 0,
    pending_approval_count: pendingApprovalResult?.count ?? 0,
    recent_activity: activity.slice(0, 25),
    generated_at: Date.now(),
  };
}

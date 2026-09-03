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
  await db.batch([
    db
      .prepare("INSERT INTO workspaces (id, owner_user_id, owner_email, display_name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, 'founder', ?, ?)")
      .bind(workspaceId, identity.userId, identity.email, identity.displayName, now, now),
    db
      .prepare("UPDATE missions SET workspace_id = ? WHERE workspace_id IS NULL")
      .bind(workspaceId),
  ]);
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

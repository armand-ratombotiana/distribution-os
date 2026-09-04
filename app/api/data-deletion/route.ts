import { z } from "zod";
import { getRawDb } from "../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
  type RequestIdentity,
} from "../../../db/workspaces";
import { buildAuditEntry, hashIp } from "../../../db/audit-pure";

const confirmSchema = z.object({
  confirm: z.literal("DELETE"),
});

/**
 * Tables that hold workspace-scoped data, ordered so that every row is
 * removed before its parent (FK-safe). The `audit_events` row written by
 * this endpoint is intentionally inserted BEFORE the cascade so it survives
 * the deletion and remains queryable for compliance review.
 */
const DELETION_TABLES = [
  "agent_steps",
  "agent_runs",
  "mission_events",
  "mission_versions",
  "strategy_versions",
  "evidence",
  "payments",
  "touchpoints",
  "content_assets",
  "experiments",
  "action_queue",
  "contacts",
  "workspace_settings",
  "workspace_connections",
  "connector_installations",
  "missions",
] as const;

async function logAuditEvent(args: {
  workspaceId: string;
  identity: RequestIdentity;
  request: Request;
  eventType: string;
  detail?: Record<string, unknown> | null;
}) {
  const db = getRawDb();
  const remoteIp =
    args.request.headers.get("cf-connecting-ip") ||
    args.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const ipHash = remoteIp ? await hashIp(remoteIp) : null;
  const row = buildAuditEntry({
    workspaceId: args.workspaceId,
    actorUserId: args.identity.userId,
    eventCategory: "deletion",
    eventType: args.eventType,
    resourceType: "workspace",
    resourceId: args.workspaceId,
    detail: args.detail ?? null,
    ipHash,
  });
  await db
    .prepare(
      "INSERT INTO audit_events (workspace_id, actor_user_id, event_category, event_type, action_id, resource_type, resource_id, detail_json, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      row.workspace_id,
      row.actor_user_id,
      row.event_category,
      row.event_type,
      row.action_id,
      row.resource_type,
      row.resource_id,
      row.detail_json,
      row.ip_hash,
      row.created_at,
    )
    .run();
}

export async function POST(request: Request) {
  try {
    const identity = requireRequestIdentity(request);
    const workspace = await ensureWorkspace(identity);
    const input = confirmSchema.parse(await request.json());

    // Audit BEFORE deletion so the record survives the cascade (audit_events
    // is itself workspace-scoped via FK and would be removed otherwise).
    await logAuditEvent({
      workspaceId: workspace.id,
      identity,
      request,
      eventType: "workspace.data_deleted",
      detail: {
        confirm: input.confirm,
        owner_email: workspace.owner_email,
        tables: [...DELETION_TABLES],
      },
    });

    const db = getRawDb();
    const statements = DELETION_TABLES.map((table) =>
      db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).bind(workspace.id),
    );
    await db.batch(statements);

    return Response.json({
      deleted: true,
      workspace_id: workspace.id,
      tables: [...DELETION_TABLES],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to request data deletion." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Confirmation required: send { "confirm": "DELETE" }.' },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Data deletion could not be completed.",
      },
      { status: 500 },
    );
  }
}

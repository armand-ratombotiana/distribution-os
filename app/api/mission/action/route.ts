import { z } from "zod";
import { advanceMission, approveMission, getMission } from "../../../../db/missions";
import {
  ensureWorkspace,
  requireRequestIdentity,
  type RequestIdentity,
} from "../../../../db/workspaces";
import { getRawDb } from "../../../../db/index";
import { buildAuditEntry, hashIp } from "../../../../db/audit-pure";
import { buildVersionId, nextVersionNumber } from "../../../../db/versions-pure";

const actionSchema = z.object({
  mission_id: z.string().trim().min(1).max(120),
  action: z.enum(["advance", "approve"]),
});

async function logAuditEvent(args: {
  workspaceId: string;
  identity: RequestIdentity;
  request: Request;
  eventCategory: "action" | "approval" | "security" | "config" | "deletion";
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
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
    eventCategory: args.eventCategory,
    eventType: args.eventType,
    resourceType: args.resourceType ?? null,
    resourceId: args.resourceId ?? null,
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

async function createMissionVersion(args: {
  workspaceId: string;
  missionId: string;
  missionJson: string;
  changeReason: string;
  createdBy: string;
}) {
  const db = getRawDb();
  const latest = await db
    .prepare(
      "SELECT version_number FROM mission_versions WHERE mission_id = ? ORDER BY version_number DESC LIMIT 1"
    )
    .bind(args.missionId)
    .first<{ version_number: number }>();
  const versionNumber = nextVersionNumber(latest?.version_number);
  const id = buildVersionId("mission", args.missionId);
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO mission_versions (id, workspace_id, mission_id, version_number, mission_json, change_reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      args.workspaceId,
      args.missionId,
      versionNumber,
      args.missionJson,
      args.changeReason,
      args.createdBy,
      now,
    )
    .run();
  return { id, versionNumber };
}

export async function POST(request: Request) {
  try {
    const identity = requireRequestIdentity(request);
    const workspace = await ensureWorkspace(identity);
    const input = actionSchema.parse(await request.json());

    if (input.action === "approve") {
      const result = await approveMission(input.mission_id, workspace.id, identity.userId);
      if (!result) {
        return Response.json({ error: "Mission not found." }, { status: 404 });
      }
      try {
        await logAuditEvent({
          workspaceId: workspace.id,
          identity,
          request,
          eventCategory: "approval",
          eventType: "mission.approved",
          resourceType: "mission",
          resourceId: input.mission_id,
          detail: { approved: true, mission_id: input.mission_id },
        });
      } catch {
        /* audit logging is best-effort */
      }
      return Response.json(result);
    }

    const advanced = await advanceMission(input.mission_id, workspace.id);
    if (!advanced) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const missionJson = JSON.stringify(advanced.mission ?? {});
    try {
      await createMissionVersion({
        workspaceId: workspace.id,
        missionId: input.mission_id,
        missionJson,
        changeReason: `Advanced to ${advanced.state?.current_stage ?? "next stage"} (cycle ${advanced.state?.cycle_number ?? 1}).`,
        createdBy: identity.userId,
      });
    } catch {
      /* version creation is best-effort */
    }

    try {
      await logAuditEvent({
        workspaceId: workspace.id,
        identity,
        request,
        eventCategory: "action",
        eventType: "mission.advanced",
        resourceType: "mission",
        resourceId: input.mission_id,
        detail: {
          next_stage: advanced.state?.current_stage ?? null,
          cycle_number: advanced.state?.cycle_number ?? null,
        },
      });
    } catch {
      /* audit logging is best-effort */
    }

    const refreshed = await getMission(input.mission_id, workspace.id);
    return Response.json(refreshed ?? advanced);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return Response.json({ error: "Sign in to control this mission." }, { status: 401 });
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid mission action." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("MISSION_BLOCKED:")) {
      return Response.json(
        { error: error.message.replace("MISSION_BLOCKED:", "").trim() },
        { status: 409 },
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Mission action failed." },
      { status: 500 }
    );
  }
}

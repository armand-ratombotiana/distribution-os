import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { getMission, saveMission } from "../../../../../db/missions";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

type CloneResponse = {
  source_mission_id: string;
  mission: Record<string, unknown>;
  mode: string;
  inspected: { final_url: string };
  state: {
    mission_id: string;
    status: string;
    current_stage: string;
    cycle_number: number;
    payment_count: number;
    approved: boolean;
    created_at: number;
    updated_at: number;
  };
};

/**
 * Clone a mission.
 *
 * Creates a new mission row that reuses the source mission's `website_url`,
 * `product_name`, `mode` and full `mission_json` payload, but starts from a
 * fresh lifecycle state — `status='learning'`, `current_stage='observe'`,
 * `cycle_number=1`, `payment_count=0`, `approved=0`. The cloned mission
 * receives a new `mission_id` (a fresh `MISSION-<uuid>`) inside the JSON so
 * the original and the clone do not collide on the user-facing identifier.
 *
 * Child rows (actions, evidence, experiments, payments, touchpoints,
 * mission_events) are intentionally NOT cloned — the clone starts with a
 * blank slate so the operator can re-run the loop against the same website
 * without dragging in historical state.
 *
 * The new mission is registered through `saveMission` (the same helper used by
 * `POST /api/mission`) so the initial `mission_events` ("Website intelligence
 * captured" + "Initial strategy synthesized") are seeded exactly as they
 * would be for a brand-new mission.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const source = await getMission(mission_id, workspace.id);
    if (!source) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const newMissionId = `MISSION-${crypto.randomUUID()}`;
    const clonedMissionPayload = {
      ...source.mission,
      mission_id: newMissionId,
    } as Record<string, unknown> & {
      mission_id: string;
      product_name: string;
    };

    const saved = await saveMission({
      mission: clonedMissionPayload,
      mode: source.mode,
      websiteUrl: source.inspected.final_url,
      workspaceId: workspace.id,
    });

    if (!saved) {
      return Response.json(
        { error: "Mission clone failed — the new mission could not be persisted." },
        { status: 500 },
      );
    }

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "mission.cloned",
        resource_type: "mission",
        resource_id: newMissionId,
        detail: {
          source_mission_id: mission_id,
          new_mission_id: newMissionId,
          website_url: source.inspected.final_url,
          mode: source.mode,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    const response: CloneResponse = {
      source_mission_id: mission_id,
      mission: saved.mission,
      mode: saved.mode,
      inspected: saved.inspected,
      state: saved.state,
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to clone a mission." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mission could not be cloned.",
      },
      { status: 500 },
    );
  }
}

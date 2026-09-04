import { getRawDb } from "../../../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { getMission } from "../../../../../db/missions";
import { logAuditEvent } from "../../../../../db/audit";

type RouteContext = {
  params: Promise<{ mission_id: string }>;
};

type TimelineRow = {
  id: string | number;
  kind:
    | "mission_event"
    | "action"
    | "evidence"
    | "experiment"
    | "payment"
    | "touchpoint";
  title: string;
  detail: string;
  occurred_at: number;
  payload: Record<string, unknown>;
};

type TimelineResponse = {
  mission_id: string;
  items: TimelineRow[];
  count: number;
  generated_at: number;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Combined mission timeline.
 *
 * Returns a single chronological stream interleaving every event-scoped row
 * type that belongs to a mission: `mission_events`, `action_queue`,
 * `evidence`, `experiments`, `payments` and `touchpoints`. Each row is mapped
 * to a `{kind, id, title, detail, occurred_at, payload}` envelope so the
 * client can render a unified timeline without a second request.
 *
 * Query params (all optional):
 *   - limit — clamp to [1, 500]; defaults to 100. Applied per-source so the
 *             union can be larger than `limit` when sources overlap; the
 *             final sorted list is sliced to `limit`.
 *   - kind  — single source filter (e.g. `?kind=payment`). When set, only
 *             that source is queried and the other five are skipped.
 *
 * Read-only — no rows are mutated. An audit_events row with category `action`
 * and type `mission.timeline_viewed` is logged after a successful response so
 * operators can track which missions are being inspected.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { mission_id } = await context.params;
    const mission = await getMission(mission_id, workspace.id);
    if (!mission) {
      return Response.json({ error: "Mission not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const kindFilter = url.searchParams.get("kind");

    const db = getRawDb();
    const workspaceId = workspace.id;

    const fetchMissionEvents =
      kindFilter && kindFilter !== "mission_event"
        ? null
        : db
            .prepare(
              "SELECT id, event_type, title, detail, actor, created_at FROM mission_events WHERE mission_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
            )
            .bind(mission_id, limit)
            .all<{
              id: number;
              event_type: string;
              title: string;
              detail: string;
              actor: string;
              created_at: number;
            }>();

    const fetchActions =
      kindFilter && kindFilter !== "action"
        ? null
        : db
            .prepare(
              "SELECT id, action_type, channel, title, summary, status, risk, created_at FROM action_queue WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(workspaceId, mission_id, limit)
            .all<{
              id: string;
              action_type: string;
              channel: string;
              title: string;
              summary: string;
              status: string;
              risk: string;
              created_at: number;
            }>();

    const fetchEvidence =
      kindFilter && kindFilter !== "evidence"
        ? null
        : db
            .prepare(
              "SELECT id, title, summary, source_type, state, created_at FROM evidence WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(workspaceId, mission_id, limit)
            .all<{
              id: string;
              title: string;
              summary: string;
              source_type: string;
              state: string;
              created_at: number;
            }>();

    const fetchExperiments =
      kindFilter && kindFilter !== "experiment"
        ? null
        : db
            .prepare(
              "SELECT id, title, hypothesis, status, decision, confidence, created_at, updated_at FROM experiments WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(workspaceId, mission_id, limit)
            .all<{
              id: string;
              title: string;
              hypothesis: string;
              status: string;
              decision: string;
              confidence: number;
              created_at: number;
              updated_at: number;
            }>();

    const fetchPayments =
      kindFilter && kindFilter !== "payment"
        ? null
        : db
            .prepare(
              "SELECT id, status, amount_cents, currency, provider, received_at FROM payments WHERE workspace_id = ? AND mission_id = ? ORDER BY received_at DESC LIMIT ?",
            )
            .bind(workspaceId, mission_id, limit)
            .all<{
              id: string;
              status: string;
              amount_cents: number;
              currency: string;
              provider: string;
              received_at: number;
            }>();

    const fetchTouchpoints =
      kindFilter && kindFilter !== "touchpoint"
        ? null
        : db
            .prepare(
              "SELECT id, channel, event_type, occurred_at FROM touchpoints WHERE workspace_id = ? AND mission_id = ? ORDER BY occurred_at DESC LIMIT ?",
            )
            .bind(workspaceId, mission_id, limit)
            .all<{
              id: string;
              channel: string;
              event_type: string;
              occurred_at: number;
            }>();

    const [
      missionEventsResult,
      actionsResult,
      evidenceResult,
      experimentsResult,
      paymentsResult,
      touchpointsResult,
    ] = await Promise.all([
      fetchMissionEvents,
      fetchActions,
      fetchEvidence,
      fetchExperiments,
      fetchPayments,
      fetchTouchpoints,
    ]);

    const items: TimelineRow[] = [];

    if (missionEventsResult) {
      for (const row of missionEventsResult.results) {
        items.push({
          id: row.id,
          kind: "mission_event",
          title: row.title,
          detail: row.detail,
          occurred_at: row.created_at,
          payload: {
            event_type: row.event_type,
            actor: row.actor,
          },
        });
      }
    }
    if (actionsResult) {
      for (const row of actionsResult.results) {
        items.push({
          id: row.id,
          kind: "action",
          title: row.title,
          detail: row.summary,
          occurred_at: row.created_at,
          payload: {
            action_type: row.action_type,
            channel: row.channel,
            status: row.status,
            risk: row.risk,
          },
        });
      }
    }
    if (evidenceResult) {
      for (const row of evidenceResult.results) {
        items.push({
          id: row.id,
          kind: "evidence",
          title: row.title,
          detail: row.summary,
          occurred_at: row.created_at,
          payload: {
            source_type: row.source_type,
            state: row.state,
          },
        });
      }
    }
    if (experimentsResult) {
      for (const row of experimentsResult.results) {
        items.push({
          id: row.id,
          kind: "experiment",
          title: row.title,
          detail: row.hypothesis,
          occurred_at: row.updated_at,
          payload: {
            status: row.status,
            decision: row.decision,
            confidence: row.confidence,
            created_at: row.created_at,
          },
        });
      }
    }
    if (paymentsResult) {
      for (const row of paymentsResult.results) {
        items.push({
          id: row.id,
          kind: "payment",
          title: `Payment ${row.status} — ${(row.amount_cents / 100).toFixed(2)} ${row.currency.toUpperCase()}`,
          detail: `Provider ${row.provider} recorded a ${row.status} payment.`,
          occurred_at: row.received_at,
          payload: {
            status: row.status,
            amount_cents: row.amount_cents,
            currency: row.currency,
            provider: row.provider,
          },
        });
      }
    }
    if (touchpointsResult) {
      for (const row of touchpointsResult.results) {
        items.push({
          id: row.id,
          kind: "touchpoint",
          title: `Touchpoint on ${row.channel}`,
          detail: `Event ${row.event_type} on ${row.channel}.`,
          occurred_at: row.occurred_at,
          payload: {
            channel: row.channel,
            event_type: row.event_type,
          },
        });
      }
    }

    items.sort((a, b) => b.occurred_at - a.occurred_at);
    const page = items.slice(0, limit);

    const response: TimelineResponse = {
      mission_id,
      items: page,
      count: page.length,
      generated_at: Date.now(),
    };

    try {
      await logAuditEvent(workspaceId, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "mission.timeline_viewed",
        resource_type: "mission",
        resource_id: mission_id,
        detail: {
          mission_id,
          item_count: page.length,
          kind_filter: kindFilter ?? null,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view the mission timeline." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mission timeline unavailable.",
      },
      { status: 500 },
    );
  }
}

import { getRawDb } from "../../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type UsageResponse = {
  workspace_id: string;
  api_calls: {
    total_audit_events: number;
    last_30_days: number;
    last_7_days: number;
    today: number;
  };
  storage: {
    missions: number;
    actions: number;
    evidence: number;
    experiments: number;
    payments: number;
    touchpoints: number;
    contacts: number;
    content_assets: number;
    audit_events: number;
    total_rows: number;
  };
  missions_this_month: number;
  missions_this_week: number;
  generated_at: number;
};

/**
 * Workspace usage statistics.
 *
 * Returns three buckets of usage data:
 *
 * 1. `api_calls` — counts of `audit_events` rows (used as a proxy for API
 *    activity since every state-changing route logs at least one audit
 *    event). Bucketed by time window: total, last 30 days, last 7 days,
 *    today.
 *
 * 2. `storage` — per-table row counts for the nine primary content tables
 *    (missions, action_queue, evidence, experiments, payments, touchpoints,
 *    contacts, content_assets, audit_events). The `total_rows` field sums
 *    the per-table counts so the UI can surface a single "X rows stored"
 *    KPI without recomputing.
 *
 * 3. `missions_this_month` / `missions_this_week` — counts of missions
 *    created in the current calendar month and the rolling 7-day window.
 *
 * All queries run in parallel as single indexed `COUNT(*)` reads, so the
 * endpoint is one round-trip's worth of latency. Read-only — no rows are
 * mutated.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const db = getRawDb();
    const workspaceId = workspace.id;
    const now = Date.now();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayStart = startOfToday.getTime();
    const sevenDaysAgo = now - 7 * MS_PER_DAY;
    const thirtyDaysAgo = now - 30 * MS_PER_DAY;

    const monthStart = new Date(now);
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartTime = monthStart.getTime();

    const [
      audit30Result,
      audit7Result,
      auditTodayResult,
      missionCountResult,
      actionCountResult,
      evidenceCountResult,
      experimentCountResult,
      paymentCountResult,
      touchpointCountResult,
      contactCountResult,
      contentCountResult,
      auditEventCountResult,
      missionsThisMonthResult,
      missionsThisWeekResult,
    ] = await Promise.all([
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ? AND created_at >= ?",
        )
        .bind(workspaceId, thirtyDaysAgo)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ? AND created_at >= ?",
        )
        .bind(workspaceId, sevenDaysAgo)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ? AND created_at >= ?",
        )
        .bind(workspaceId, todayStart)
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM missions WHERE workspace_id = ?")
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM action_queue WHERE workspace_id = ?",
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM evidence WHERE workspace_id = ?")
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM experiments WHERE workspace_id = ?",
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM payments WHERE workspace_id = ?")
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM touchpoints WHERE workspace_id = ?",
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM contacts WHERE workspace_id = ?")
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM content_assets WHERE workspace_id = ?",
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE workspace_id = ?",
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM missions WHERE workspace_id = ? AND created_at >= ?",
        )
        .bind(workspaceId, monthStartTime)
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM missions WHERE workspace_id = ? AND created_at >= ?",
        )
        .bind(workspaceId, sevenDaysAgo)
        .first<{ count: number }>(),
    ]);

    const missions = missionCountResult?.count ?? 0;
    const actions = actionCountResult?.count ?? 0;
    const evidence = evidenceCountResult?.count ?? 0;
    const experiments = experimentCountResult?.count ?? 0;
    const payments = paymentCountResult?.count ?? 0;
    const touchpoints = touchpointCountResult?.count ?? 0;
    const contacts = contactCountResult?.count ?? 0;
    const contentAssets = contentCountResult?.count ?? 0;
    const auditEvents = auditEventCountResult?.count ?? 0;
    const totalRows =
      missions +
      actions +
      evidence +
      experiments +
      payments +
      touchpoints +
      contacts +
      contentAssets +
      auditEvents;

    const response: UsageResponse = {
      workspace_id: workspaceId,
      api_calls: {
        total_audit_events: auditEvents,
        last_30_days: audit30Result?.count ?? 0,
        last_7_days: audit7Result?.count ?? 0,
        today: auditTodayResult?.count ?? 0,
      },
      storage: {
        missions,
        actions,
        evidence,
        experiments,
        payments,
        touchpoints,
        contacts,
        content_assets: contentAssets,
        audit_events: auditEvents,
        total_rows: totalRows,
      },
      missions_this_month: missionsThisMonthResult?.count ?? 0,
      missions_this_week: missionsThisWeekResult?.count ?? 0,
      generated_at: now,
    };

    return Response.json({ usage: response });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view workspace usage." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workspace usage unavailable.",
      },
      { status: 500 },
    );
  }
}

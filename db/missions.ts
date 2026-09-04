import { getRawDb } from "./index";
import {
  getMissionReadiness,
  type MissionStateSnapshot,
} from "../lib/mission-lifecycle-pure";

export type MissionMode = "simulation" | "live";

export type MissionSummary = {
  mission_id: string;
  current_stage: string;
  cycle_number: number;
  approved: boolean;
  status: string;
  action_count: number;
  evidence_count: number;
  experiment_count: number;
  payment_count: number;
  pending_approval_count: number;
  open_experiment_count: number;
  readiness_score: number;
  can_advance: boolean;
  blocking_reasons: string[];
};

export type MissionState = {
  mission_id: string;
  status: string;
  current_stage: string;
  cycle_number: number;
  payment_count: number;
  approved: boolean;
  created_at: number;
  updated_at: number;
};

export type MissionEvent = {
  id: number;
  event_type: string;
  title: string;
  detail: string;
  actor: string;
  created_at: number;
};

type MissionRow = {
  id: string;
  website_url: string;
  product_name: string;
  mode: MissionMode;
  status: string;
  current_stage: string;
  cycle_number: number;
  payment_count: number;
  approved: number;
  mission_json: string;
  created_at: number;
  updated_at: number;
};

function stateFromRow(row: MissionRow): MissionState {
  return {
    mission_id: row.id,
    status: row.status,
    current_stage: row.current_stage,
    cycle_number: row.cycle_number,
    payment_count: row.payment_count,
    approved: Boolean(row.approved),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function readEvents(missionId: string) {
  const db = getRawDb();
  const result = await db
    .prepare(
      "SELECT id, event_type, title, detail, actor, created_at FROM mission_events WHERE mission_id = ? ORDER BY created_at DESC, id DESC LIMIT 24"
    )
    .bind(missionId)
    .all<MissionEvent>();
  return result.results;
}

export async function saveMission(args: {
  mission: Record<string, unknown> & { mission_id: string; product_name: string };
  mode: MissionMode;
  websiteUrl: string;
  workspaceId: string;
}) {
  const db = getRawDb();
  const now = Date.now();
  const missionJson = JSON.stringify(args.mission);

  await db.batch([
    db
      .prepare(
        "INSERT INTO missions (id, workspace_id, website_url, product_name, mode, status, current_stage, cycle_number, payment_count, approved, mission_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'learning', 'observe', 1, 0, 0, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET workspace_id = excluded.workspace_id, website_url = excluded.website_url, product_name = excluded.product_name, mode = excluded.mode, mission_json = excluded.mission_json, updated_at = excluded.updated_at"
      )
      .bind(
        args.mission.mission_id,
        args.workspaceId,
        args.websiteUrl,
        args.mission.product_name,
        args.mode,
        missionJson,
        now,
        now
      ),
    db
      .prepare(
        "INSERT INTO mission_events (mission_id, event_type, title, detail, actor, created_at) VALUES (?, 'observation', 'Website intelligence captured', ?, 'Website Analyst', ?)"
      )
      .bind(
        args.mission.mission_id,
        `Analyzed ${args.websiteUrl} and stored the product context as mission memory.`,
        now
      ),
    db
      .prepare(
        "INSERT INTO mission_events (mission_id, event_type, title, detail, actor, created_at) VALUES (?, 'decision', 'Initial strategy synthesized', 'ICP, offer, channel hypothesis and falsifiable experiments are ready for execution.', 'AI CMO', ?)"
      )
      .bind(args.mission.mission_id, now + 1),
  ]);

  return getMission(args.mission.mission_id, args.workspaceId);
}

export async function getMission(missionId: string, workspaceId: string) {
  const db = getRawDb();
  const row = await db
    .prepare("SELECT * FROM missions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(missionId, workspaceId)
    .first<MissionRow>();
  if (!row) return null;

  return {
    mission: JSON.parse(row.mission_json) as Record<string, unknown>,
    mode: row.mode,
    inspected: { final_url: row.website_url },
    state: stateFromRow(row),
    events: await readEvents(row.id),
  };
}

export async function getLatestMission(workspaceId: string) {
  const db = getRawDb();
  const row = await db
    .prepare("SELECT * FROM missions WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 1")
    .bind(workspaceId)
    .first<MissionRow>();
  if (!row) return null;

  return {
    mission: JSON.parse(row.mission_json) as Record<string, unknown>,
    mode: row.mode,
    inspected: { final_url: row.website_url },
    state: stateFromRow(row),
    events: await readEvents(row.id),
  };
}

const stages = ["observe", "decide", "act", "measure", "learn"] as const;

export async function advanceMission(missionId: string, workspaceId: string) {
  const db = getRawDb();
  const row = await db
    .prepare("SELECT * FROM missions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(missionId, workspaceId)
    .first<MissionRow>();
  if (!row) return null;

  const position = stages.indexOf(row.current_stage as (typeof stages)[number]);
  const nextStage = stages[(position < 0 ? 0 : position + 1) % stages.length];
  const nextCycle = nextStage === "observe" ? row.cycle_number + 1 : row.cycle_number;
  const now = Date.now();
  const detailByStage: Record<string, string> = {
    decide: "The orchestrator ranked the next experiment against mission evidence and the first-payment objective.",
    act: "The next safe internal action is prepared. External publication, outreach and spend remain approval-gated.",
    measure: "The revenue analyst opened the measurement window and is waiting for attributable channel signals.",
    learn: "The evidence ledger is being compared with the hypothesis and its kill rule.",
    observe: "A new learning cycle started with the latest retained mission evidence.",
  };

  await db.batch([
    db
      .prepare(
        "UPDATE missions SET current_stage = ?, cycle_number = ?, updated_at = ? WHERE id = ? AND workspace_id = ?"
      )
      .bind(nextStage, nextCycle, now, missionId, workspaceId),
    db
      .prepare(
        "INSERT INTO mission_events (mission_id, event_type, title, detail, actor, created_at) VALUES (?, 'loop', ?, ?, 'AI CMO', ?)"
      )
      .bind(
        missionId,
        `${nextStage[0].toUpperCase()}${nextStage.slice(1)} stage entered`,
        detailByStage[nextStage],
        now
      ),
  ]);

  return getMission(missionId, workspaceId);
}

export async function approveMission(missionId: string, workspaceId: string) {
  const db = getRawDb();
  const row = await db
    .prepare("SELECT * FROM missions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(missionId, workspaceId)
    .first<MissionRow>();
  if (!row) return null;
  if (row.approved) return getMission(missionId, workspaceId);

  const now = Date.now();
  await db.batch([
    db
      .prepare("UPDATE missions SET approved = 1, updated_at = ? WHERE id = ? AND workspace_id = ?")
      .bind(now, missionId, workspaceId),
    db
      .prepare(
        "INSERT INTO mission_events (mission_id, event_type, title, detail, actor, created_at) VALUES (?, 'approval', 'External action approved', 'The next reviewed distribution batch may be released after its destination account is connected. This does not authorize spend or payment configuration.', 'Human operator', ?)"
      )
      .bind(missionId, now),
  ]);

  return getMission(missionId, workspaceId);
}

/**
 * Aggregated mission stats used by the mission summary route and workspace
 * dashboard. Returns null when the mission does not exist in the workspace.
 *
 * The counts come from per-table `COUNT(*)` queries scoped to the
 * (workspace_id, mission_id) pair — each query is a single indexed read so
 * the call stays cheap even on missions with thousands of rows. The
 * readiness score is derived from `getMissionReadiness` in the pure
 * lifecycle module, which factors in pending approvals and open experiments.
 */
export async function getMissionSummary(
  missionId: string,
  workspaceId: string,
): Promise<MissionSummary | null> {
  const db = getRawDb();
  const row = await db
    .prepare("SELECT * FROM missions WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(missionId, workspaceId)
    .first<MissionRow>();
  if (!row) return null;

  const [
    actionCountResult,
    evidenceCountResult,
    experimentCountResult,
    paymentCountResult,
    pendingApprovalResult,
    openExperimentResult,
  ] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM action_queue WHERE workspace_id = ? AND mission_id = ?",
      )
      .bind(workspaceId, missionId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM evidence WHERE workspace_id = ? AND mission_id = ?",
      )
      .bind(workspaceId, missionId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM experiments WHERE workspace_id = ? AND mission_id = ?",
      )
      .bind(workspaceId, missionId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM payments WHERE workspace_id = ? AND mission_id = ?",
      )
      .bind(workspaceId, missionId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM action_queue WHERE workspace_id = ? AND mission_id = ? AND status = 'prepared'",
      )
      .bind(workspaceId, missionId)
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM experiments WHERE workspace_id = ? AND mission_id = ? AND status IN ('draft', 'running')",
      )
      .bind(workspaceId, missionId)
      .first<{ count: number }>(),
  ]);

  const snapshot: MissionStateSnapshot = {
    current_stage: row.current_stage,
    cycle_number: row.cycle_number,
    payment_count: row.payment_count,
    approved: Boolean(row.approved),
    status: row.status,
  };
  const readiness = getMissionReadiness(snapshot, {
    pendingApprovals: pendingApprovalResult?.count ?? 0,
    openExperiments: openExperimentResult?.count ?? 0,
  });

  return {
    mission_id: row.id,
    current_stage: row.current_stage,
    cycle_number: row.cycle_number,
    approved: Boolean(row.approved),
    status: row.status,
    action_count: actionCountResult?.count ?? 0,
    evidence_count: evidenceCountResult?.count ?? 0,
    experiment_count: experimentCountResult?.count ?? 0,
    payment_count: paymentCountResult?.count ?? 0,
    pending_approval_count: pendingApprovalResult?.count ?? 0,
    open_experiment_count: openExperimentResult?.count ?? 0,
    readiness_score: readiness.readiness_score,
    can_advance: readiness.can_advance,
    blocking_reasons: readiness.blocking_reasons,
  };
}

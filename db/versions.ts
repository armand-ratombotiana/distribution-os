/**
 * D1 persistence layer for the `mission_versions` and `strategy_versions`
 * tables.
 *
 * Tenant-isolated by `workspace_id`. Versioning is append-only: every call to
 * `createMissionVersion` / `createStrategyVersion` reads the latest existing
 * version number, bumps it via `nextVersionNumber`, validates the change
 * reason, and inserts a new row. Delegates all validation, diffing and display
 * logic to `./versions-pure`. IDs use `buildVersionId` and timestamps use
 * `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildVersionId,
  nextVersionNumber,
  validateChangeReason,
  type MissionVersionRow,
  type StrategyVersionRow,
} from "./versions-pure";

export * from "./versions-pure";

export type CreateMissionVersionInput = {
  mission_id: string;
  mission: Record<string, unknown>;
  change_reason: string;
  created_by: string;
};

export type CreateStrategyVersionInput = {
  mission_id: string;
  strategy: Record<string, unknown>;
  hypothesis: string;
  confidence?: number;
  change_reason: string;
  created_by: string;
};

export type ListVersionsOptions = {
  limit?: number;
};

/**
 * Append a new mission version. The `version_number` is derived from the
 * latest existing version (1 when none exists). The change reason is
 * validated by the pure helper before any SQL is executed.
 */
export async function createMissionVersion(
  workspaceId: string,
  input: CreateMissionVersionInput,
): Promise<MissionVersionRow> {
  const reasonValidation = validateChangeReason(input.change_reason);
  if (!reasonValidation.valid) {
    throw new Error(
      `Invalid change reason: ${reasonValidation.errors.join("; ")}`,
    );
  }
  const db = getRawDb();
  const now = Date.now();
  const latest = await db
    .prepare(
      "SELECT version_number FROM mission_versions WHERE workspace_id = ? AND mission_id = ? ORDER BY version_number DESC LIMIT 1",
    )
    .bind(workspaceId, input.mission_id)
    .first<{ version_number: number }>();
  const versionNumber = nextVersionNumber(latest?.version_number ?? null);
  const id = buildVersionId("mission", input.mission_id);
  const missionJson = JSON.stringify(input.mission);

  await db
    .prepare(
      "INSERT INTO mission_versions (id, workspace_id, mission_id, version_number, mission_json, change_reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      versionNumber,
      missionJson,
      input.change_reason,
      input.created_by,
      now,
    )
    .run();

  const row = await db
    .prepare(
      "SELECT * FROM mission_versions WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, id)
    .first<MissionVersionRow>();
  if (!row) {
    throw new Error("Failed to create mission version");
  }
  return row;
}

/**
 * List mission versions for a workspace + mission, ordered by
 * `version_number DESC`, capped at `limit` (default 50, max 200).
 */
export async function listMissionVersions(
  workspaceId: string,
  missionId: string,
  opts: ListVersionsOptions = {},
): Promise<MissionVersionRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const result = await db
    .prepare(
      "SELECT * FROM mission_versions WHERE workspace_id = ? AND mission_id = ? ORDER BY version_number DESC LIMIT ?",
    )
    .bind(workspaceId, missionId, limit)
    .all<MissionVersionRow>();
  return result.results;
}

/**
 * Append a new strategy version. The `version_number` is derived from the
 * latest existing version. The change reason is validated by the pure helper
 * and the confidence is clamped to the 0-100 range.
 */
export async function createStrategyVersion(
  workspaceId: string,
  input: CreateStrategyVersionInput,
): Promise<StrategyVersionRow> {
  const reasonValidation = validateChangeReason(input.change_reason);
  if (!reasonValidation.valid) {
    throw new Error(
      `Invalid change reason: ${reasonValidation.errors.join("; ")}`,
    );
  }
  if (
    !Number.isFinite(input.confidence ?? 0) ||
    (input.confidence ?? 0) < 0 ||
    (input.confidence ?? 0) > 100
  ) {
    throw new Error("confidence must be between 0 and 100");
  }
  const db = getRawDb();
  const now = Date.now();
  const latest = await db
    .prepare(
      "SELECT version_number FROM strategy_versions WHERE workspace_id = ? AND mission_id = ? ORDER BY version_number DESC LIMIT 1",
    )
    .bind(workspaceId, input.mission_id)
    .first<{ version_number: number }>();
  const versionNumber = nextVersionNumber(latest?.version_number ?? null);
  const id = buildVersionId("strategy", input.mission_id);
  const strategyJson = JSON.stringify(input.strategy);
  const confidence = Math.max(
    0,
    Math.min(100, Math.floor(input.confidence ?? 0)),
  );

  await db
    .prepare(
      "INSERT INTO strategy_versions (id, workspace_id, mission_id, version_number, strategy_json, hypothesis, confidence, change_reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      versionNumber,
      strategyJson,
      input.hypothesis,
      confidence,
      input.change_reason,
      input.created_by,
      now,
    )
    .run();

  const row = await db
    .prepare(
      "SELECT * FROM strategy_versions WHERE workspace_id = ? AND id = ? LIMIT 1",
    )
    .bind(workspaceId, id)
    .first<StrategyVersionRow>();
  if (!row) {
    throw new Error("Failed to create strategy version");
  }
  return row;
}

/**
 * List strategy versions for a workspace + mission, ordered by
 * `version_number DESC`, capped at `limit` (default 50, max 200).
 */
export async function listStrategyVersions(
  workspaceId: string,
  missionId: string,
  opts: ListVersionsOptions = {},
): Promise<StrategyVersionRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const result = await db
    .prepare(
      "SELECT * FROM strategy_versions WHERE workspace_id = ? AND mission_id = ? ORDER BY version_number DESC LIMIT ?",
    )
    .bind(workspaceId, missionId, limit)
    .all<StrategyVersionRow>();
  return result.results;
}

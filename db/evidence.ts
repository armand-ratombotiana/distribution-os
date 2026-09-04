/**
 * D1 persistence layer for the `evidence` table.
 *
 * Tenant-isolated by `workspace_id`. Delegates state-machine, hashing and
 * display logic to `./evidence-pure`. IDs use `crypto.randomUUID()` and
 * timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  canTransition,
  canonicalJson,
  hashContent,
  type EvidenceRow,
  type EvidenceState,
  type EvidenceSourceType,
} from "./evidence-pure";

export * from "./evidence-pure";

export type CreateEvidenceInput = {
  mission_id: string;
  source_url?: string | null;
  source_type: EvidenceSourceType;
  content: unknown;
  title: string;
  summary: string;
  extracted_facts?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
  state?: EvidenceState;
  contradiction_of_id?: string | null;
  parser_version?: string;
};

export type ListEvidenceOptions = {
  mission_id?: string;
  state?: EvidenceState;
  limit?: number;
};

function isEvidenceState(value: unknown): value is EvidenceState {
  return (
    typeof value === "string" &&
    [
      "observed",
      "inferred",
      "needed",
      "verified",
      "contradicted",
      "stale",
      "rejected",
    ].includes(value)
  );
}

function isEvidenceSourceType(
  value: unknown,
): value is EvidenceSourceType {
  return (
    typeof value === "string" &&
    [
      "website",
      "email",
      "social",
      "crm",
      "analytics",
      "payment",
      "document",
      "manual",
    ].includes(value)
  );
}

/**
 * Insert a new evidence row. The content is canonicalised and hashed so that
 * the same source material cannot be persisted twice under a different id.
 */
export async function createEvidence(
  workspaceId: string,
  input: CreateEvidenceInput,
): Promise<EvidenceRow> {
  if (!isEvidenceSourceType(input.source_type)) {
    throw new Error(`Invalid evidence source type: ${String(input.source_type)}`);
  }
  const db = getRawDb();
  const now = Date.now();
  const contentHash = await hashContent(input.content);
  const extractedFactsJson = input.extracted_facts
    ? canonicalJson(input.extracted_facts)
    : "{}";
  const provenanceJson = input.provenance
    ? canonicalJson(input.provenance)
    : "{}";
  const state: EvidenceState = input.state ?? "observed";
  if (!isEvidenceState(state)) {
    throw new Error(`Invalid evidence state: ${String(state)}`);
  }
  const id = `ev_${crypto.randomUUID()}`;
  const parserVersion = input.parser_version ?? "1.0";

  await db
    .prepare(
      "INSERT INTO evidence (id, workspace_id, mission_id, source_url, source_type, content_hash, parser_version, title, summary, extracted_facts_json, provenance_json, state, contradiction_of_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      workspaceId,
      input.mission_id,
      input.source_url ?? null,
      input.source_type,
      contentHash,
      parserVersion,
      input.title,
      input.summary,
      extractedFactsJson,
      provenanceJson,
      state,
      input.contradiction_of_id ?? null,
      now,
      now,
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM evidence WHERE workspace_id = ? AND id = ? LIMIT 1")
    .bind(workspaceId, id)
    .first<EvidenceRow>();
  if (!row) {
    throw new Error("Failed to create evidence");
  }
  return row;
}

/**
 * List evidence rows for a workspace, optionally filtered by mission and/or
 * state. Ordered by `created_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listEvidence(
  workspaceId: string,
  opts: ListEvidenceOptions = {},
): Promise<EvidenceRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.state) {
    if (!isEvidenceState(opts.state)) {
      throw new Error(`Invalid evidence state: ${String(opts.state)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM evidence WHERE workspace_id = ? AND mission_id = ? AND state = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.state, limit)
      .all<EvidenceRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM evidence WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<EvidenceRow>();
    return result.results;
  }
  if (opts.state) {
    if (!isEvidenceState(opts.state)) {
      throw new Error(`Invalid evidence state: ${String(opts.state)}`);
    }
    const result = await db
      .prepare(
        "SELECT * FROM evidence WHERE workspace_id = ? AND state = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.state, limit)
      .all<EvidenceRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM evidence WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<EvidenceRow>();
  return result.results;
}

/** Fetch a single evidence row by id within a workspace. */
export async function getEvidence(
  workspaceId: string,
  evidenceId: string,
): Promise<EvidenceRow | null> {
  const db = getRawDb();
  return db
    .prepare("SELECT * FROM evidence WHERE workspace_id = ? AND id = ? LIMIT 1")
    .bind(workspaceId, evidenceId)
    .first<EvidenceRow>();
}

/**
 * Transition an evidence row to a new state. Refuses the transition when the
 * state machine (`canTransition`) does not permit it.
 */
export async function updateEvidenceState(
  workspaceId: string,
  evidenceId: string,
  newState: EvidenceState,
): Promise<EvidenceRow> {
  if (!isEvidenceState(newState)) {
    throw new Error(`Invalid evidence state: ${String(newState)}`);
  }
  const db = getRawDb();
  const current = await getEvidence(workspaceId, evidenceId);
  if (!current) {
    throw new Error(`Evidence not found: ${evidenceId}`);
  }
  if (!canTransition(current.state, newState)) {
    throw new Error(
      `Evidence ${evidenceId} cannot transition from ${current.state} to ${newState}`,
    );
  }
  const now = Date.now();
  await db
    .prepare(
      "UPDATE evidence SET state = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(newState, now, workspaceId, evidenceId)
    .run();

  const updated = await getEvidence(workspaceId, evidenceId);
  if (!updated) {
    throw new Error(`Evidence disappeared after update: ${evidenceId}`);
  }
  return updated;
}

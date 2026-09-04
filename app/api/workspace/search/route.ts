import { getRawDb } from "../../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

type MissionHit = {
  id: string;
  product_name: string;
  website_url: string;
  status: string;
  current_stage: string;
  created_at: number;
};

type ActionHit = {
  id: string;
  mission_id: string;
  action_type: string;
  channel: string;
  title: string;
  status: string;
  created_at: number;
};

type EvidenceHit = {
  id: string;
  mission_id: string;
  title: string;
  source_type: string;
  state: string;
  created_at: number;
};

type ContactHit = {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  status: string;
  created_at: number;
};

type SearchResponse = {
  query: string;
  missions: MissionHit[];
  actions: ActionHit[];
  evidence: EvidenceHit[];
  contacts: ContactHit[];
  total: number;
  generated_at: number;
};

/**
 * Workspace-wide full-text search across the four most user-facing tables:
 * `missions`, `action_queue`, `evidence` and `contacts`.
 *
 * The `?q=` query param is required. Search uses SQL `LIKE` with a
 * wildcard-escaped pattern (`%query%`) so it works on D1's default SQLite
 * collation without enabling FTS5. Special LIKE characters (`%`, `_`, `\`)
 * in the user input are escaped via `ESCAPE '\'` so the query is treated
 * literally.
 *
 * Each table is queried in parallel and capped at `limit` rows (default 20,
 * max 100). The response is a grouped object (not a flattened list) so the
 * client can render hits by type without re-querying.
 *
 * Read-only — no rows are mutated.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const rawQuery = (url.searchParams.get("q") ?? "").trim();
    if (rawQuery.length < MIN_QUERY_LENGTH) {
      return Response.json(
        {
          error: `Query must be at least ${MIN_QUERY_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }
    if (rawQuery.length > MAX_QUERY_LENGTH) {
      return Response.json(
        {
          error: `Query must be at most ${MAX_QUERY_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    // Escape LIKE wildcards and the escape char itself so the user input is
    // treated literally inside the pattern.
    const escaped = rawQuery.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;

    const db = getRawDb();
    const workspaceId = workspace.id;

    const [missionsResult, actionsResult, evidenceResult, contactsResult] =
      await Promise.all([
        db
          .prepare(
            "SELECT id, product_name, website_url, status, current_stage, created_at FROM missions WHERE workspace_id = ? AND (product_name LIKE ? ESCAPE '\\' OR website_url LIKE ? ESCAPE '\\' OR status LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT ?",
          )
          .bind(workspaceId, pattern, pattern, pattern, limit)
          .all<MissionHit>(),
        db
          .prepare(
            "SELECT id, mission_id, action_type, channel, title, status, created_at FROM action_queue WHERE workspace_id = ? AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR action_type LIKE ? ESCAPE '\\' OR channel LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT ?",
          )
          .bind(workspaceId, pattern, pattern, pattern, pattern, limit)
          .all<ActionHit>(),
        db
          .prepare(
            "SELECT id, mission_id, title, source_type, state, created_at FROM evidence WHERE workspace_id = ? AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR source_type LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT ?",
          )
          .bind(workspaceId, pattern, pattern, pattern, limit)
          .all<EvidenceHit>(),
        db
          .prepare(
            "SELECT id, email, name, company, role, status, created_at FROM contacts WHERE workspace_id = ? AND (email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR role LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT ?",
          )
          .bind(workspaceId, pattern, pattern, pattern, pattern, limit)
          .all<ContactHit>(),
      ]);

    const missions = missionsResult.results;
    const actions = actionsResult.results;
    const evidence = evidenceResult.results;
    const contacts = contactsResult.results;
    const total =
      missions.length + actions.length + evidence.length + contacts.length;

    const response: SearchResponse = {
      query: rawQuery,
      missions,
      actions,
      evidence,
      contacts,
      total,
      generated_at: Date.now(),
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to search the workspace." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Workspace search unavailable.",
      },
      { status: 500 },
    );
  }
}

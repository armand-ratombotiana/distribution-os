import { ensureWorkspace, requireRequestIdentity } from "../../../db/workspaces";
import { listAuditEvents, summarizeForDisplay } from "../../../db/audit";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const VALID_CATEGORIES = new Set([
  "auth",
  "role",
  "approval",
  "connector",
  "action",
  "payment",
  "export",
  "deletion",
  "security",
  "config",
]);

/**
 * List audit events for the current workspace.
 *
 * Query params (all optional):
 *   - category — filter by `event_category` (validated against the schema enum).
 *   - from     — inclusive lower bound on `created_at` (epoch ms or ISO 8601).
 *   - to       — inclusive upper bound on `created_at` (epoch ms or ISO 8601).
 *   - limit    — clamp to [1, 200]; defaults to 50.
 *
 * Results are returned newest-first. The `ip_hash` column is redacted by
 * `summarizeForDisplay` before being returned to the client.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const categoryParam = url.searchParams.get("category") ?? undefined;
    if (categoryParam && !VALID_CATEGORIES.has(categoryParam)) {
      return Response.json(
        { error: `Invalid audit category: ${categoryParam}` },
        { status: 400 },
      );
    }
    const fromMs = parseTimestamp(url.searchParams.get("from"));
    const toMs = parseTimestamp(url.searchParams.get("to"));
    if (fromMs !== null && toMs !== null && toMs < fromMs) {
      return Response.json(
        { error: "`to` must not be earlier than `from`." },
        { status: 400 },
      );
    }
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const rows = await listAuditEvents(workspace.id, {
      event_category: categoryParam as
        | "auth"
        | "role"
        | "approval"
        | "connector"
        | "action"
        | "payment"
        | "export"
        | "deletion"
        | "security"
        | "config"
        | undefined,
      limit,
    });

    const filtered = rows.filter((row) => {
      if (fromMs !== null && row.created_at < fromMs) return false;
      if (toMs !== null && row.created_at > toMs) return false;
      return true;
    });

    return Response.json({
      events: filtered.map(summarizeForDisplay),
      count: filtered.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view the audit log." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Audit log unavailable.",
      },
      { status: 500 },
    );
  }
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const asNumber = Number.parseInt(value, 10);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const asDate = Date.parse(value);
  if (Number.isFinite(asDate)) return asDate;
  return null;
}

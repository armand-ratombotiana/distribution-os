import { getRawDb } from "../../../../db/index";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import { logAuditEvent } from "../../../../db/audit";

type ContactExportRow = {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  source: string;
  status: string;
  consent_given: number;
  last_contacted_at: number | null;
  converted_at: number | null;
  created_at: number;
  updated_at: number;
};

const CSV_HEADERS = [
  "id",
  "email",
  "name",
  "company",
  "role",
  "source",
  "status",
  "consent_given",
  "last_contacted_at",
  "converted_at",
  "created_at",
  "updated_at",
] as const;

const MAX_EXPORT_ROWS = 5000;

/**
 * Export all contacts for the current workspace as CSV or JSON.
 *
 * The `?format=` query param selects the output encoding:
 *   - `csv`  (default) — RFC 4180 CSV with a header row. Commas, quotes and
 *                        newlines inside field values are wrapped in double
 *                        quotes; embedded double quotes are escaped by
 *                        doubling. `null` values render as an empty field.
 *   - `json`           — pretty-printed JSON array of the raw rows (no
 *                        `qualification_signals_json` field — signals are
 *                        intentionally excluded from exports to avoid
 *                        leaking PII-laden inferences).
 *
 * The response sets `Content-Disposition: attachment` so browsers offer the
 * payload as a download. Results are capped at `MAX_EXPORT_ROWS` (5000) —
 * larger workspaces should page by `created_at` (not yet implemented).
 *
 * An audit_events row with category `export` and type `contacts.exported`
 * is logged after a successful download so operators can track data
 * movement.
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
    if (format !== "csv" && format !== "json") {
      return Response.json(
        { error: `Unsupported export format: ${format}` },
        { status: 400 },
      );
    }

    const db = getRawDb();
    const result = await db
      .prepare(
        "SELECT id, email, name, company, role, source, status, consent_given, last_contacted_at, converted_at, created_at, updated_at FROM contacts WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspace.id, MAX_EXPORT_ROWS)
      .all<ContactExportRow>();

    const rows = result.results;
    const exportedAt = Date.now();
    const filename = `contacts-${workspace.id}-${new Date(exportedAt)
      .toISOString()
      .replace(/[:.]/g, "-")}.${format}`;

    let body: string;
    let contentType: string;

    if (format === "json") {
      body = JSON.stringify({ exported_at: exportedAt, contacts: rows }, null, 2);
      contentType = "application/json; charset=utf-8";
    } else {
      body = toCsv(rows);
      contentType = "text/csv; charset=utf-8";
    }

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "export",
        event_type: "contacts.exported",
        resource_type: "contact",
        resource_id: workspace.id,
        detail: {
          format,
          count: rows.length,
          exported_at: exportedAt,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to export contacts." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Contacts export failed.",
      },
      { status: 500 },
    );
  }
}

/**
 * Serialize contact rows to RFC 4180 CSV.
 *
 * Each field is escaped by wrapping in double quotes whenever it contains a
 * comma, double-quote, newline or carriage return. Embedded double quotes
 * are doubled (`"` → `""`). `null` values render as an empty field (the
 * separating comma is still emitted so column alignment is preserved).
 */
function toCsv(rows: ContactExportRow[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    const fields: string[] = [
      row.id,
      row.email ?? "",
      row.name ?? "",
      row.company ?? "",
      row.role ?? "",
      row.source,
      row.status,
      row.consent_given ? "true" : "false",
      row.last_contacted_at !== null ? String(row.last_contacted_at) : "",
      row.converted_at !== null ? String(row.converted_at) : "",
      String(row.created_at),
      String(row.updated_at),
    ];
    lines.push(fields.map(escapeCsvField).join(","));
  }
  return lines.join("\n");
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

import { z } from "zod";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import {
  createContact,
  summarizeForDisplay,
  type CreateContactInput,
} from "../../../../db/contacts";
import { logAuditEvent } from "../../../../db/audit";

const contactSourceEnum = z.enum([
  "manual",
  "import",
  "form",
  "referral",
  "outreach",
  "event",
  "api",
]);

const contactImportItemSchema = z.object({
  mission_id: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().max(254).optional(),
  name: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  source: contactSourceEnum.default("import"),
  consent_given: z.boolean().optional(),
  qualification_signals: z.record(z.unknown()).optional(),
});

const importPayloadSchema = z
  .object({
    contacts: z.array(contactImportItemSchema).min(1).max(500),
  })
  .strict();

type ImportFailure = {
  index: number;
  email: string | null;
  error: string;
};

type ImportResponse = {
  imported: ReturnType<typeof summarizeForDisplay>[];
  failures: ImportFailure[];
  imported_count: number;
  failed_count: number;
};

/**
 * Bulk import contacts from a JSON array.
 *
 * Accepts a `{ contacts: [...] }` payload (max 500 items per call). Each item
 * is validated by the same zod schema used by `POST /api/contacts`, then
 * inserted through `createContact` so email validation, lifecycle defaults
 * and PII-safe storage rules are applied identically to single-contact
 * creation. The default `source` is `import` (overridable per item).
 *
 * Inserts are independent: a failure on one item (e.g. duplicate email,
 * invalid format) does not block the others. The response includes the
 * `imported` array (display-safe summaries) and a `failures` array with
 * per-item error messages and the originating index. A single audit_events
 * row with category `action` and type `contacts.bulk_imported` is logged
 * after the batch completes, recording the imported/failed counts.
 */
export async function POST(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const input = importPayloadSchema.parse(await request.json());

    const imported: ReturnType<typeof summarizeForDisplay>[] = [];
    const failures: ImportFailure[] = [];

    for (let index = 0; index < input.contacts.length; index++) {
      const item = input.contacts[index];
      try {
        const createInput: CreateContactInput = {
          mission_id: item.mission_id ?? null,
          email: item.email || null,
          name: item.name || null,
          company: item.company || null,
          role: item.role || null,
          source: item.source,
          consent_given: item.consent_given ?? false,
          qualification_signals: item.qualification_signals ?? null,
        };
        const contact = await createContact(workspace.id, createInput);
        imported.push(summarizeForDisplay(contact));
      } catch (error) {
        failures.push({
          index,
          email: item.email ?? null,
          error:
            error instanceof Error ? error.message : "Could not import contact.",
        });
      }
    }

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "contacts.bulk_imported",
        resource_type: "contact",
        resource_id: workspace.id,
        detail: {
          attempted: input.contacts.length,
          imported_count: imported.length,
          failed_count: failures.length,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    const response: ImportResponse = {
      imported,
      failures,
      imported_count: imported.length,
      failed_count: failures.length,
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to import contacts." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid contacts import payload." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Contacts could not be imported.",
      },
      { status: 500 },
    );
  }
}

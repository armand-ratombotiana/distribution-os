import { z } from "zod";
import { ensureWorkspace, requireRequestIdentity } from "../../../db/workspaces";
import {
  createContact,
  listContacts,
  summarizeForDisplay,
} from "../../../db/contacts";
import { logAuditEvent } from "../../../db/audit";

const createContactSchema = z.object({
  mission_id: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().max(254).optional(),
  name: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  source: z.enum(["manual", "import", "form", "referral", "outreach", "event", "api"]),
  consent_given: z.boolean().optional(),
  qualification_signals: z.record(z.unknown()).optional(),
});

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const VALID_STATUSES = new Set([
  "new",
  "qualified",
  "contacted",
  "replied",
  "meeting",
  "converted",
  "rejected",
  "unsubscribed",
]);

/**
 * Contacts for the current workspace.
 *
 * GET  — list contacts, optionally filtered by `mission_id` and/or `status`.
 * POST — create a contact. Email is validated by the pure helper (the route
 *        schema accepts empty/null emails so contacts can be created from
 *        social handles, but malformed emails are rejected at the db layer).
 */
export async function GET(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const url = new URL(request.url);
    const missionId = url.searchParams.get("mission_id") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    if (status && !VALID_STATUSES.has(status)) {
      return Response.json(
        { error: `Invalid contact status: ${status}` },
        { status: 400 },
      );
    }
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const contacts = await listContacts(workspace.id, {
      mission_id: missionId,
      status,
      limit,
    });

    return Response.json({
      contacts: contacts.map(summarizeForDisplay),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to view contacts." },
        { status: 401 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Contacts could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const input = createContactSchema.parse(await request.json());
    const contact = await createContact(workspace.id, {
      mission_id: input.mission_id ?? null,
      email: input.email || null,
      name: input.name || null,
      company: input.company || null,
      role: input.role || null,
      source: input.source,
      consent_given: input.consent_given ?? false,
      qualification_signals: input.qualification_signals ?? null,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "contact.created",
        resource_type: "contact",
        resource_id: contact.id,
        detail: {
          mission_id: contact.mission_id,
          source: contact.source,
          status: contact.status,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json(
      { contact: summarizeForDisplay(contact) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to manage contacts." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid contact request." },
        { status: 400 },
      );
    }
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Contact could not be created.",
      },
      { status: 500 },
    );
  }
}

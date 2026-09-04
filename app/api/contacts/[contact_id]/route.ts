import { z } from "zod";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../db/workspaces";
import {
  getContact,
  summarizeForDisplay,
  updateContact,
} from "../../../../db/contacts";
import { logAuditEvent } from "../../../../db/audit";

const patchSchema = z
  .object({
    mission_id: z.string().trim().min(1).max(120).nullable().optional(),
    email: z.string().trim().max(254).nullable().optional(),
    name: z.string().trim().max(200).nullable().optional(),
    company: z.string().trim().max(200).nullable().optional(),
    role: z.string().trim().max(200).nullable().optional(),
    source: z.enum([
      "manual",
      "import",
      "form",
      "referral",
      "outreach",
      "event",
      "api",
    ]).optional(),
    consent_given: z.boolean().optional(),
    qualification_signals: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{ contact_id: string }>;
};

/**
 * Single-contact endpoints.
 *
 * GET   — return the contact (redacted through `summarizeForDisplay`).
 * PATCH — update one or more editable fields (email, name, company, role,
 *         source, consent, mission association, qualification signals).
 *         Status transitions go through `contacts/[id]/status` — this route
 *         intentionally does not mutate `status` so the lifecycle stays a
 *         single, audited code path. Terminal-status contacts (converted,
 *         rejected, unsubscribed) cannot be edited.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { contact_id } = await context.params;
    const contact = await getContact(workspace.id, contact_id);
    if (!contact) {
      return Response.json({ error: "Contact not found." }, { status: 404 });
    }
    return Response.json({ contact: summarizeForDisplay(contact) });
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
          error instanceof Error ? error.message : "Contact unavailable.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { contact_id } = await context.params;

    const current = await getContact(workspace.id, contact_id);
    if (!current) {
      return Response.json({ error: "Contact not found." }, { status: 404 });
    }

    const input = patchSchema.parse(await request.json());
    const updated = await updateContact(workspace.id, contact_id, {
      mission_id: input.mission_id ?? undefined,
      email: input.email ?? undefined,
      name: input.name ?? undefined,
      company: input.company ?? undefined,
      role: input.role ?? undefined,
      source: input.source,
      consent_given: input.consent_given,
      qualification_signals: input.qualification_signals ?? undefined,
    });

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "contact.updated",
        resource_type: "contact",
        resource_id: contact_id,
        detail: {
          mission_id: updated.mission_id,
          patched_fields: Object.keys(input),
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ contact: summarizeForDisplay(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update contacts." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid contact update." },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Contact update failed.";
    const isInvalid = message.startsWith("Invalid contact");
    return Response.json(
      { error: message },
      { status: isInvalid ? 400 : 500 },
    );
  }
}

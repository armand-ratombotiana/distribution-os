import { z } from "zod";
import {
  getContact,
  summarizeForDisplay,
  updateContactStatus,
} from "../../../../../db/contacts";
import {
  ensureWorkspace,
  requireRequestIdentity,
} from "../../../../../db/workspaces";
import { logAuditEvent } from "../../../../../db/audit";

const patchSchema = z.object({
  status: z.enum([
    "new",
    "qualified",
    "contacted",
    "replied",
    "meeting",
    "converted",
    "rejected",
    "unsubscribed",
  ]),
  last_contacted_at: z.number().int().positive().optional(),
  converted_at: z.number().int().positive().optional(),
});

type RouteContext = {
  params: Promise<{ contact_id: string }>;
};

/**
 * Transition a contact to a new lifecycle status.
 *
 * The transition is validated against the contact lifecycle state machine
 * (`canTransition` in `contacts-pure`) — invalid transitions raise an error
 * that surfaces as a 409 to the client. Terminal statuses (`converted`,
 * `rejected`, `unsubscribed`) cannot be left once entered. Status-dependent
 * timestamps (`last_contacted_at` for `contacted`, `converted_at` for
 * `converted`) are stamped automatically by the db layer when the caller does
 * not supply them.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { contact_id } = await context.params;

    const current = await getContact(workspace.id, contact_id);
    if (!current) {
      return Response.json(
        { error: "Contact not found." },
        { status: 404 },
      );
    }

    const input = patchSchema.parse(await request.json());
    if (input.status === current.status) {
      return Response.json({ contact: summarizeForDisplay(current) });
    }

    const updated = await updateContactStatus(
      workspace.id,
      contact_id,
      input.status,
      {
        last_contacted_at: input.last_contacted_at,
        converted_at: input.converted_at,
      },
    );

    try {
      await logAuditEvent(workspace.id, {
        actor_user_id: workspace.owner_user_id,
        event_category: "action",
        event_type: "contact.status_changed",
        resource_type: "contact",
        resource_id: contact_id,
        detail: {
          mission_id: current.mission_id,
          previous_status: current.status,
          next_status: updated.status,
        },
      });
    } catch {
      // Audit logging must never break the primary operation.
    }

    return Response.json({ contact: summarizeForDisplay(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return Response.json(
        { error: "Sign in to update contact status." },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid contact status request." },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Contact status update failed.";
    const isTransitionError =
      message.includes("cannot transition") ||
      message.includes("terminal status") ||
      message.includes("Invalid contact");
    return Response.json(
      { error: message },
      { status: isTransitionError ? 409 : 500 },
    );
  }
}

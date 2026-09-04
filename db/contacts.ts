/**
 * D1 persistence layer for the `contacts` table.
 *
 * Tenant-isolated by `workspace_id`. Delegates validation, lifecycle and
 * display logic to `./contacts-pure`. IDs use `buildContactId` (which embeds
 * a timestamp and random suffix) and timestamps use `Date.now()`.
 */
import { getRawDb } from "./index";
import {
  buildContactId,
  canTransition,
  isTerminal,
  validateContact,
  type ContactRow,
} from "./contacts-pure";

export * from "./contacts-pure";

export type CreateContactInput = {
  mission_id?: string | null;
  email?: string | null;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  source: string;
  consent_given?: boolean;
  qualification_signals?: Record<string, unknown> | null;
};

export type ListContactsOptions = {
  mission_id?: string;
  status?: string;
  limit?: number;
};

export type UpdateContactStatusInput = {
  last_contacted_at?: number | null;
  converted_at?: number | null;
};

/**
 * Insert a new contact in the `new` status. The row is validated by the pure
 * helper (email format, signal JSON shape, required fields) before any SQL is
 * executed.
 */
export async function createContact(
  workspaceId: string,
  input: CreateContactInput,
): Promise<ContactRow> {
  const db = getRawDb();
  const now = Date.now();
  const id = buildContactId(input.company || input.source);
  const signalsJson = input.qualification_signals
    ? JSON.stringify(input.qualification_signals)
    : "{}";
  const row: ContactRow = {
    id,
    workspace_id: workspaceId,
    mission_id: input.mission_id ?? null,
    email: input.email ?? null,
    name: input.name ?? null,
    company: input.company ?? null,
    role: input.role ?? null,
    source: input.source,
    status: "new",
    consent_given: input.consent_given ? 1 : 0,
    qualification_signals_json: signalsJson,
    last_contacted_at: null,
    converted_at: null,
    created_at: now,
    updated_at: now,
  };
  const validation = validateContact(row);
  if (!validation.valid) {
    throw new Error(`Invalid contact: ${validation.errors.join("; ")}`);
  }

  await db
    .prepare(
      "INSERT INTO contacts (id, workspace_id, mission_id, email, name, company, role, source, status, consent_given, qualification_signals_json, last_contacted_at, converted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.workspace_id,
      row.mission_id,
      row.email,
      row.name,
      row.company,
      row.role,
      row.source,
      row.status,
      row.consent_given,
      row.qualification_signals_json,
      row.last_contacted_at,
      row.converted_at,
      row.created_at,
      row.updated_at,
    )
    .run();

  const persisted = await getContact(workspaceId, id);
  if (!persisted) {
    throw new Error("Failed to create contact");
  }
  return persisted;
}

/**
 * List contacts for a workspace, optionally filtered by mission and/or status.
 * Ordered by `created_at DESC`, capped at `limit` (default 50, max 200).
 */
export async function listContacts(
  workspaceId: string,
  opts: ListContactsOptions = {},
): Promise<ContactRow[]> {
  const db = getRawDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  if (opts.mission_id && opts.status) {
    const result = await db
      .prepare(
        "SELECT * FROM contacts WHERE workspace_id = ? AND mission_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, opts.status, limit)
      .all<ContactRow>();
    return result.results;
  }
  if (opts.mission_id) {
    const result = await db
      .prepare(
        "SELECT * FROM contacts WHERE workspace_id = ? AND mission_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.mission_id, limit)
      .all<ContactRow>();
    return result.results;
  }
  if (opts.status) {
    const result = await db
      .prepare(
        "SELECT * FROM contacts WHERE workspace_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(workspaceId, opts.status, limit)
      .all<ContactRow>();
    return result.results;
  }
  const result = await db
    .prepare(
      "SELECT * FROM contacts WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all<ContactRow>();
  return result.results;
}

/** Fetch a single contact by id within a workspace. */
export async function getContact(
  workspaceId: string,
  contactId: string,
): Promise<ContactRow | null> {
  const db = getRawDb();
  return db
    .prepare("SELECT * FROM contacts WHERE workspace_id = ? AND id = ? LIMIT 1")
    .bind(workspaceId, contactId)
    .first<ContactRow>();
}

/**
 * Transition a contact to a new status. Refuses the transition when the
 * contact lifecycle (`canTransition`) does not permit it, and refuses to move
 * a terminal-status contact. Status-dependent timestamps (`last_contacted_at`
 * for `contacted`, `converted_at` for `converted`) are stamped automatically
 * when the caller does not supply them.
 */
export async function updateContactStatus(
  workspaceId: string,
  contactId: string,
  newStatus: string,
  opts: UpdateContactStatusInput = {},
): Promise<ContactRow> {
  const db = getRawDb();
  const current = await getContact(workspaceId, contactId);
  if (!current) {
    throw new Error(`Contact not found: ${contactId}`);
  }
  if (isTerminal(current.status)) {
    throw new Error(
      `Contact ${contactId} is in terminal status ${current.status}`,
    );
  }
  if (!canTransition(current.status, newStatus)) {
    throw new Error(
      `Contact ${contactId} cannot transition from ${current.status} to ${newStatus}`,
    );
  }
  const now = Date.now();
  const lastContactedAt =
    opts.last_contacted_at !== undefined
      ? opts.last_contacted_at
      : newStatus === "contacted" && current.last_contacted_at === null
        ? now
        : current.last_contacted_at;
  const convertedAt =
    opts.converted_at !== undefined
      ? opts.converted_at
      : newStatus === "converted" && current.converted_at === null
        ? now
        : current.converted_at;

  await db
    .prepare(
      "UPDATE contacts SET status = ?, last_contacted_at = ?, converted_at = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
    )
    .bind(
      newStatus,
      lastContactedAt,
      convertedAt,
      now,
      workspaceId,
      contactId,
    )
    .run();

  const updated = await getContact(workspaceId, contactId);
  if (!updated) {
    throw new Error(`Contact disappeared after update: ${contactId}`);
  }
  return updated;
}

import { CONTACT_STATUSES } from "./schema";

/**
 * Pure, dependency-free helpers for the `contacts` table.
 *
 * These helpers encode the outreach lifecycle, email validation and the
 * privacy-preserving redaction rules for qualification signals.
 */

export type ContactSource =
  | "manual"
  | "import"
  | "form"
  | "referral"
  | "outreach"
  | "event"
  | "api";

export type ContactRow = {
  id: string;
  workspace_id: string;
  mission_id: string | null;
  email: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  source: string;
  status: string;
  consent_given: number; // 0/1 boolean stored as integer
  qualification_signals_json: string;
  last_contacted_at: number | null;
  converted_at: number | null;
  created_at: number;
  updated_at: number;
};

export type ContactValidationResult = {
  valid: boolean;
  errors: string[];
};

export type QualificationSignals = Record<string, unknown>;

/**
 * Allowed forward transitions for a contact lifecycle.
 *
 * `converted`, `rejected` and `unsubscribed` are terminal — once a contact
 * reaches one of these states the lifecycle cannot be restarted through this
 * state machine (a fresh contact row should be created instead).
 */
export const CONTACT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  new: ["qualified", "contacted", "rejected"],
  qualified: ["contacted", "rejected"],
  contacted: ["replied", "rejected", "qualified"],
  replied: ["meeting", "converted", "rejected"],
  meeting: ["converted", "rejected"],
  converted: [],
  rejected: [],
  unsubscribed: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = CONTACT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function isTerminal(status: string): boolean {
  const allowed = CONTACT_TRANSITIONS[status];
  if (!allowed) return false;
  return allowed.length === 0;
}

// RFC-5322 simplified practical email regex — good enough for the operating
// system's validation layer without pulling in a heavyweight dependency.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (email.length > 254) return false;
  if (email.length < 5) return false;
  return EMAIL_RE.test(email);
}

export function validateContact(row: Partial<ContactRow>): ContactValidationResult {
  const errors: string[] = [];

  if (!row.workspace_id || row.workspace_id.trim() === "") {
    errors.push("workspace_id is required");
  }
  if (!row.source || row.source.trim() === "") {
    errors.push("source is required");
  }
  if (row.status && !CONTACT_STATUSES.includes(row.status as (typeof CONTACT_STATUSES)[number])) {
    errors.push(`status must be one of: ${CONTACT_STATUSES.join(", ")}`);
  }
  if (row.email !== null && row.email !== undefined && row.email !== "") {
    if (!validateEmail(row.email)) {
      errors.push("email must be a valid email address");
    }
  }
  if (row.status === "converted" && (!row.converted_at || row.converted_at <= 0)) {
    errors.push("converted_at is required when status is converted");
  }
  if (row.status === "contacted" && (!row.last_contacted_at || row.last_contacted_at <= 0)) {
    errors.push("last_contacted_at is required when status is contacted");
  }
  if (row.qualification_signals_json !== undefined && row.qualification_signals_json !== null) {
    try {
      const parsed = JSON.parse(row.qualification_signals_json);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        errors.push("qualification_signals_json must be a JSON object");
      }
    } catch {
      errors.push("qualification_signals_json must be valid JSON");
    }
  }
  if (row.name && row.name.length > 200) {
    errors.push("name must be 200 characters or less");
  }
  if (row.company && row.company.length > 200) {
    errors.push("company must be 200 characters or less");
  }

  return { valid: errors.length === 0, errors };
}

export type ContactSummary = {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  role: string | null;
  source: string;
  status: string;
  consent_given: boolean;
  /** Always redacted — qualification signals may contain PII / sensitive inferences. */
  qualification_signals: "redacted";
  signal_count: number;
  last_contacted_at: number | null;
  converted_at: number | null;
  is_terminal: boolean;
};

export function summarizeForDisplay(row: ContactRow): ContactSummary {
  let signalCount = 0;
  try {
    const parsed = JSON.parse(row.qualification_signals_json || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      signalCount = Object.keys(parsed).length;
    }
  } catch {
    signalCount = 0;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    company: row.company,
    role: row.role,
    source: row.source,
    status: row.status,
    consent_given: Boolean(row.consent_given),
    qualification_signals: "redacted",
    signal_count: signalCount,
    last_contacted_at: row.last_contacted_at,
    converted_at: row.converted_at,
    is_terminal: isTerminal(row.status),
  };
}

/**
 * Build a stable, URL-safe contact id.
 *
 * Prefixed with `contact_`, contains only `[a-z0-9_]` and optionally embeds
 * a sanitized seed (e.g. company slug or source channel).
 */
export function buildContactId(seed?: string): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const safeSeed = (seed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return safeSeed ? `contact_${time}_${rand}_${safeSeed}` : `contact_${time}_${rand}`;
}

/**
 * Safely parse `qualification_signals_json` into a plain object.
 *
 * Returns an empty object on invalid input or when the JSON does not decode
 * to a JSON object (arrays / scalars are rejected).
 */
export function parseQualificationSignals(json: string | null | undefined): QualificationSignals {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as QualificationSignals;
    }
  } catch {
    /* fall through */
  }
  return {};
}

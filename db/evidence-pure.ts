import { EVIDENCE_STATES, EVIDENCE_SOURCE_TYPES } from "./schema";

type EvidenceState = (typeof EVIDENCE_STATES)[number];
type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export type EvidenceRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  source_url: string | null;
  source_type: EvidenceSourceType;
  content_hash: string;
  parser_version: string;
  title: string;
  summary: string;
  extracted_facts_json: string;
  provenance_json: string;
  state: EvidenceState;
  contradiction_of_id: string | null;
  created_at: number;
  updated_at: number;
};

export const EVIDENCE_TRANSITIONS: Record<EvidenceState, EvidenceState[]> = {
  observed: ["inferred", "verified", "contradicted", "stale", "rejected"],
  inferred: ["verified", "contradicted", "rejected", "stale"],
  needed: ["observed", "rejected"],
  verified: ["stale", "contradicted"],
  contradicted: ["verified", "stale"],
  stale: ["observed", "rejected"],
  rejected: [],
};

export function canTransition(from: EvidenceState, to: EvidenceState): boolean {
  const allowed = EVIDENCE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function isTerminal(state: EvidenceState): boolean {
  const allowed = EVIDENCE_TRANSITIONS[state];
  return Array.isArray(allowed) && allowed.length === 0;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`)
    .join(",")}}`;
}

export async function hashContent(content: unknown): Promise<string> {
  const text = typeof content === "string" ? content : canonicalJson(content);
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function summarizeForDisplay(
  row: EvidenceRow
): Record<string, unknown> {
  return {
    ...row,
    workspace_id: "[redacted]",
    extracted_facts_json: "[redacted]",
    provenance_json: "[redacted]",
  };
}

export function buildEvidenceId(args: {
  workspaceId: string;
  missionId: string;
  contentHash: string;
}): string {
  return `ev_${args.workspaceId}_${args.missionId}_${args.contentHash}`;
}

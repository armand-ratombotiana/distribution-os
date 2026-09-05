import { z } from "zod";

import { shouldBlockContent } from "./brand-safety-pure";
import {
  isClaimForbidden,
  isQuietHours,
  isWithinBudget,
  type WorkspaceSettingsRow,
} from "../db/workspace-settings-pure";

export const resendEmailPayloadSchema = z
  .object({
    provider: z.literal("resend"),
    from: z.string().trim().min(3).max(320),
    to: z.array(z.string().trim().email().max(254)).length(1),
    subject: z.string().trim().min(1).max(200),
    text: z.string().trim().min(1).max(20_000),
    reply_to: z.string().trim().email().max(254).optional(),
    projected_cost_cents: z.number().int().min(0).max(100_000).default(0),
  })
  .strict();

export type ResendEmailPayload = z.infer<typeof resendEmailPayloadSchema>;

export type ResendConfiguration = {
  apiKey?: string;
  fromEmail?: string;
  workspaceId?: string;
  allowedRecipients?: string;
};

export type ExecutionPolicyInput = {
  payload: ResendEmailPayload;
  settings: WorkspaceSettingsRow;
  workspaceId: string;
  currentHour: number;
  actionsToday: number;
  configuration: ResendConfiguration;
  connectorInstalled: boolean;
};

export type ExecutionPolicyResult =
  | { allowed: true; recipients: string[] }
  | { allowed: false; code: string; reason: string };

export function hourInTimezone(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Could not determine local hour for ${timezone}`);
  }
  return hour;
}

export function parseRecipientAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

export function evaluateResendExecutionPolicy(
  input: ExecutionPolicyInput,
): ExecutionPolicyResult {
  const { configuration, payload, settings } = input;
  if (!input.connectorInstalled) {
    return { allowed: false, code: "connector_required", reason: "Request the Resend connector before execution." };
  }
  if (!configuration.apiKey || !configuration.fromEmail || !configuration.workspaceId) {
    return { allowed: false, code: "connector_unconfigured", reason: "The Resend adapter is not configured on the server." };
  }
  if (configuration.workspaceId !== input.workspaceId) {
    return { allowed: false, code: "tenant_not_enabled", reason: "The Resend adapter is not enabled for this workspace." };
  }
  if (payload.from !== configuration.fromEmail) {
    return { allowed: false, code: "sender_not_allowed", reason: "The approved sender does not match the configured Resend sender." };
  }
  const allowlist = parseRecipientAllowlist(configuration.allowedRecipients);
  if (allowlist.length === 0) {
    return { allowed: false, code: "recipient_allowlist_missing", reason: "No Resend recipient allowlist is configured." };
  }
  const recipients = payload.to.map((recipient) => recipient.toLowerCase());
  if (recipients.some((recipient) => !allowlist.includes(recipient))) {
    return { allowed: false, code: "recipient_not_allowed", reason: "The approved recipient is outside the configured sandbox allowlist." };
  }
  if (isQuietHours(input.currentHour, settings.quiet_hours_start, settings.quiet_hours_end)) {
    return { allowed: false, code: "quiet_hours", reason: `Outbound email is blocked during workspace quiet hours (${settings.timezone}).` };
  }
  if (input.actionsToday >= settings.max_daily_actions) {
    return { allowed: false, code: "daily_action_limit", reason: "The workspace daily action limit has been reached." };
  }
  for (const scope of ["per_action", "daily", "monthly"] as const) {
    if (!isWithinBudget(settings, payload.projected_cost_cents, scope)) {
      return { allowed: false, code: `${scope}_budget`, reason: `The projected cost exceeds the workspace ${scope.replace("_", " ")} budget.` };
    }
  }
  const copy = `${payload.subject}\n${payload.text}`;
  if (shouldBlockContent(copy) || isClaimForbidden(copy, settings.forbidden_claims_json)) {
    return { allowed: false, code: "forbidden_claim", reason: "The approved email contains a forbidden or unsupported claim." };
  }
  return { allowed: true, recipients };
}

export function buildResendIdempotencyKey(actionId: string, payloadHash: string): string {
  return `distribution-os/${actionId}/${payloadHash.slice(0, 32)}`;
}

export function buildResendRequest(payload: ResendEmailPayload): Record<string, unknown> {
  return {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    ...(payload.reply_to ? { reply_to: payload.reply_to } : {}),
  };
}

export type ResendSendResult =
  | { outcome: "confirmed"; providerRequestId: string; receipt: Record<string, unknown> }
  | { outcome: "definitive_failure"; status: number; code: string; message: string; receipt: Record<string, unknown> }
  | { outcome: "ambiguous_failure"; status?: number; code: string; message: string; receipt: Record<string, unknown> };

function responseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function sendWithResend(args: {
  apiKey: string;
  idempotencyKey: string;
  payload: ResendEmailPayload;
  fetchImpl?: typeof fetch;
}): Promise<ResendSendResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.idempotencyKey,
      },
      body: JSON.stringify(buildResendRequest(args.payload)),
    });
    const raw = (await response.text()).slice(0, 8_000);
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { raw };
    }
    const receipt = responseRecord(parsed);
    const providerRequestId = typeof receipt.id === "string" ? receipt.id : "";
    if (response.ok && providerRequestId) {
      return { outcome: "confirmed", providerRequestId, receipt };
    }
    const code = typeof receipt.name === "string" ? receipt.name : `http_${response.status}`;
    const message = typeof receipt.message === "string" ? receipt.message : "Resend did not confirm the email request.";
    if (response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status)) {
      return { outcome: "definitive_failure", status: response.status, code, message, receipt };
    }
    return { outcome: "ambiguous_failure", status: response.status, code, message, receipt };
  } catch (error) {
    return {
      outcome: "ambiguous_failure",
      code: "network_error",
      message: error instanceof Error ? error.message : "Resend request failed without a response.",
      receipt: {},
    };
  }
}

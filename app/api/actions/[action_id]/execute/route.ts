import { env } from "cloudflare:workers";

import { claimExecutionAttempt, finishExecutionAttempt, markAttemptSubmitting, summarizeExecutionAttempt } from "../../../../../db/action-execution-attempts";
import { getAction, hashPayload, summarizeForDisplay, type ActionRow } from "../../../../../db/actions";
import { logAuditEvent } from "../../../../../db/audit";
import { buildConnectorId, type ConnectorInstallationRow } from "../../../../../db/connectors-pure";
import { getInstallation, updateHealth, updateInstallationStatus } from "../../../../../db/connector-installations";
import { getRawDb } from "../../../../../db/index";
import { getOrCreateSettings } from "../../../../../db/workspace-settings";
import { ensureWorkspace, requireRequestIdentity } from "../../../../../db/workspaces";
import { buildResendIdempotencyKey, evaluateResendExecutionPolicy, hourInTimezone, resendEmailPayloadSchema, sendWithResend, type ResendConfiguration } from "../../../../../lib/resend-email";

type RouteContext = { params: Promise<{ action_id: string }> };
type RuntimeEnv = { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; RESEND_WORKSPACE_ID?: string; RESEND_ALLOWED_RECIPIENTS?: string };
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

export async function POST(request: Request, context: RouteContext) {
  try {
    const workspace = await ensureWorkspace(requireRequestIdentity(request));
    const { action_id } = await context.params;
    const action = await getAction(workspace.id, action_id);
    if (!action) return Response.json({ error: "Action not found." }, { status: 404 });
    if (action.status === "executed") return Response.json({ action: summarizeForDisplay(action), executed: true, idempotent: true });
    if (action.status !== "approved") return Response.json({ error: `Action cannot be executed from status '${action.status}'.` }, { status: 400 });
    if (action.expires_at <= Date.now()) {
      await getRawDb().prepare("UPDATE action_queue SET status = 'expired', updated_at = ? WHERE id = ? AND workspace_id = ? AND status = 'approved'").bind(Date.now(), action.id, workspace.id).run();
      return Response.json({ error: "Action approval expired before execution." }, { status: 409 });
    }
    if (action.channel !== "email" || action.action_type !== "send_email") {
      return Response.json({ error: "No real provider adapter is installed for this action type." }, { status: 501 });
    }

    let rawPayload: unknown;
    try { rawPayload = JSON.parse(action.payload_json); } catch { rawPayload = null; }
    const parsedPayload = resendEmailPayloadSchema.safeParse(rawPayload);
    if (!parsedPayload.success) return Response.json({ error: "The approved email payload is invalid and cannot be executed." }, { status: 422 });
    const expectedHash = await hashPayload({ action_type: action.action_type, channel: action.channel, title: action.title, summary: action.summary, payload: parsedPayload.data });
    if (expectedHash !== action.payload_hash) return Response.json({ error: "The approved payload no longer matches its immutable hash." }, { status: 409 });

    const runtime = env as unknown as RuntimeEnv;
    const configuration: ResendConfiguration = { apiKey: runtime.RESEND_API_KEY?.trim(), fromEmail: runtime.RESEND_FROM_EMAIL?.trim(), workspaceId: runtime.RESEND_WORKSPACE_ID?.trim(), allowedRecipients: runtime.RESEND_ALLOWED_RECIPIENTS };
    const connectorId = buildConnectorId({ workspaceId: workspace.id, provider: "Resend" });
    const connector = await getInstallation(workspace.id, connectorId);
    const settings = await getOrCreateSettings(workspace.id);
    const daily = await getRawDb().prepare("SELECT COALESCE(SUM(attempt_count), 0) AS count FROM action_execution_attempts WHERE workspace_id = ? AND created_at >= ?").bind(workspace.id, Date.now() - 86_400_000).first<{ count: number }>();
    const policy = evaluateResendExecutionPolicy({ payload: parsedPayload.data, settings, workspaceId: workspace.id, currentHour: hourInTimezone(new Date(), settings.timezone), actionsToday: Number(daily?.count ?? 0), configuration, connectorInstalled: Boolean(connector) });
    if (!policy.allowed) {
      await auditBlocked(workspace.id, workspace.owner_user_id, action, policy.code, policy.reason);
      return Response.json({ error: policy.reason, code: policy.code, executed: false }, { status: 409 });
    }

    const activeConnector = await prepareConnector(workspace.id, connector!);
    const idempotencyKey = buildResendIdempotencyKey(action.id, action.payload_hash);
    const claimed = await claimExecutionAttempt({ workspaceId: workspace.id, missionId: action.mission_id, actionId: action.id, provider: "resend", idempotencyKey, payloadHash: action.payload_hash });
    if (claimed.attempt.payload_hash !== action.payload_hash || claimed.attempt.action_id !== action.id) return Response.json({ error: "Execution idempotency record conflicts with this payload." }, { status: 409 });
    if (claimed.attempt.status === "succeeded") {
      const updated = await persistConfirmedExecution(action, claimed.attempt.provider_request_id!, claimed.attempt.receipt_json ?? "{}", parsedPayload.data.projected_cost_cents);
      return Response.json({ action: summarizeForDisplay(updated), attempt: summarizeExecutionAttempt(claimed.attempt), executed: true, idempotent: true });
    }
    if (claimed.attempt.status === "submitting") return Response.json({ error: "This exact email is already being submitted.", attempt: summarizeExecutionAttempt(claimed.attempt) }, { status: 409 });
    if (!claimed.created && Date.now() - claimed.attempt.created_at > RETRY_WINDOW_MS) {
      await getRawDb().prepare("UPDATE action_queue SET status = 'blocked', blocker = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'approved'").bind("The provider result is unresolved and its safe retry window expired.", Date.now(), workspace.id, action.id).run();
      return Response.json({ error: "The provider result is unresolved and its safe retry window expired." }, { status: 409 });
    }
    const submitted = await markAttemptSubmitting(workspace.id, claimed.attempt.id, [claimed.attempt.status]);
    if (!submitted) return Response.json({ error: "Another execution request claimed this action first." }, { status: 409 });

    const result = await sendWithResend({ apiKey: configuration.apiKey!, idempotencyKey, payload: parsedPayload.data });
    if (result.outcome === "confirmed") {
      const attempt = await finishExecutionAttempt({ workspaceId: workspace.id, attemptId: claimed.attempt.id, status: "succeeded", providerRequestId: result.providerRequestId, receipt: result.receipt });
      const updated = await persistConfirmedExecution(action, result.providerRequestId, JSON.stringify(result.receipt), parsedPayload.data.projected_cost_cents);
      await markConnectorHealthy(workspace.id, activeConnector);
      await auditResult(workspace.id, workspace.owner_user_id, action, "action.executed", attempt.id, result.providerRequestId);
      return Response.json({ action: summarizeForDisplay(updated), attempt: summarizeExecutionAttempt(attempt), executed: true });
    }

    const definitive = result.outcome === "definitive_failure";
    const attempt = await finishExecutionAttempt({ workspaceId: workspace.id, attemptId: claimed.attempt.id, status: definitive ? "failed" : "unknown", receipt: result.receipt, errorCode: result.code, errorMessage: result.message });
    await persistFailedExecution(action, definitive, result.code, result.message, result.receipt);
    await markConnectorFailure(workspace.id, activeConnector, definitive, result.message);
    await auditResult(workspace.id, workspace.owner_user_id, action, definitive ? "action.execution_failed" : "action.execution_unknown", attempt.id, null);
    return Response.json({ error: definitive ? "Resend rejected the email." : "Resend did not return a definitive result. A safe retry remains available for 23 hours.", attempt: summarizeExecutionAttempt(attempt), executed: false }, { status: definitive ? 422 : 502 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return Response.json({ error: "Sign in to execute actions." }, { status: 401 });
    return Response.json({ error: error instanceof Error ? error.message : "Action could not be executed." }, { status: 500 });
  }
}

async function prepareConnector(workspaceId: string, connector: ConnectorInstallationRow) {
  let current = connector;
  if (current.status === "setup_required" || current.status === "error") current = await updateInstallationStatus(workspaceId, current.id, "authorized");
  if (current.status === "authorized") current = await updateInstallationStatus(workspaceId, current.id, "connected");
  if (!["connected", "healthy", "degraded"].includes(current.status)) throw new Error(`Resend connector cannot execute from status '${current.status}'.`);
  return current;
}

async function markConnectorHealthy(workspaceId: string, connector: ConnectorInstallationRow) {
  if (connector.status === "connected" || connector.status === "degraded") return updateHealth(workspaceId, connector.id, { status: "healthy", last_error: null });
  return updateHealth(workspaceId, connector.id, { last_error: null });
}

async function markConnectorFailure(workspaceId: string, connector: ConnectorInstallationRow, definitive: boolean, message: string) {
  const status = definitive ? "error" : (connector.status === "connected" || connector.status === "healthy") ? "degraded" : undefined;
  try { await updateHealth(workspaceId, connector.id, { status, last_error: message.slice(0, 500) }); } catch {}
}

async function persistConfirmedExecution(action: ActionRow, providerRequestId: string, receiptJson: string, costCents: number) {
  const db = getRawDb();
  const now = Date.now();
  await db.batch([
    db.prepare("UPDATE workspace_settings SET monthly_spent_cents = monthly_spent_cents + ?, daily_spent_cents = daily_spent_cents + ?, updated_at = ? WHERE workspace_id = ? AND EXISTS (SELECT 1 FROM action_queue WHERE workspace_id = ? AND id = ? AND status = 'approved')").bind(costCents, costCents, now, action.workspace_id, action.workspace_id, action.id),
    db.prepare("UPDATE action_queue SET status = 'executed', blocker = NULL, provider_result_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'approved'").bind(receiptJson, now, action.workspace_id, action.id),
    db.prepare("INSERT OR IGNORE INTO touchpoints (id, workspace_id, mission_id, action_id, experiment_id, channel, event_type, occurred_at, received_at, provider_event_id, raw_event_json, created_at) VALUES (?, ?, ?, ?, NULL, 'email', 'provider_accepted', ?, ?, ?, ?, ?)").bind(`tp_provider_${action.id}`, action.workspace_id, action.mission_id, action.id, now, now, providerRequestId, receiptJson, now),
    db.prepare("INSERT OR IGNORE INTO evidence (id, workspace_id, mission_id, source_url, source_type, content_hash, parser_version, title, summary, extracted_facts_json, provenance_json, state, contradiction_of_id, created_at, updated_at) VALUES (?, ?, ?, NULL, 'provider_receipt', ?, '1.0', 'Resend accepted email', 'The provider accepted the exact approved email payload; delivery is not yet proven.', ?, ?, 'observed', NULL, ?, ?)").bind(`ev_provider_${action.id}`, action.workspace_id, action.mission_id, action.payload_hash, JSON.stringify({ provider_request_id: providerRequestId, event: "provider_accepted" }), JSON.stringify({ provider: "resend", action_id: action.id }), now, now),
    db.prepare("INSERT INTO mission_events (mission_id, event_type, title, detail, actor, created_at) SELECT ?, 'execution', 'Approved email submitted', ?, 'Resend adapter', ? WHERE NOT EXISTS (SELECT 1 FROM mission_events WHERE mission_id = ? AND event_type = 'execution' AND detail = ?)").bind(action.mission_id, `Resend accepted action ${action.id}. Delivery remains unverified.`, now, action.mission_id, `Resend accepted action ${action.id}. Delivery remains unverified.`),
  ]);
  return (await getAction(action.workspace_id, action.id))!;
}

async function persistFailedExecution(action: ActionRow, definitive: boolean, code: string, message: string, receipt: Record<string, unknown>) {
  await getRawDb().prepare(`UPDATE action_queue SET status = ${definitive ? "'failed'" : "status"}, blocker = ?, provider_result_json = ?, updated_at = ? WHERE workspace_id = ? AND id = ? AND status = 'approved'`).bind(`${code}: ${message}`.slice(0, 500), JSON.stringify(receipt), Date.now(), action.workspace_id, action.id).run();
}

async function auditBlocked(workspaceId: string, actor: string, action: ActionRow, code: string, reason: string) {
  try { await logAuditEvent(workspaceId, { actor_user_id: actor, event_category: "action", event_type: "action.execution_blocked", action_id: action.id, resource_type: "action", resource_id: action.id, detail: { mission_id: action.mission_id, code, reason } }); } catch {}
}

async function auditResult(workspaceId: string, actor: string, action: ActionRow, eventType: string, attemptId: string, providerRequestId: string | null) {
  try { await logAuditEvent(workspaceId, { actor_user_id: actor, event_category: "action", event_type: eventType, action_id: action.id, resource_type: "execution_attempt", resource_id: attemptId, detail: { mission_id: action.mission_id, provider: "resend", provider_request_id: providerRequestId } }); } catch {}
}

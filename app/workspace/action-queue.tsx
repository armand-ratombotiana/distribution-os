"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  Clock,
  LoaderCircle,
  Plus,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ActionStatus =
  | "prepared"
  | "approved"
  | "rejected"
  | "blocked"
  | "expired"
  | "executed"
  | "failed";

type ActionRisk = "low" | "medium" | "high";

type ActionSummary = {
  id: string;
  mission_id: string;
  action_type: string;
  channel: string;
  title: string;
  summary: string;
  risk: ActionRisk;
  status: ActionStatus;
  blocker: string | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
  payload_hash: string;
};

type ActionsResponse = { actions?: ActionSummary[]; error?: string };
type ActionDetail = ActionSummary & {
  payload: Record<string, unknown> | null;
  decided_by: string | null;
  decided_at: number | null;
};
type ExecutionAttempt = {
  status: "claimed" | "submitting" | "succeeded" | "failed" | "unknown";
  attempt_count: number;
  provider_request_id: string | null;
  error_code: string | null;
  error_message: string | null;
  receipt: Record<string, unknown> | null;
};
type ActionResponse = { action?: ActionSummary; attempt?: ExecutionAttempt | null; error?: string };
type ActionDetailResponse = { action?: ActionDetail; attempt?: ExecutionAttempt | null; error?: string };

const statusLabel: Record<ActionStatus, string> = {
  prepared: "Prepared",
  approved: "Approved",
  rejected: "Rejected",
  blocked: "Blocked",
  expired: "Expired",
  executed: "Executed",
  failed: "Failed",
};

export function ActionQueue({ missionId }: { missionId: string }) {
  const [actions, setActions] = useState<ActionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [reviewed, setReviewed] = useState<Record<string, ActionDetailResponse>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/actions`);
        const data = (await response.json()) as ActionsResponse;
        if (cancelled) return;
        if (response.ok && data.actions) {
          setActions(data.actions);
        } else {
          setError(data.error || "Failed to load actions");
        }
      } catch {
        if (!cancelled) setError("Network error while loading actions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [missionId]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(`/api/missions/${missionId}/actions`);
      const data = (await response.json()) as ActionsResponse;
      if (response.ok && data.actions) setActions(data.actions);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from.trim() || !to.trim() || !subject.trim() || !text.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${missionId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "send_email",
          channel: "email",
          title: `Send email: ${subject.trim()}`,
          summary: `Transactional email to ${to.trim()}`,
          payload: {
            provider: "resend",
            from: from.trim(),
            to: [to.trim()],
            subject: subject.trim(),
            text: text.trim(),
            projected_cost_cents: 0,
          },
        }),
      });
      const data = (await response.json()) as ActionResponse;
      if (!response.ok || !data.action) {
        throw new Error(data.error || "Action creation failed");
      }
      setTo("");
      setSubject("");
      setText("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function review(actionId: string) {
    setReviewing(actionId);
    setError("");
    try {
      const response = await fetch(`/api/actions/${actionId}`);
      const data = (await response.json()) as ActionDetailResponse;
      if (!response.ok || !data.action) throw new Error(data.error || "Action detail failed");
      setReviewed((current) => ({ ...current, [actionId]: data }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action detail failed");
    } finally {
      setReviewing(null);
    }
  }

  async function transition(actionId: string, status: ActionStatus) {
    const endpoint =
      status === "approved"
        ? "approve"
        : status === "rejected"
          ? "reject"
          : status === "executed"
            ? "execute"
            : null;
    if (!endpoint) return;
    setError("");
    try {
      const response = await fetch(`/api/actions/${actionId}/${endpoint}`, {
        method: "POST",
        headers: status === "approved" ? { "Content-Type": "application/json" } : undefined,
        body: status === "approved"
          ? JSON.stringify({ payload_hash: reviewed[actionId]?.action?.payload_hash })
          : undefined,
      });
      const data = (await response.json()) as ActionResponse;
      if (!response.ok) throw new Error(data.error || `Action ${endpoint} failed`);
      await reload();
      await review(actionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action transition failed");
    }
  }

  return (
    <section className="ws-panel workspace-action-queue">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <ShieldCheck /> Action queue
          </p>
          <h2>Human-in-the-loop execution gate</h2>
          <p className="ws-panel-lede">
            This slice sends one exact, approved transactional email through
            Resend. Other channels remain fail-closed.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <Input
          aria-label="From address"
          type="email"
          placeholder="Configured Resend sender"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          required
        />
        <Input
          aria-label="Recipient"
          type="email"
          placeholder="Sandbox allowlisted recipient"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          required
        />
        <Input
          aria-label="Email subject"
          placeholder="Exact subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
        />
        <Textarea
          aria-label="Email body"
          placeholder="Exact plain-text body"
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
        />
        <div className="ws-form-row">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus />
            )}
            Prepare exact email
          </Button>
        </div>
      </form>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading actions…
        </div>
      ) : actions.length === 0 ? (
        <div className="ws-empty">
          <ShieldCheck /> No actions queued. Prepare one above to start the gate.
        </div>
      ) : (
        <div className="ws-cards">
          {actions.map((action) => (
            <article key={action.id} className="ws-card action-card">
              <header>
                <span className={`action-status-pill action-status-${action.status}`}>
                  {statusLabel[action.status]}
                </span>
                <span className="ws-meta">{action.channel}</span>
              </header>
              <h3>{action.title}</h3>
              <p>{action.summary}</p>
              {action.blocker && <p className="ws-error"><CircleAlert /> {action.blocker}</p>}
              {reviewed[action.id]?.action && (
                <div className="action-payload-review">
                  <strong>Immutable payload</strong>
                  <pre>{JSON.stringify(reviewed[action.id].action!.payload, null, 2)}</pre>
                  <small>SHA-256 {action.payload_hash}</small>
                  {reviewed[action.id].attempt && (
                    <p className="ws-meta">
                      Attempt: {reviewed[action.id].attempt!.status} · {reviewed[action.id].attempt!.attempt_count} request(s)
                      {reviewed[action.id].attempt!.provider_request_id ? ` · receipt ${reviewed[action.id].attempt!.provider_request_id}` : ""}
                      {reviewed[action.id].attempt!.error_message ? ` · ${reviewed[action.id].attempt!.error_message}` : ""}
                    </p>
                  )}
                </div>
              )}
              <footer className="ws-card-foot">
                <small>
                  <Clock /> Expires {new Date(action.expires_at).toLocaleString()}
                </small>
                <small className={`action-risk action-risk-${action.risk}`}>
                  {action.risk} risk
                </small>
              </footer>
              <div className="ws-card-actions">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void review(action.id)}
                  disabled={reviewing === action.id}
                >
                  {reviewing === action.id ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Review exact payload
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void transition(action.id, "approved")}
                  disabled={action.status !== "prepared" || !reviewed[action.id]?.action}
                >
                  <Check /> Approve
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void transition(action.id, "rejected")}
                  disabled={action.status !== "prepared"}
                >
                  <X /> Reject
                </Button>
                <Button
                  size="xs"
                  onClick={() => void transition(action.id, "executed")}
                  disabled={action.status !== "approved" || !reviewed[action.id]?.action}
                >
                  <Play /> Execute
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

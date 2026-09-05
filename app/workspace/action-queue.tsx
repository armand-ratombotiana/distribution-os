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
type ActionResponse = { action?: ActionSummary; error?: string };

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
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [channel, setChannel] = useState("email");
  const [actionType, setActionType] = useState("send_message");

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
    if (!title.trim() || !summary.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${missionId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: actionType.trim(),
          channel: channel.trim(),
          title: title.trim(),
          summary: summary.trim(),
        }),
      });
      const data = (await response.json()) as ActionResponse;
      if (!response.ok || !data.action) {
        throw new Error(data.error || "Action creation failed");
      }
      setTitle("");
      setSummary("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action creation failed");
    } finally {
      setSubmitting(false);
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
      });
      const data = (await response.json()) as ActionResponse;
      if (!response.ok) throw new Error(data.error || `Action ${endpoint} failed`);
      await reload();
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
            Every external action starts as <em>prepared</em>. Approve, reject or
            execute — the queue retains the full state trail.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <Input
          aria-label="Action title"
          placeholder="Action title (e.g. Send first-touch email)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Input
          aria-label="Action summary"
          placeholder="Short summary of what the agent will do"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
        />
        <div className="ws-form-row">
          <Input
            aria-label="Channel"
            placeholder="channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          />
          <Input
            aria-label="Action type"
            placeholder="action_type"
            value={actionType}
            onChange={(event) => setActionType(event.target.value)}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus />
            )}
            Queue action
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
                  onClick={() => void transition(action.id, "approved")}
                  disabled={action.status !== "prepared"}
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
                  disabled={action.status !== "approved"}
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

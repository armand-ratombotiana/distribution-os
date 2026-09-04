"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

export type AuditCategory =
  | "auth"
  | "role"
  | "approval"
  | "connector"
  | "action"
  | "payment"
  | "export"
  | "deletion"
  | "security"
  | "config";

export type AuditEventSummary = {
  id: number;
  workspace_id: string;
  actor_user_id: string | null;
  event_category: AuditCategory;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  detail_json: string;
  created_at: number;
};

export type ActivityFeedProps = {
  workspaceId: string;
  /** Number of events to fetch. Defaults to 20. */
  limit?: number;
  /** Render in compact mode (no header / refresh button — used inside the dashboard). */
  compact?: boolean;
};

type AuditResponse = { events?: AuditEventSummary[]; error?: string };

const categoryTone: Record<AuditCategory, string> = {
  auth: "tone-sky",
  role: "tone-violet",
  approval: "tone-lime",
  connector: "tone-amber",
  action: "tone-sky",
  payment: "tone-emerald",
  export: "tone-slate",
  deletion: "tone-rose",
  security: "tone-rose",
  config: "tone-slate",
};

function parseDetail(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatRelative(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

/**
 * Recent audit events rendered as a vertical timeline. Used directly on the
 * workspace overview and in the dashboard widget. Fetches
 * `/api/audit?limit=20` (overridable) and degrades to a friendly empty
 * state when the workspace has no activity yet.
 */
export function ActivityFeed({ workspaceId, limit = 20, compact = false }: ActivityFeedProps) {
  const [items, setItems] = useState<AuditEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/audit?workspace_id=${encodeURIComponent(workspaceId)}&limit=${limit}`,
        );
        const data = (await response.json()) as AuditResponse;
        if (cancelled) return;
        if (response.ok && data.events) {
          setItems(data.events);
        } else {
          setError(data.error || "Failed to load activity");
        }
      } catch {
        if (!cancelled) setError("Network error while loading activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, limit]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(
        `/api/audit?workspace_id=${encodeURIComponent(workspaceId)}&limit=${limit}`,
      );
      const data = (await response.json()) as AuditResponse;
      if (response.ok && data.events) setItems(data.events);
    } catch {
      // background reloads are non-fatal
    }
  }

  const header = compact ? (
    <header className="activity-feed-head activity-feed-head-compact">
      <div>
        <p className="section-label">
          <Activity /> Recent activity
        </p>
        <h3>Latest audit events</h3>
      </div>
      <Button variant="outline" size="sm" onClick={() => void reload()}>
        <RefreshCw /> Refresh
      </Button>
    </header>
  ) : (
    <header className="activity-feed-head">
      <div>
        <p className="section-label">
          <Activity /> Activity feed
        </p>
        <h2>Workspace audit timeline</h2>
        <p className="ws-panel-lede">
          The most recent {limit} audit events, newest first. Every privileged
          action — approval, payment, deletion — is recorded with actor and
          category.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void reload()}>
        <RefreshCw /> Refresh
      </Button>
    </header>
  );

  return (
    <section className="activity-feed ws-panel" aria-live="polite">
      {header}
      {error ? (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading activity…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Audit events appear here as soon as the workspace records its first approval, action or payment."
        />
      ) : (
        <ol className="activity-timeline" aria-label="Workspace activity timeline">
          {items.map((event) => {
            const detail = parseDetail(event.detail_json);
            return (
              <li key={event.id} className={`activity-node ${categoryTone[event.event_category]}`}>
                <span className="activity-dot" aria-hidden="true" />
                <div className="activity-body">
                  <header>
                    <strong>{event.event_type}</strong>
                    <span className={`activity-category activity-category-${event.event_category}`}>
                      {event.event_category}
                    </span>
                  </header>
                  {event.resource_type ? (
                    <small className="activity-resource">
                      {event.resource_type}
                      {event.resource_id ? ` · ${event.resource_id}` : ""}
                    </small>
                  ) : null}
                  {detail ? (
                    <pre className="activity-detail">{JSON.stringify(detail, null, 2)}</pre>
                  ) : null}
                  <footer className="activity-meta">
                    <small>{event.actor_user_id || "system"}</small>
                    <time dateTime={new Date(event.created_at).toISOString()}>
                      {formatRelative(event.created_at)}
                    </time>
                  </footer>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default ActivityFeed;

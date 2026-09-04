"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CircleAlert,
  CircleDot,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

type NotificationKind =
  | "approval"
  | "blocked_action"
  | "system"
  | "warning"
  | "info";

type NotificationSeverity = "low" | "medium" | "high";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  detail?: string;
  mission_id?: string;
  action_id?: string;
  created_at: number;
  read?: boolean;
};

export type NotificationsResponse = {
  notifications?: NotificationItem[];
  error?: string;
};

export type NotificationsPanelProps = {
  workspaceId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
  /** Optional compact flag for sidebar footer rendering. */
  compact?: boolean;
};

const kindLabel: Record<NotificationKind, string> = {
  approval: "Approval",
  blocked_action: "Blocked action",
  system: "System",
  warning: "Warning",
  info: "Info",
};

/**
 * Workspace notifications panel. Fetches `/api/notifications` (scoped to
 * the workspace by query string) and surfaces pending approvals and blocked
 * actions alongside general system warnings.
 *
 * In compact mode (sidebar footer) the panel renders a tighter list with
 * only the most recent items; in full mode (settings view) it renders the
 * complete feed with severity pills.
 */
export function NotificationsPanel({
  workspaceId,
  refreshKey,
  compact = false,
}: NotificationsPanelProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/notifications?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as NotificationsResponse;
        if (cancelled) return;
        if (response.ok && data.notifications) {
          setItems(data.notifications);
        } else {
          setError(data.error || "Notifications unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading notifications");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, refreshKey]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(
        `/api/notifications?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as NotificationsResponse;
      if (response.ok && data.notifications) setItems(data.notifications);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading && compact) {
    return (
      <div className="notifications-compact ws-empty" aria-busy="true">
        <LoaderCircle className="animate-spin" /> Loading notifications…
      </div>
    );
  }

  if (compact) {
    const top = items.slice(0, 4);
    if (top.length === 0) {
      return (
        <div className="notifications-compact">
          <header>
            <Bell /> Notifications
            <span className="notifications-empty-dot" />
          </header>
          <p>All clear — no pending approvals or blocked actions.</p>
        </div>
      );
    }
    return (
      <div className="notifications-compact" aria-live="polite">
        <header>
          <Bell /> Notifications
          <span className="notifications-count">{items.length}</span>
          <button
            type="button"
            className="notifications-refresh"
            onClick={() => void reload()}
            aria-label="Refresh notifications"
          >
            <RefreshCw />
          </button>
        </header>
        <ul>
          {top.map((item) => (
            <li key={item.id} className={`notification-row notification-severity-${item.severity}`}>
              <span className="notification-dot" />
              <div>
                <strong>{item.title}</strong>
                <small>{kindLabel[item.kind]}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (loading) {
    return (
      <section className="ws-panel notifications-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Bell /> Notifications
            </p>
            <h2>Pending approvals &amp; blocked actions</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading notifications…
        </div>
      </section>
    );
  }

  if (error && items.length === 0) {
    return (
      <section className="ws-panel notifications-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Bell /> Notifications
            </p>
            <h2>Pending approvals &amp; blocked actions</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={ShieldAlert}
          title="Notifications unavailable"
          description="Refresh to load pending approvals and blocked actions."
        />
      </section>
    );
  }

  return (
    <section className="ws-panel notifications-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Bell /> Notifications
          </p>
          <h2>Pending approvals &amp; blocked actions</h2>
          <p className="ws-panel-lede">
            Approvals queued for human review, blocked actions and workspace
            warnings — newest first.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      {error ? (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          title="All clear"
          description="No pending approvals, blocked actions or warnings in this workspace."
        />
      ) : (
        <ol className="notifications-list">
          {items.map((item) => (
            <li key={item.id} className={`notification-row notification-severity-${item.severity}`}>
              <span className="notification-kind-pill">{kindLabel[item.kind]}</span>
              <div className="notification-body">
                <strong>{item.title}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
                <footer className="notification-meta">
                  {item.mission_id ? <small>{item.mission_id}</small> : null}
                  <time>{new Date(item.created_at).toLocaleString()}</time>
                </footer>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default NotificationsPanel;

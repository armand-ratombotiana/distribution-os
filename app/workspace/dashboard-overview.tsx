"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  CircleDollarSign,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActivityFeed, type AuditEventSummary } from "./activity-feed";
import { EmptyState } from "./empty-state";
import { KpiCard, type KpiTrend } from "./kpi-card";

export type DashboardSnapshot = {
  workspace?: {
    id: string;
    display_name: string;
    plan: string;
  };
  counts?: {
    missions: number;
    actions: number;
    evidence: number;
    payments: number;
    contacts: number;
    connectors: number;
  };
  trends?: {
    missions?: KpiTrend;
    actions?: KpiTrend;
    evidence?: KpiTrend;
    payments?: KpiTrend;
  };
  recent_activity?: AuditEventSummary[];
  error?: string;
};

export type DashboardOverviewProps = {
  workspaceId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
};

/**
 * Top-level dashboard widget for the workspace overview tab. Fetches
 * `/api/workspace/dashboard` and renders a 4-up KPI grid (missions,
 * actions, evidence, payments) plus the latest audit activity feed.
 *
 * The endpoint is workspace-scoped; if the server returns an error or the
 * payload is partial the panel degrades gracefully into an empty state.
 */
export function DashboardOverview({ workspaceId, refreshKey }: DashboardOverviewProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/workspace/dashboard?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as DashboardSnapshot;
        if (cancelled) return;
        if (response.ok) {
          setSnapshot(data);
        } else {
          setError(data.error || "Dashboard unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading dashboard");
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
        `/api/workspace/dashboard?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as DashboardSnapshot;
      if (response.ok) setSnapshot(data);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="dashboard-overview ws-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Target /> Workspace dashboard
            </p>
            <h2>Live KPIs and recent activity</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading dashboard…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="dashboard-overview ws-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Target /> Workspace dashboard
            </p>
            <h2>Live KPIs and recent activity</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={ShieldCheck}
          title="Dashboard is warming up"
          description="Launch a mission or connect a channel to populate the workspace dashboard."
        />
      </section>
    );
  }

  const counts = snapshot?.counts ?? {
    missions: 0,
    actions: 0,
    evidence: 0,
    payments: 0,
    contacts: 0,
    connectors: 0,
  };
  const trends = snapshot?.trends ?? {};

  return (
    <section className="dashboard-overview ws-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Target /> Workspace dashboard
          </p>
          <h2>
            {snapshot?.workspace?.display_name
              ? `${snapshot.workspace.display_name} · ${snapshot.workspace.plan} plan`
              : "Live KPIs and recent activity"}
          </h2>
          <p className="ws-panel-lede">
            Four headline metrics — missions, prepared actions, evidence rows and
            verified payments — side-by-side with the latest audit timeline.
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

      <div className="dashboard-kpis">
        <KpiCard
          label="Missions"
          value={counts.missions}
          icon={Target}
          trend={trends.missions}
          hint="Active distribution missions"
          testId="kpi-missions"
        />
        <KpiCard
          label="Actions queued"
          value={counts.actions}
          icon={ClipboardList}
          trend={trends.actions}
          hint="Approval-gated action queue"
          testId="kpi-actions"
        />
        <KpiCard
          label="Evidence rows"
          value={counts.evidence}
          icon={ShieldCheck}
          trend={trends.evidence}
          hint="Observed + verified signals"
          testId="kpi-evidence"
        />
        <KpiCard
          label="Verified payments"
          value={counts.payments}
          icon={CircleDollarSign}
          trend={trends.payments}
          hint="Stripe-confirmed revenue"
          testId="kpi-payments"
        />
      </div>

      <div className="dashboard-activity">
        <ActivityFeed workspaceId={workspaceId} compact limit={6} />
      </div>
    </section>
  );
}

export default DashboardOverview;

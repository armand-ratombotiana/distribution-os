"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CircleAlert,
  ClipboardList,
  Database,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { KpiCard } from "./kpi-card";

export type WorkspaceStatsSnapshot = {
  workspace?: {
    id: string;
    display_name: string;
    plan: string;
  };
  stats?: {
    missions: number;
    actions: number;
    evidence: number;
    experiments: number;
    payments: number;
    contacts: number;
    connectors: number;
    content_assets: number;
    succeeded_payments: number;
    pending_approvals: number;
  };
  error?: string;
};

export type StatsPanelProps = {
  workspaceId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
};

/**
 * Workspace stats panel. Fetches `/api/workspace/stats` and renders a
 * grid of stat cards covering the headline counts (missions, actions,
 * evidence, experiments, payments, contacts, connectors, content).
 *
 * The endpoint is read-only; if the server returns an error or the
 * payload is partial the panel degrades gracefully into a friendly
 * empty state with a retry button.
 */
export function StatsPanel({ workspaceId, refreshKey }: StatsPanelProps) {
  const [snapshot, setSnapshot] = useState<WorkspaceStatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/workspace/stats?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as WorkspaceStatsSnapshot;
        if (cancelled) return;
        if (response.ok) {
          setSnapshot(data);
        } else {
          setError(data.error || "Workspace stats unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading workspace stats");
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
        `/api/workspace/stats?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as WorkspaceStatsSnapshot;
      if (response.ok) setSnapshot(data);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="stats-panel ws-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <BarChart3 /> Workspace stats
            </p>
            <h2>Counts across every table</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading workspace stats…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="stats-panel ws-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <BarChart3 /> Workspace stats
            </p>
            <h2>Counts across every table</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={BarChart3}
          title="Workspace stats unavailable"
          description="Launch a mission or connect a channel to populate the stats endpoint."
        />
      </section>
    );
  }

  const stats = snapshot?.stats ?? {
    missions: 0,
    actions: 0,
    evidence: 0,
    experiments: 0,
    payments: 0,
    contacts: 0,
    connectors: 0,
    content_assets: 0,
    succeeded_payments: 0,
    pending_approvals: 0,
  };

  return (
    <section className="stats-panel ws-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <BarChart3 /> Workspace stats
          </p>
          <h2>
            {snapshot?.workspace?.display_name
              ? `${snapshot.workspace.display_name} · ${snapshot.workspace.plan} plan`
              : "Counts across every table"}
          </h2>
          <p className="ws-panel-lede">
            Headline counts across the workspace — missions, queued actions,
            evidence, experiments, payments, contacts, connectors and content.
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
          value={stats.missions}
          icon={Target}
          hint="Active distribution missions"
          testId="stat-missions"
        />
        <KpiCard
          label="Actions queued"
          value={stats.actions}
          icon={ClipboardList}
          hint={`${stats.pending_approvals} pending approval`}
          testId="stat-actions"
        />
        <KpiCard
          label="Evidence rows"
          value={stats.evidence}
          icon={ShieldCheck}
          hint="Observed + verified signals"
          testId="stat-evidence"
        />
        <KpiCard
          label="Experiments"
          value={stats.experiments}
          icon={FlaskConical}
          hint="Drafted + running + decided"
          testId="stat-experiments"
        />
        <KpiCard
          label="Payments"
          value={stats.payments}
          icon={Wallet}
          hint={`${stats.succeeded_payments} succeeded`}
          testId="stat-payments"
        />
        <KpiCard
          label="Contacts"
          value={stats.contacts}
          icon={Users}
          hint="Permissioned outreach lifecycle"
          testId="stat-contacts"
        />
        <KpiCard
          label="Connectors"
          value={stats.connectors}
          icon={Zap}
          hint="Installed channel connectors"
          testId="stat-connectors"
        />
        <KpiCard
          label="Content assets"
          value={stats.content_assets}
          icon={Database}
          hint="Queued + published content"
          testId="stat-content"
        />
      </div>
    </section>
  );
}

export default StatsPanel;

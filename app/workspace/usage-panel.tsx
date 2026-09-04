"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  Database,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Target,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "./empty-state";
import { ChartCard, type ChartDatum } from "./chart-card";

type UsageBucket = {
  label: string;
  used: number;
  limit: number;
  unit: string;
};

export type UsageSnapshot = {
  workspace?: {
    id: string;
    display_name?: string;
    plan?: string;
  };
  api?: UsageBucket;
  storage?: UsageBucket;
  missions?: {
    current: number;
    limit: number;
  };
  by_window?: ChartDatum[];
  error?: string;
};

export type UsagePanelProps = {
  workspaceId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
};

function formatPct(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/**
 * Workspace usage panel. Fetches `/api/workspace/usage` and renders API
 * call volume, storage consumption and mission count against their plan
 * limits, alongside a small bar chart of usage by window (last 7 days).
 *
 * The endpoint is referenced by the UI; if it is absent the panel degrades
 * into a friendly empty state with a retry button.
 */
export function UsagePanel({ workspaceId, refreshKey }: UsagePanelProps) {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/workspace/usage?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as UsageSnapshot;
        if (cancelled) return;
        if (response.ok) {
          setSnapshot(data);
        } else {
          setError(data.error || "Usage unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading usage");
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
        `/api/workspace/usage?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as UsageSnapshot;
      if (response.ok) setSnapshot(data);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="ws-panel usage-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Gauge /> Workspace usage
            </p>
            <h2>API, storage &amp; missions</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading usage…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="ws-panel usage-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Gauge /> Workspace usage
            </p>
            <h2>API, storage &amp; missions</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={Gauge}
          title="Usage data is warming up"
          description="Refresh to load API, storage and mission counts against plan limits."
        />
      </section>
    );
  }

  const api = snapshot?.api ?? { label: "API calls", used: 0, limit: 0, unit: "calls" };
  const storage = snapshot?.storage ?? {
    label: "Storage",
    used: 0,
    limit: 0,
    unit: "MB",
  };
  const missions = snapshot?.missions ?? { current: 0, limit: 0 };
  const byWindow = snapshot?.by_window ?? [];
  const plan = snapshot?.workspace?.plan || "founder";

  return (
    <section className="ws-panel usage-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Gauge /> Workspace usage
          </p>
          <h2>
            {snapshot?.workspace?.display_name
              ? `${snapshot.workspace.display_name} · ${plan} plan`
              : "API, storage &amp; missions"}
          </h2>
          <p className="ws-panel-lede">
            Plan-scoped limits for API volume, attachment storage and active
            missions — surfaced alongside a 7-day activity window.
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

      <div className="usage-grid">
        <article className="usage-card">
          <header>
            <Zap />
            <small>{api.label}</small>
          </header>
          <strong>
            {formatNumber(api.used)} <span>/ {formatNumber(api.limit)} {api.unit}</span>
          </strong>
          <Progress value={formatPct(api.used, api.limit)} />
          <p>{formatPct(api.used, api.limit)}% of plan limit consumed</p>
        </article>

        <article className="usage-card">
          <header>
            <Database />
            <small>{storage.label}</small>
          </header>
          <strong>
            {formatNumber(storage.used)} <span>/ {formatNumber(storage.limit)} {storage.unit}</span>
          </strong>
          <Progress value={formatPct(storage.used, storage.limit)} />
          <p>{formatPct(storage.used, storage.limit)}% of plan limit consumed</p>
        </article>

        <article className="usage-card">
          <header>
            <Target />
            <small>Missions</small>
          </header>
          <strong>
            {missions.current} <span>/ {missions.limit} active</span>
          </strong>
          <Progress value={formatPct(missions.current, missions.limit)} />
          <p>{formatPct(missions.current, missions.limit)}% of plan limit in use</p>
        </article>
      </div>

      <ChartCard
        title="API activity by window"
        eyebrow="7-day trend"
        data={byWindow}
        type="bar"
        footer={
          <small className="usage-chart-foot">
            Aggregated API call count per window — values reset at the start of each period.
          </small>
        }
        testId="usage-chart"
      />
    </section>
  );
}

export default UsagePanel;

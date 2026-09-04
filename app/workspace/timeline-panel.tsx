"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

type TimelineKind =
  | "mission"
  | "action"
  | "evidence"
  | "experiment"
  | "payment"
  | "approval"
  | "connector"
  | "system";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  actor?: string;
  mission_id?: string;
  action_id?: string;
  evidence_id?: string;
  experiment_id?: string;
  occurred_at: number;
};

export type TimelineResponse = {
  entries?: TimelineEntry[];
  error?: string;
};

export type TimelinePanelProps = {
  missionId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
};

const kindLabel: Record<TimelineKind, string> = {
  mission: "Mission",
  action: "Action",
  evidence: "Evidence",
  experiment: "Experiment",
  payment: "Payment",
  approval: "Approval",
  connector: "Connector",
  system: "System",
};

/**
 * Unified mission timeline. Fetches `/api/missions/{missionId}/timeline`
 * and renders every mission-scoped event — actions, evidence, experiments,
 * payments, approvals and connector state — on a single chronological rail.
 *
 * The endpoint is referenced by the UI; if it is absent the panel degrades
 * into a friendly empty state with a retry button.
 */
export function TimelinePanel({ missionId, refreshKey }: TimelinePanelProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/timeline`);
        const data = (await response.json()) as TimelineResponse;
        if (cancelled) return;
        if (response.ok && data.entries) {
          setEntries(data.entries);
        } else {
          setError(data.error || "Timeline unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading timeline");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [missionId, refreshKey]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(`/api/missions/${missionId}/timeline`);
      const data = (await response.json()) as TimelineResponse;
      if (response.ok && data.entries) setEntries(data.entries);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="ws-panel timeline-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Clock3 /> Unified timeline
            </p>
            <h2>Mission event stream</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading timeline…
        </div>
      </section>
    );
  }

  if (error && entries.length === 0) {
    return (
      <section className="ws-panel timeline-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Clock3 /> Unified timeline
            </p>
            <h2>Mission event stream</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={Clock3}
          title="Timeline is warming up"
          description="Launch the mission or refresh to load the unified event stream."
        />
      </section>
    );
  }

  return (
    <section className="ws-panel timeline-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Clock3 /> Unified timeline
          </p>
          <h2>Mission event stream</h2>
          <p className="ws-panel-lede">
            Every action, evidence row, experiment, payment and approval on a
            single chronological rail — newest first.
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

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No timeline events yet"
          description="Run the next agent step or approve an action to populate the unified timeline."
        />
      ) : (
        <ol className="timeline-rail">
          {entries.map((entry) => (
            <li key={entry.id} className={`timeline-node timeline-kind-${entry.kind}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-body">
                <header>
                  <strong>{entry.title}</strong>
                  <span className="timeline-kind-pill">{kindLabel[entry.kind]}</span>
                </header>
                {entry.detail ? <p>{entry.detail}</p> : null}
                <footer className="timeline-meta">
                  {entry.actor ? <small>{entry.actor}</small> : null}
                  <time>{new Date(entry.occurred_at).toLocaleString()}</time>
                </footer>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default TimelinePanel;

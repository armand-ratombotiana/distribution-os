"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "./empty-state";

export type MissionSummarySnapshot = {
  mission_id?: string;
  product_name?: string;
  status?: string;
  current_stage?: string;
  cycle_number?: number;
  approved?: boolean;
  action_count?: number;
  evidence_count?: number;
  experiment_count?: number;
  payment_count?: number;
  can_advance?: boolean;
  blocking_reasons?: string[];
  readiness_score?: number;
  error?: string;
};

type MissionSummaryResponse = { summary?: MissionSummarySnapshot; error?: string };

export type MissionSummaryProps = {
  missionId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
};

const STAGE_ORDER = ["observe", "decide", "approve", "act", "measure", "learn"] as const;
type Stage = (typeof STAGE_ORDER)[number];

const stageLabel: Record<Stage, string> = {
  observe: "Observe",
  decide: "Decide",
  approve: "Approve",
  act: "Act",
  measure: "Measure",
  learn: "Learn",
};

function isStage(value: string | undefined): value is Stage {
  return Boolean(value) && (STAGE_ORDER as readonly string[]).includes(value as Stage);
}

/**
 * Compact mission summary panel used on the overview tab. Fetches
 * `/api/missions/{missionId}/summary` and renders the stage progress rail,
 * current cycle, headline counts and a readiness meter. Degrades to a
 * friendly empty state if the summary endpoint is unavailable.
 */
export function MissionSummary({ missionId, refreshKey }: MissionSummaryProps) {
  const [snapshot, setSnapshot] = useState<MissionSummarySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/summary`);
        const data = (await response.json()) as MissionSummaryResponse;
        if (cancelled) return;
        if (response.ok) {
          setSnapshot(data.summary ?? null);
        } else {
          setError(data.error || "Mission summary unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading mission summary");
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
      const response = await fetch(`/api/missions/${missionId}/summary`);
      const data = (await response.json()) as MissionSummaryResponse;
      if (response.ok) setSnapshot(data.summary ?? null);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="mission-summary ws-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Target /> Mission summary
            </p>
            <h2>Stage, cycle and readiness</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading mission summary…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="mission-summary ws-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Target /> Mission summary
            </p>
            <h2>Stage, cycle and readiness</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={Target}
          title="Mission summary unavailable"
          description="Launch the mission or refresh to load the latest stage and readiness snapshot."
        />
      </section>
    );
  }

  const stage = isStage(snapshot?.current_stage) ? (snapshot!.current_stage as Stage) : "observe";
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const cycle = snapshot?.cycle_number ?? 0;
  const approved = Boolean(snapshot?.approved);
  const counts = {
    actions: snapshot?.action_count ?? 0,
    evidence: snapshot?.evidence_count ?? 0,
    experiments: snapshot?.experiment_count ?? 0,
    payments: snapshot?.payment_count ?? 0,
  };
  const readinessScore = Number.isFinite(snapshot?.readiness_score)
    ? Math.max(0, Math.min(100, Math.round(snapshot?.readiness_score as number)))
    : 0;
  const blockingReasons = snapshot?.blocking_reasons ?? [];

  return (
    <section className="mission-summary ws-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Target /> Mission summary
          </p>
          <h2>
            {snapshot?.product_name
              ? snapshot.product_name
              : snapshot?.mission_id
                ? snapshot.mission_id
                : "Stage, cycle and readiness"}
          </h2>
          <p className="ws-panel-lede">
            One glance at the operating loop: where the mission is in its
            six-stage cycle, what is queued and how ready it is to advance.
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

      <div className="mission-summary-headline">
        <div className="mission-summary-headline-cell">
          <small>Status</small>
          <strong>{snapshot?.status || "learning"}</strong>
        </div>
        <div className="mission-summary-headline-cell">
          <small>Cycle</small>
          <strong>{cycle}</strong>
        </div>
        <div className="mission-summary-headline-cell">
          <small>Stage</small>
          <strong>{stageLabel[stage]}</strong>
        </div>
        <div className="mission-summary-headline-cell">
          <small>Approval</small>
          <strong className={approved ? "mission-summary-approved" : "mission-summary-pending"}>
            {approved ? "Approved" : "Pending"}
          </strong>
        </div>
      </div>

      <ol className="mission-stage-rail" aria-label="Mission stage progress">
        {STAGE_ORDER.map((item, index) => {
          const state = index < stageIndex ? "done" : index === stageIndex ? "current" : "queued";
          return (
            <li key={item} className={`mission-stage-node mission-stage-${state}`}>
              <span className="mission-stage-marker">{index + 1}</span>
              <div>
                <strong>{stageLabel[item]}</strong>
                <small>
                  {state === "done"
                    ? "complete"
                    : state === "current"
                      ? "in progress"
                      : "queued"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mission-summary-counts">
        <div>
          <ClipboardList />
          <strong>{counts.actions ?? 0}</strong>
          <small>Actions</small>
        </div>
        <div>
          <ShieldCheck />
          <strong>{counts.evidence ?? 0}</strong>
          <small>Evidence</small>
        </div>
        <div>
          <Target />
          <strong>{counts.experiments ?? 0}</strong>
          <small>Experiments</small>
        </div>
        <div>
          <CircleDollarSign />
          <strong>{counts.payments ?? 0}</strong>
          <small>Payments</small>
        </div>
      </div>

      <div className="mission-readiness">
        <header>
          <div>
            <small>Readiness</small>
            <strong>{readinessScore}% ready</strong>
          </div>
          <span className={`mission-readiness-pill ${snapshot?.can_advance ? "ready" : "blocked"}`}>
            {snapshot?.can_advance ? "Ready to advance" : "Blocked"}
          </span>
        </header>
        <Progress value={readinessScore} />
        {blockingReasons.length > 0 ? (
          <ul className="mission-readiness-reasons">
            {blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export default MissionSummary;

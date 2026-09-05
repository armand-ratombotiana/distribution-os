"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "./badge";
import { EmptyState } from "./empty-state";

export type MissionDetailSnapshot = {
  mission_id?: string;
  product_name?: string;
  product_summary?: string;
  executive_thesis?: string;
  north_star_metric?: string;
  status?: string;
  current_stage?: string;
  cycle_number?: number;
  approved?: boolean;
  icp?: {
    segment?: string;
    pain?: string;
    trigger?: string;
    exclusion?: string;
  };
  strategy?: {
    primary_channel?: string;
    offer?: string;
    message?: string;
    why_now?: string;
  };
  counts?: {
    actions?: number;
    evidence?: number;
    experiments?: number;
    payments?: number;
    versions?: number;
  };
  readiness?: {
    can_advance?: boolean;
    requires_approval?: boolean;
    blocking_reasons?: string[];
    readiness_score?: number;
  };
  created_at?: number;
  updated_at?: number;
  error?: string;
};

export type MissionDetailProps = {
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
 * Detailed mission view. Fetches `/api/missions/{missionId}/summary` and
 * renders the full mission profile — product, ICP, strategy, stage rail,
 * counts, readiness meter and lifecycle metadata. Degrades to a friendly
 * empty state when the mission is not found or the summary endpoint is
 * unavailable.
 */
export function MissionDetail({ missionId, refreshKey }: MissionDetailProps) {
  const [snapshot, setSnapshot] = useState<MissionDetailSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/summary`);
        const data = (await response.json()) as MissionDetailSnapshot;
        if (cancelled) return;
        if (response.ok) {
          setSnapshot(data);
        } else {
          setError(data.error || "Mission detail unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading mission detail");
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
      const data = (await response.json()) as MissionDetailSnapshot;
      if (response.ok) setSnapshot(data);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="mission-detail ws-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Target /> Mission detail
            </p>
            <h2>Full mission profile</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading mission detail…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="mission-detail ws-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <Target /> Mission detail
            </p>
            <h2>Full mission profile</h2>
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
          title="Mission detail unavailable"
          description="The mission may not exist in this workspace, or the summary endpoint is temporarily unavailable."
        />
      </section>
    );
  }

  const stage = isStage(snapshot?.current_stage)
    ? (snapshot!.current_stage as Stage)
    : "observe";
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const cycle = snapshot?.cycle_number ?? 0;
  const approved = Boolean(snapshot?.approved);
  const counts = snapshot?.counts ?? {};
  const readiness = snapshot?.readiness ?? {};
  const readinessScore = Number.isFinite(readiness.readiness_score)
    ? Math.max(0, Math.min(100, Math.round(readiness.readiness_score as number)))
    : 0;
  const blockingReasons = readiness.blocking_reasons ?? [];
  const icp = snapshot?.icp ?? {};
  const strategy = snapshot?.strategy ?? {};

  return (
    <section className="mission-detail ws-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Target /> Mission detail
          </p>
          <h2>
            {snapshot?.product_name || snapshot?.mission_id || "Full mission profile"}
          </h2>
          <p className="ws-panel-lede">
            {snapshot?.product_summary ||
              "The complete mission profile: product, ICP, strategy, stage rail, counts and readiness."}
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

      <div className="mission-detail-grid">
        {snapshot?.executive_thesis ? (
          <article className="mission-detail-cell">
            <header>
              <Sparkles /> Executive thesis
            </header>
            <p>{snapshot.executive_thesis}</p>
          </article>
        ) : null}

        {snapshot?.north_star_metric ? (
          <article className="mission-detail-cell">
            <header>
              <Target /> North-star metric
            </header>
            <p>{snapshot.north_star_metric}</p>
          </article>
        ) : null}

        {(icp.segment || icp.pain || icp.trigger || icp.exclusion) && (
          <article className="mission-detail-cell">
            <header>
              <Target /> Ideal customer profile
            </header>
            <dl>
              {icp.segment ? (
                <div>
                  <dt>Segment</dt>
                  <dd>{icp.segment}</dd>
                </div>
              ) : null}
              {icp.pain ? (
                <div>
                  <dt>Pain</dt>
                  <dd>{icp.pain}</dd>
                </div>
              ) : null}
              {icp.trigger ? (
                <div>
                  <dt>Trigger</dt>
                  <dd>{icp.trigger}</dd>
                </div>
              ) : null}
              {icp.exclusion ? (
                <div>
                  <dt>Exclusion</dt>
                  <dd>{icp.exclusion}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        )}

        {(strategy.primary_channel || strategy.offer || strategy.message || strategy.why_now) && (
          <article className="mission-detail-cell">
            <header>
              <Target /> Strategy
            </header>
            <dl>
              {strategy.primary_channel ? (
                <div>
                  <dt>Primary channel</dt>
                  <dd>{strategy.primary_channel}</dd>
                </div>
              ) : null}
              {strategy.offer ? (
                <div>
                  <dt>Offer</dt>
                  <dd>{strategy.offer}</dd>
                </div>
              ) : null}
              {strategy.message ? (
                <div>
                  <dt>Message</dt>
                  <dd>{strategy.message}</dd>
                </div>
              ) : null}
              {strategy.why_now ? (
                <div>
                  <dt>Why now</dt>
                  <dd>{strategy.why_now}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        )}
      </div>

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
          <FlaskConical />
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
          <div className="mission-readiness-pills">
            {readiness.requires_approval ? (
              <Badge variant="warning">Requires approval</Badge>
            ) : null}
            <Badge variant={readiness.can_advance ? "success" : "danger"}>
              {readiness.can_advance ? "Ready to advance" : "Blocked"}
            </Badge>
          </div>
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

      {(snapshot?.created_at || snapshot?.updated_at) && (
        <footer className="mission-detail-foot">
          {snapshot?.created_at ? (
            <small>Created {new Date(snapshot.created_at).toLocaleString()}</small>
          ) : null}
          {snapshot?.updated_at ? (
            <small>Updated {new Date(snapshot.updated_at).toLocaleString()}</small>
          ) : null}
        </footer>
      )}
    </section>
  );
}

export default MissionDetail;

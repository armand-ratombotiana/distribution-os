"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  GitFork,
  LoaderCircle,
  Milestone,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "./badge";
import { EmptyState } from "./empty-state";

export type AttributionTouchpoint = {
  id: string;
  channel: string;
  event_type: string;
  occurred_at: number;
  /** Share of conversion credit, in the range [0, 1]. */
  credit: number;
  action_id?: string | null;
  experiment_id?: string | null;
};

export type AttributionModel =
  | "first_touch"
  | "last_touch"
  | "linear"
  | "time_decay"
  | "position_based";

export type AttributionSnapshot = {
  mission_id?: string;
  model?: AttributionModel;
  /** Overall attribution confidence, 0–100. */
  confidence?: number;
  /** Number of touchpoints considered. */
  touchpoint_count?: number;
  /** Whether a verified payment exists to close the attribution path. */
  closed?: boolean;
  touchpoints?: AttributionTouchpoint[];
  error?: string;
};

export type AttributionPanelProps = {
  missionId: string;
  /** Optional refresh trigger — bumped by the parent to force a refetch. */
  refreshKey?: number;
};

const modelLabel: Record<AttributionModel, string> = {
  first_touch: "First-touch",
  last_touch: "Last-touch",
  linear: "Linear",
  time_decay: "Time-decay",
  position_based: "Position-based",
};

const modelDescription: Record<AttributionModel, string> = {
  first_touch: "100% credit to the earliest touchpoint.",
  last_touch: "100% credit to the latest touchpoint.",
  linear: "Equal credit across every touchpoint.",
  time_decay: "Exponential weight toward the latest touchpoint.",
  position_based: "40/20/40 split across first, middle and last.",
};

function formatCredit(credit: number): string {
  if (!Number.isFinite(credit)) return "0%";
  return `${Math.round(credit * 100)}%`;
}

function formatRelative(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

/**
 * Mission attribution panel. Fetches
 * `/api/missions/{missionId}/attribution` and renders the active
 * attribution model, the touchpoint-by-touchpoint credit split, and the
 * overall confidence score. Degrades to a friendly empty state when no
 * touchpoints have been recorded yet.
 */
export function AttributionPanel({ missionId, refreshKey }: AttributionPanelProps) {
  const [snapshot, setSnapshot] = useState<AttributionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/attribution`);
        const data = (await response.json()) as AttributionSnapshot;
        if (cancelled) return;
        if (response.ok) {
          setSnapshot(data);
        } else {
          setError(data.error || "Attribution unavailable");
        }
      } catch {
        if (!cancelled) setError("Network error while loading attribution");
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
      const response = await fetch(`/api/missions/${missionId}/attribution`);
      const data = (await response.json()) as AttributionSnapshot;
      if (response.ok) setSnapshot(data);
    } catch {
      // background reloads are non-fatal
    }
  }

  if (loading) {
    return (
      <section className="attribution-panel ws-panel" aria-busy="true">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <GitFork /> Attribution
            </p>
            <h2>Touchpoints and conversion credit</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            <LoaderCircle className="animate-spin" /> Loading…
          </Button>
        </header>
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading attribution…
        </div>
      </section>
    );
  }

  if (error && !snapshot) {
    return (
      <section className="attribution-panel ws-panel" aria-live="polite">
        <header className="ws-panel-head">
          <div>
            <p className="section-label">
              <GitFork /> Attribution
            </p>
            <h2>Touchpoints and conversion credit</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw /> Retry
          </Button>
        </header>
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
        <EmptyState
          icon={GitFork}
          title="Attribution unavailable"
          description="Record touchpoints or verify a payment to populate the attribution path."
        />
      </section>
    );
  }

  const model = snapshot?.model ?? "last_touch";
  const confidence = Number.isFinite(snapshot?.confidence)
    ? Math.max(0, Math.min(100, Math.round(snapshot!.confidence as number)))
    : 0;
  const touchpoints = snapshot?.touchpoints ?? [];
  const closed = Boolean(snapshot?.closed);
  const touchpointCount = snapshot?.touchpoint_count ?? touchpoints.length;

  return (
    <section className="attribution-panel ws-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <GitFork /> Attribution
          </p>
          <h2>Touchpoints and conversion credit</h2>
          <p className="ws-panel-lede">
            The attribution model assigns conversion credit across every
            touchpoint. The path closes only when a verified payment lands.
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

      <div className="attribution-hero">
        <div>
          <small>Active model</small>
          <strong>{modelLabel[model]}</strong>
          <p>{modelDescription[model]}</p>
        </div>
        <div>
          <small>Touchpoints</small>
          <strong>{touchpointCount}</strong>
          <p>{touchpoints.length} credited</p>
        </div>
        <div>
          <small>Status</small>
          <strong>{closed ? "Closed" : "Open"}</strong>
          <p>{closed ? "verified payment" : "awaiting payment"}</p>
        </div>
        <div className="attribution-confidence">
          <header>
            <div>
              <small>Confidence</small>
              <strong>{confidence}%</strong>
            </div>
            <Badge variant={confidence >= 70 ? "success" : confidence >= 40 ? "warning" : "danger"}>
              <TrendingUp /> {confidence >= 70 ? "High" : confidence >= 40 ? "Medium" : "Low"}
            </Badge>
          </header>
          <Progress value={confidence} />
        </div>
      </div>

      {touchpoints.length === 0 ? (
        <EmptyState
          icon={Milestone}
          title="No touchpoints yet"
          description="Channel events appear here as soon as the mission records its first distribution touchpoint."
        />
      ) : (
        <ol className="attribution-touchpoints" aria-label="Attribution touchpoints">
          {touchpoints.map((touchpoint, index) => (
            <li key={touchpoint.id} className="attribution-touchpoint">
              <span className="attribution-touchpoint-index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="attribution-touchpoint-body">
                <header>
                  <strong>{touchpoint.channel}</strong>
                  <Badge variant="info">{touchpoint.event_type}</Badge>
                </header>
                <small>
                  {touchpoint.action_id ? `action ${touchpoint.action_id}` : "no linked action"}
                  {touchpoint.experiment_id ? ` · experiment ${touchpoint.experiment_id}` : ""}
                </small>
                <small>{formatRelative(touchpoint.occurred_at)}</small>
              </div>
              <div className="attribution-touchpoint-credit">
                <Target aria-hidden="true" />
                <strong>{formatCredit(touchpoint.credit)}</strong>
                <small>credit</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default AttributionPanel;

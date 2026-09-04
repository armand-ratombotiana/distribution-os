"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  FlaskConical,
  LoaderCircle,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartCard, type ChartDatum } from "./chart-card";
import { EmptyState } from "./empty-state";

type ExperimentStatus =
  | "draft"
  | "running"
  | "completed"
  | "stopped"
  | "blocked";

type ExperimentDecision =
  | "continue"
  | "change"
  | "stop"
  | "blocked"
  | "pending";

type ExperimentRow = {
  id: string;
  mission_id: string;
  title: string;
  hypothesis: string;
  baseline: string | null;
  variant: string | null;
  metric: string;
  kill_rule: string;
  result: string | null;
  decision: ExperimentDecision;
  confidence: number;
  status: ExperimentStatus;
  created_at: number;
  updated_at: number;
};

type ExperimentsResponse = { experiments?: ExperimentRow[]; error?: string };
type ExperimentMutationResponse = { experiment?: ExperimentRow; error?: string };

const statusLabel: Record<ExperimentStatus, string> = {
  draft: "Draft",
  running: "Running",
  completed: "Completed",
  stopped: "Stopped",
  blocked: "Blocked",
};

const decisionLabel: Record<ExperimentDecision, string> = {
  continue: "Continue",
  change: "Change",
  stop: "Stop",
  blocked: "Blocked",
  pending: "Pending",
};

export function ExperimentsPanel({ missionId }: { missionId: string }) {
  const [items, setItems] = useState<ExperimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState("");
  const [killRule, setKillRule] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/experiments`);
        const data = (await response.json()) as ExperimentsResponse;
        if (cancelled) return;
        if (response.ok && data.experiments) {
          setItems(data.experiments);
        } else {
          setError(data.error || "Failed to load experiments");
        }
      } catch {
        if (!cancelled) setError("Network error while loading experiments");
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
      const response = await fetch(`/api/missions/${missionId}/experiments`);
      const data = (await response.json()) as ExperimentsResponse;
      if (response.ok && data.experiments) setItems(data.experiments);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !hypothesis.trim() || !metric.trim() || !killRule.trim()) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${missionId}/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          hypothesis: hypothesis.trim(),
          metric: metric.trim(),
          kill_rule: killRule.trim(),
        }),
      });
      const data = (await response.json()) as ExperimentMutationResponse;
      if (!response.ok || !data.experiment) {
        throw new Error(data.error || "Experiment creation failed");
      }
      setTitle("");
      setHypothesis("");
      setMetric("");
      setKillRule("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Experiment creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  const statusChartData: ChartDatum[] = useMemo(() => {
    const byStatus: Record<ExperimentStatus, number> = {
      draft: 0,
      running: 0,
      completed: 0,
      stopped: 0,
      blocked: 0,
    };
    for (const item of items) {
      byStatus[item.status] += 1;
    }
    return (Object.keys(byStatus) as ExperimentStatus[])
      .map((status) => ({
        label: statusLabel[status],
        value: byStatus[status],
      }))
      .filter((datum) => datum.value > 0);
  }, [items]);

  const decisionChartData: ChartDatum[] = useMemo(() => {
    const byDecision: Record<ExperimentDecision, number> = {
      continue: 0,
      change: 0,
      stop: 0,
      blocked: 0,
      pending: 0,
    };
    for (const item of items) {
      byDecision[item.decision] += 1;
    }
    return (Object.keys(byDecision) as ExperimentDecision[])
      .map((decision) => ({
        label: decisionLabel[decision],
        value: byDecision[decision],
      }))
      .filter((datum) => datum.value > 0);
  }, [items]);

  return (
    <section className="ws-panel workspace-experiments-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <FlaskConical /> Learning engine
          </p>
          <h2>Every action must produce revenue or information</h2>
          <p className="ws-panel-lede">
            Draft hypotheses, attach a kill rule, and capture the decision the
            OS made once evidence was reviewed.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <Input
          aria-label="Experiment title"
          placeholder="Title (e.g. First-touch email promise test)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Input
          aria-label="Hypothesis"
          placeholder="Hypothesis: what should happen if we are right?"
          value={hypothesis}
          onChange={(event) => setHypothesis(event.target.value)}
          required
        />
        <div className="ws-form-row">
          <Input
            aria-label="Success metric"
            placeholder="Success metric"
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
            required
          />
          <Input
            aria-label="Kill rule"
            placeholder="Kill rule"
            value={killRule}
            onChange={(event) => setKillRule(event.target.value)}
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Queue experiment
          </Button>
        </div>
      </form>

      {!loading && items.length > 0 ? (
        <div className="experiments-charts">
          <ChartCard
            title="Experiments by status"
            eyebrow="Pipeline"
            data={statusChartData}
            type="bar"
            footer={<small>{items.length} experiment(s) tracked</small>}
            testId="experiments-chart-status"
          />
          <ChartCard
            title="Decisions reached"
            eyebrow="Outcomes"
            data={decisionChartData}
            type="bar"
            footer={
              <small>
                {items.filter((i) => i.decision !== "pending").length} decided ·{" "}
                {items.filter((i) => i.decision === "pending").length} pending
              </small>
            }
            testId="experiments-chart-decisions"
          />
        </div>
      ) : null}

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading experiments…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Draft the first falsifiable test above — every action must produce revenue or information."
        />
      ) : (
        <div className="ws-cards">
          {items.map((item) => (
            <article key={item.id} className="ws-card experiment-card">
              <header>
                <span
                  className={`experiment-status-pill experiment-status-${item.status}`}
                >
                  {statusLabel[item.status]}
                </span>
                <span
                  className={`experiment-decision-pill experiment-decision-${item.decision}`}
                >
                  Decision · {decisionLabel[item.decision]}
                </span>
              </header>
              <h3>{item.title}</h3>
              <p>{item.hypothesis}</p>
              <div className="ws-card-rows">
                <div>
                  <small>Metric</small>
                  <strong>{item.metric}</strong>
                </div>
                <div>
                  <small>Kill rule</small>
                  <strong>{item.kill_rule}</strong>
                </div>
                {item.baseline && (
                  <div>
                    <small>Baseline</small>
                    <strong>{item.baseline}</strong>
                  </div>
                )}
                {item.variant && (
                  <div>
                    <small>Variant</small>
                    <strong>{item.variant}</strong>
                  </div>
                )}
              </div>
              {item.result && (
                <p className="ws-result">
                  <Target /> {item.result} · confidence {item.confidence}%
                </p>
              )}
              <footer className="ws-card-foot">
                <small>Updated {new Date(item.updated_at).toLocaleString()}</small>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

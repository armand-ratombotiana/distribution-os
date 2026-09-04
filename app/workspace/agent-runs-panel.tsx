"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CircleAlert,
  Clock,
  Coins,
  Cpu,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AgentRunStatus = "running" | "completed" | "failed" | "cancelled";

type AgentRunRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  agent_name: string;
  prompt_version: string;
  model: string;
  status: AgentRunStatus;
  tokens_input: number;
  tokens_output: number;
  cost_cents: number;
  latency_ms: number;
  error: string | null;
  started_at: number;
  completed_at: number | null;
  created_at: number;
};

type AgentRunsResponse = { runs?: AgentRunRow[]; error?: string };

const statusLabel: Record<AgentRunStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cents: number): string {
  const value = cents / 100;
  return `$${value.toFixed(4)}`;
}

export function AgentRunsPanel({ missionId }: { missionId: string }) {
  const [items, setItems] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/runs`);
        const data = (await response.json()) as AgentRunsResponse;
        if (cancelled) return;
        if (response.ok && data.runs) {
          setItems(data.runs);
        } else {
          setError(data.error || "Failed to load agent runs");
        }
      } catch {
        if (!cancelled) setError("Network error while loading agent runs");
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
      const response = await fetch(`/api/missions/${missionId}/runs`);
      const data = (await response.json()) as AgentRunsResponse;
      if (response.ok && data.runs) setItems(data.runs);
    } catch {
      // background reloads are non-fatal
    }
  }

  const filtered = agentFilter
    ? items.filter((run) =>
        run.agent_name.toLowerCase().includes(agentFilter.toLowerCase()),
      )
    : items;

  const totalCostCents = items.reduce((sum, run) => sum + run.cost_cents, 0);
  const totalTokens = items.reduce(
    (sum, run) => sum + run.tokens_input + run.tokens_output,
    0,
  );

  return (
    <section className="ws-panel workspace-agent-runs-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Activity /> Agent runs
          </p>
          <h2>Observability for every model invocation</h2>
          <p className="ws-panel-lede">
            Each run records model, prompt version, token usage, cost and
            latency — tied back to the mission.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <div className="revenue-hero agent-runs-hero">
        <Cpu />
        <small>Run totals</small>
        <strong>{items.length}</strong>
        <span className="revenue-amount">{formatCost(totalCostCents)}</span>
        <p>
          <Coins /> {totalTokens.toLocaleString()} tokens across {items.length} run
          {items.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="ws-form-row">
        <Input
          aria-label="Filter by agent name"
          placeholder="Filter by agent name"
          value={agentFilter}
          onChange={(event) => setAgentFilter(event.target.value)}
        />
      </div>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading agent runs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="ws-empty">
          <Activity /> No agent runs recorded for this mission yet.
        </div>
      ) : (
        <div className="ws-cards">
          {filtered.map((run) => (
            <article key={run.id} className="ws-card agent-run-card">
              <header>
                <span className={`agent-run-status-pill agent-run-status-${run.status}`}>
                  {statusLabel[run.status]}
                </span>
                <span className="ws-meta">{run.model}</span>
              </header>
              <h3>{run.agent_name}</h3>
              <p>Prompt version {run.prompt_version}</p>
              <div className="ws-card-rows">
                <div>
                  <small>Cost</small>
                  <strong>{formatCost(run.cost_cents)}</strong>
                </div>
                <div>
                  <small>Latency</small>
                  <strong>
                    <Clock /> {formatLatency(run.latency_ms)}
                  </strong>
                </div>
                <div>
                  <small>Tokens</small>
                  <strong>
                    {run.tokens_input.toLocaleString()} in ·{" "}
                    {run.tokens_output.toLocaleString()} out
                  </strong>
                </div>
              </div>
              {run.error && <p className="ws-error-line">{run.error}</p>}
              <footer className="ws-card-foot">
                <small>Started {new Date(run.started_at).toLocaleString()}</small>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

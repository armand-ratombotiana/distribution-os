"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  GitBranch,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MissionVersionSummary = {
  id: string;
  mission_id: string;
  version_number: number;
  change_reason: string;
  created_by: string;
  created_at: number;
  mission_field_count: number;
  is_initial: boolean;
};

type StrategyVersionSummary = {
  id: string;
  mission_id: string;
  version_number: number;
  hypothesis: string;
  confidence: number;
  change_reason: string;
  created_by: string;
  created_at: number;
  strategy_field_count: number;
  confidence_band: "low" | "medium" | "high";
  is_initial: boolean;
};

type VersionEntry =
  | { kind: "mission"; row: MissionVersionSummary }
  | { kind: "strategy"; row: StrategyVersionSummary };

type VersionsResponse = {
  kind?: "mission" | "strategy";
  versions?: MissionVersionSummary[] | StrategyVersionSummary[];
  error?: string;
};

async function loadVersions(missionId: string): Promise<VersionEntry[]> {
  const [missionResponse, strategyResponse] = await Promise.all([
    fetch(`/api/missions/${missionId}/versions?kind=mission`),
    fetch(`/api/missions/${missionId}/versions?kind=strategy`),
  ]);
  const [missionData, strategyData] = (await Promise.all([
    missionResponse.json(),
    strategyResponse.json(),
  ])) as [VersionsResponse, VersionsResponse];
  if (!missionResponse.ok) {
    throw new Error(missionData.error || "Failed to load mission versions");
  }
  if (!strategyResponse.ok) {
    throw new Error(strategyData.error || "Failed to load strategy versions");
  }
  const mission = (missionData.versions || []) as MissionVersionSummary[];
  const strategy = (strategyData.versions || []) as StrategyVersionSummary[];
  return [
    ...mission.map((row) => ({ kind: "mission" as const, row })),
    ...strategy.map((row) => ({ kind: "strategy" as const, row })),
  ].sort((a, b) => b.row.created_at - a.row.created_at);
}

export function VersionsPanel({ missionId }: { missionId: string }) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await loadVersions(missionId);
        if (cancelled) return;
        setVersions(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Network error while loading version history");
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
      setVersions(await loadVersions(missionId));
    } catch {
      // background reloads are non-fatal
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return versions;
    const lowered = query.toLowerCase();
    return versions.filter(
      (entry) =>
        entry.row.change_reason.toLowerCase().includes(lowered) ||
        entry.row.created_by.toLowerCase().includes(lowered) ||
        (entry.kind === "strategy" &&
          entry.row.hypothesis.toLowerCase().includes(lowered)),
    );
  }, [versions, query]);

  return (
    <section className="ws-panel workspace-versions-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <History /> Version history
          </p>
          <h2>Append-only mission and strategy timeline</h2>
          <p className="ws-panel-lede">
            Every change creates a new row with a bumped version number and a
            human-readable change reason.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <div className="connector-toolbar">
        <div>
          <Search />
          <Input
            aria-label="Filter versions"
            placeholder="Filter by change reason or author"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span>{filtered.length} versions</span>
      </div>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading versions…
        </div>
      ) : filtered.length === 0 ? (
        <div className="ws-empty">
          <History /> No versions recorded yet.
        </div>
      ) : (
        <ol className="version-timeline">
          {filtered.map((entry) => {
            const summary = entry.kind === "mission"
              ? `${entry.row.mission_field_count} mission fields${entry.row.is_initial ? " · initial snapshot" : ""}`
              : `${entry.row.strategy_field_count} strategy fields · ${entry.row.hypothesis}`;
            return (
              <li
                key={`${entry.kind}-${entry.row.id}`}
                className={`version-timeline-item version-kind-${entry.kind}`}
              >
                <span className="version-marker">
                  {entry.kind === "mission" ? <History /> : <GitBranch />}
                </span>
                <div className="version-body">
                  <header>
                    <strong>
                      {entry.kind === "mission" ? "Mission" : "Strategy"} v
                      {entry.row.version_number}
                    </strong>
                    <em>
                      {entry.kind === "strategy" &&
                        `confidence ${entry.row.confidence}%`}
                    </em>
                  </header>
                  <p>{entry.row.change_reason}</p>
                  <small>{summary}</small>
                  <footer className="ws-card-foot">
                    <small>
                      {entry.row.created_by} ·{" "}
                      {new Date(entry.row.created_at).toLocaleString()}
                    </small>
                  </footer>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

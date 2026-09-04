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

type MissionVersionRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  version_number: number;
  mission_json: string;
  change_reason: string;
  created_by: string;
  created_at: number;
};

type StrategyVersionRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  version_number: number;
  strategy_json: string;
  hypothesis: string;
  confidence: number;
  change_reason: string;
  created_by: string;
  created_at: number;
};

type VersionEntry =
  | { kind: "mission"; row: MissionVersionRow }
  | { kind: "strategy"; row: StrategyVersionRow };

type VersionsResponse = {
  mission_versions?: MissionVersionRow[];
  strategy_versions?: StrategyVersionRow[];
  error?: string;
};

function summarizeMission(json: string): { fields: number; preview: string } {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    const preview =
      typeof parsed.product_name === "string"
        ? parsed.product_name
        : typeof parsed.executive_thesis === "string"
          ? parsed.executive_thesis.slice(0, 80)
          : "Mission snapshot";
    return { fields: keys.length, preview };
  } catch {
    return { fields: 0, preview: "Unreadable snapshot" };
  }
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
        const response = await fetch(`/api/missions/${missionId}/versions`);
        const data = (await response.json()) as VersionsResponse;
        if (cancelled) return;
        if (response.ok) {
          const mission: VersionEntry[] = (data.mission_versions || []).map(
            (row) => ({ kind: "mission" as const, row }),
          );
          const strategy: VersionEntry[] = (data.strategy_versions || []).map(
            (row) => ({ kind: "strategy" as const, row }),
          );
          const merged = [...mission, ...strategy].sort(
            (a, b) => b.row.created_at - a.row.created_at,
          );
          setVersions(merged);
        } else {
          setError(data.error || "Failed to load version history");
        }
      } catch {
        if (!cancelled) setError("Network error while loading version history");
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
      const response = await fetch(`/api/missions/${missionId}/versions`);
      const data = (await response.json()) as VersionsResponse;
      if (response.ok) {
        const mission: VersionEntry[] = (data.mission_versions || []).map(
          (row) => ({ kind: "mission" as const, row }),
        );
        const strategy: VersionEntry[] = (data.strategy_versions || []).map(
          (row) => ({ kind: "strategy" as const, row }),
        );
        const merged = [...mission, ...strategy].sort(
          (a, b) => b.row.created_at - a.row.created_at,
        );
        setVersions(merged);
      }
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
            const summary =
              entry.kind === "mission"
                ? summarizeMission(entry.row.mission_json)
                : { fields: 0, preview: entry.row.hypothesis };
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
                  <small>{summary.preview}</small>
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

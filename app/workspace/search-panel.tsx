"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { SearchInput } from "./search-input";

type SearchResultKind = "mission" | "action" | "evidence";

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  snippet: string;
  mission_id?: string;
  url?: string;
  occurred_at?: number;
};

export type SearchResponse = {
  query?: string;
  results?: SearchResult[];
  error?: string;
};

export type SearchPanelProps = {
  workspaceId: string;
  /** Optional initial query used to seed the input. */
  initialQuery?: string;
};

const kindLabel: Record<SearchResultKind, string> = {
  mission: "Mission",
  action: "Action",
  evidence: "Evidence",
};

/**
 * Workspace-wide search panel. Fetches
 * `/api/workspace/search?q=…&workspace_id=…` and renders results across
 * missions, actions and evidence. The debounced `SearchInput` primitive
 * keeps typing responsive — the parent only sees the committed query after
 * the debounce window elapses, so we never fire a fetch per keystroke.
 *
 * The endpoint is referenced by the UI; if it is absent the panel degrades
 * into a friendly empty state.
 */
export function SearchPanel({ workspaceId, initialQuery = "" }: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const trimmedQuery = query.trim();
  const isEmptyQuery = trimmedQuery.length === 0;

  useEffect(() => {
    if (isEmptyQuery) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          q: trimmedQuery,
          workspace_id: workspaceId,
        });
        const response = await fetch(`/api/workspace/search?${params.toString()}`);
        const data = (await response.json()) as SearchResponse;
        if (cancelled) return;
        if (response.ok && data.results) {
          setResults(data.results);
          setError("");
        } else {
          setResults([]);
          setError(data.error || "Search failed");
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setError("Network error while running search");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasSearched(true);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [trimmedQuery, workspaceId, isEmptyQuery]);

  async function reload(): Promise<void> {
    if (!trimmedQuery) return;
    try {
      const params = new URLSearchParams({
        q: trimmedQuery,
        workspace_id: workspaceId,
      });
      const response = await fetch(`/api/workspace/search?${params.toString()}`);
      const data = (await response.json()) as SearchResponse;
      if (response.ok && data.results) setResults(data.results);
    } catch {
      // background reloads are non-fatal
    }
  }

  return (
    <section className="ws-panel search-panel" aria-live="polite">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Search /> Workspace search
          </p>
          <h2>Find missions, actions and evidence</h2>
          <p className="ws-panel-lede">
            One query across every mission-scoped record. Results are scoped to
            this workspace only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={!query.trim()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <div className="search-panel-input">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by title, summary, mission id…"
          ariaLabel="Search workspace"
          debounceMs={300}
          testId="workspace-search-input"
        />
      </div>

      {error ? (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      ) : null}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Running search…
        </div>
      ) : query.trim() && results.length === 0 ? (
        <EmptyState
          icon={Search}
          title={hasSearched ? "No matches" : "Type to search"}
          description={
            hasSearched
              ? `No missions, actions or evidence matched “${query.trim()}”.`
              : "Start typing above — the search runs after a short debounce."
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Search the workspace"
          description="Find any mission, queued action or evidence row by typing a query above."
        />
      ) : (
        <ol className="search-results">
          {results.map((result) => (
            <li key={`${result.kind}-${result.id}`} className={`search-result search-kind-${result.kind}`}>
              <span className="search-kind-pill">{kindLabel[result.kind]}</span>
              <div className="search-result-body">
                <strong>{result.title}</strong>
                <p>{result.snippet}</p>
                <footer className="search-result-meta">
                  {result.mission_id ? <small>{result.mission_id}</small> : null}
                  {result.occurred_at ? (
                    <time>{new Date(result.occurred_at).toLocaleString()}</time>
                  ) : null}
                </footer>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default SearchPanel;

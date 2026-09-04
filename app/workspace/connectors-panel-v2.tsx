"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Plug,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConnectorStatus =
  | "setup_required"
  | "authorized"
  | "connected"
  | "healthy"
  | "degraded"
  | "disconnected"
  | "revoked"
  | "error";

type ConnectorInstallation = {
  id: string;
  workspace_id: string;
  provider: string;
  category: string;
  status: ConnectorStatus;
  scopes_json: string;
  capabilities_json: string;
  last_sync_at: number | null;
  last_error: string | null;
  health_checked_at: number | null;
  created_at: number;
  updated_at: number;
};

type InstallationsResponse = {
  installations?: ConnectorInstallation[];
  error?: string;
};

type PrepareResponse = { installation?: ConnectorInstallation; error?: string };

const statusLabel: Record<ConnectorStatus, string> = {
  setup_required: "Setup required",
  authorized: "Authorized",
  connected: "Connected",
  healthy: "Healthy",
  degraded: "Degraded",
  disconnected: "Disconnected",
  revoked: "Revoked",
  error: "Error",
};

export function ConnectorsPanelV2({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<ConnectorInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preparingId, setPreparingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/connector-installations?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as InstallationsResponse;
        if (cancelled) return;
        if (response.ok && data.installations) {
          setItems(data.installations);
        } else {
          setError(data.error || "Failed to load connectors");
        }
      } catch {
        if (!cancelled) setError("Network error while loading connectors");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function reload(): Promise<void> {
    try {
      const response = await fetch(
        `/api/connector-installations?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as InstallationsResponse;
      if (response.ok && data.installations) setItems(data.installations);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function prepare(installation: ConnectorInstallation) {
    setPreparingId(installation.id);
    try {
      const response = await fetch("/api/connector-installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          provider: installation.provider,
          category: installation.category,
        }),
      });
      const data = (await response.json()) as PrepareResponse;
      if (response.ok && data.installation) {
        await reload();
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Connector preparation failed");
    } finally {
      setPreparingId(null);
    }
  }

  const filtered = query
    ? items.filter((item) =>
        `${item.provider} ${item.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : items;

  return (
    <section className="ws-panel workspace-connectors-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Plug /> Connectors
          </p>
          <h2>Workspace-scoped capabilities</h2>
          <p className="ws-panel-lede">
            Each connector lives in this workspace only. Tokens stay in the
            integration vault and never enter model context.
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
            aria-label="Search connectors"
            placeholder="Search providers or categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span>{filtered.length} shown</span>
      </div>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading connectors…
        </div>
      ) : filtered.length === 0 ? (
        <div className="ws-empty">
          <Plug /> No connectors installed in this workspace yet.
        </div>
      ) : (
        <div className="ws-cards connector-grid">
          {filtered.map((item) => (
            <article key={item.id} className="ws-card connector-card">
              <header>
                <span
                  className={`connector-status-pill connector-status-${item.status}`}
                >
                  {statusLabel[item.status]}
                </span>
                <span className="ws-meta">{item.category}</span>
              </header>
              <h3>{item.provider}</h3>
              {item.last_error && (
                <p className="ws-error-line">{item.last_error}</p>
              )}
              <footer className="ws-card-foot">
                <small>
                  <Settings2 />
                  {item.last_sync_at
                    ? `Synced ${new Date(item.last_sync_at).toLocaleString()}`
                    : "Never synced"}
                </small>
              </footer>
              <div className="ws-card-actions">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void prepare(item)}
                  disabled={preparingId === item.id}
                >
                  {preparingId === item.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Settings2 />
                  )}
                  Prepare
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

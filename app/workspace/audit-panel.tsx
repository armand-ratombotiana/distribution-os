"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Filter,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuditCategory =
  | "auth"
  | "role"
  | "approval"
  | "connector"
  | "action"
  | "payment"
  | "export"
  | "deletion"
  | "security"
  | "config";

type AuditEvent = {
  id: number;
  workspace_id: string;
  actor_user_id: string | null;
  event_category: AuditCategory;
  event_type: string;
  action_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  detail_json: string;
  ip_hash: string | null;
  created_at: number;
};

type AuditResponse = { events?: AuditEvent[]; error?: string };

const categories: (AuditCategory | "all")[] = [
  "all",
  "auth",
  "role",
  "approval",
  "connector",
  "action",
  "payment",
  "export",
  "deletion",
  "security",
  "config",
];

const categoryLabel: Record<AuditCategory, string> = {
  auth: "Auth",
  role: "Role",
  approval: "Approval",
  connector: "Connector",
  action: "Action",
  payment: "Payment",
  export: "Export",
  deletion: "Deletion",
  security: "Security",
  config: "Config",
};

function parseDetail(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuditPanel({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/audit?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as AuditResponse;
        if (cancelled) return;
        if (response.ok && data.events) {
          setItems(data.events);
        } else {
          setError(data.error || "Failed to load audit log");
        }
      } catch {
        if (!cancelled) setError("Network error while loading audit log");
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
        `/api/audit?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as AuditResponse;
      if (response.ok && data.events) setItems(data.events);
    } catch {
      // background reloads are non-fatal
    }
  }

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    return items.filter((event) => {
      if (category !== "all" && event.event_category !== category) return false;
      if (!lowered) return true;
      return (
        event.event_type.toLowerCase().includes(lowered) ||
        (event.resource_type || "").toLowerCase().includes(lowered) ||
        (event.resource_id || "").toLowerCase().includes(lowered)
      );
    });
  }, [items, category, query]);

  return (
    <section className="ws-panel workspace-audit-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <ShieldAlert /> Audit log
          </p>
          <h2>Tamper-evident event history</h2>
          <p className="ws-panel-lede">
            Every privileged action — approval, payment, deletion, role change —
            is recorded with actor, category and detail.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <div className="connector-toolbar">
        <div>
          <Filter />
          <Input
            aria-label="Filter audit events"
            placeholder="Filter by event type or resource"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span>{filtered.length} events</span>
      </div>

      <div className="category-pills">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => setCategory(item)}
            type="button"
          >
            {item === "all" ? "All" : categoryLabel[item]}
          </button>
        ))}
      </div>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading audit log…
        </div>
      ) : filtered.length === 0 ? (
        <div className="ws-empty">
          <ShieldAlert /> No audit events match this filter.
        </div>
      ) : (
        <ol className="audit-list">
          {filtered.map((event) => {
            const detail = parseDetail(event.detail_json);
            return (
              <li key={event.id} className="audit-row">
                <span
                  className={`audit-category-pill audit-category-${event.event_category}`}
                >
                  {categoryLabel[event.event_category]}
                </span>
                <div className="audit-row-body">
                  <strong>{event.event_type}</strong>
                  {event.resource_type && (
                    <small>
                      {event.resource_type}
                      {event.resource_id ? ` · ${event.resource_id}` : ""}
                    </small>
                  )}
                  {detail && (
                    <pre className="audit-detail">{JSON.stringify(detail, null, 2)}</pre>
                  )}
                  <small className="audit-meta">
                    {event.actor_user_id || "system"} ·{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </small>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

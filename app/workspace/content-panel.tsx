"use client";

import { useEffect, useState } from "react";
import {
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ContentStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "archived";

type ContentAssetRow = {
  id: string;
  workspace_id: string;
  mission_id: string;
  action_id: string | null;
  platform: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  status: ContentStatus;
  variant_of_id: string | null;
  approved_by: string | null;
  approved_at: number | null;
  scheduled_at: number | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
};

type ContentResponse = { content?: ContentAssetRow[]; error?: string };
type ContentMutationResponse = { content?: ContentAssetRow; error?: string };

const statusLabel: Record<ContentStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  archived: "Archived",
};

export function ContentPanel({ missionId }: { missionId: string }) {
  const [items, setItems] = useState<ContentAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [format, setFormat] = useState("post");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/missions/${missionId}/content`);
        const data = (await response.json()) as ContentResponse;
        if (cancelled) return;
        if (response.ok && data.content) {
          setItems(data.content);
        } else {
          setError(data.error || "Failed to load content");
        }
      } catch {
        if (!cancelled) setError("Network error while loading content");
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
      const response = await fetch(`/api/missions/${missionId}/content`);
      const data = (await response.json()) as ContentResponse;
      if (response.ok && data.content) setItems(data.content);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hook.trim() || !body.trim() || !cta.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${missionId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.trim(),
          format: format.trim(),
          hook: hook.trim(),
          body: body.trim(),
          cta: cta.trim(),
        }),
      });
      const data = (await response.json()) as ContentMutationResponse;
      if (!response.ok || !data.content) {
        throw new Error(data.error || "Content creation failed");
      }
      setHook("");
      setBody("");
      setCta("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Content creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="ws-panel workspace-content-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Send /> Content engine
          </p>
          <h2>Channel-native assets, gated by approval</h2>
          <p className="ws-panel-lede">
            Drafts move through seven statuses from <em>draft</em> to{" "}
            <em>published</em>. The OS never publishes without approval.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <Input
          aria-label="Hook"
          placeholder="Hook — the first line that earns attention"
          value={hook}
          onChange={(event) => setHook(event.target.value)}
          required
        />
        <textarea
          aria-label="Body"
          className="ws-textarea"
          rows={3}
          placeholder="Body — channel-native copy"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
        <div className="ws-form-row">
          <Input
            aria-label="CTA"
            placeholder="Call to action"
            value={cta}
            onChange={(event) => setCta(event.target.value)}
            required
          />
          <Input
            aria-label="Platform"
            placeholder="platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          />
          <Input
            aria-label="Format"
            placeholder="format"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Add draft
          </Button>
        </div>
      </form>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading content…
        </div>
      ) : items.length === 0 ? (
        <div className="ws-empty">
          <Send /> No content drafts yet. Add the first channel-native asset above.
        </div>
      ) : (
        <div className="ws-cards">
          {items.map((item) => (
            <article key={item.id} className="ws-card content-card">
              <header>
                <span className={`content-status-pill content-status-${item.status}`}>
                  {statusLabel[item.status]}
                </span>
                <span className="ws-meta">
                  {item.platform} · {item.format}
                </span>
              </header>
              <h3>{item.hook}</h3>
              <p>{item.body}</p>
              <p className="ws-meta">CTA · {item.cta}</p>
              <footer className="ws-card-foot">
                <small>
                  {item.published_at
                    ? `Published ${new Date(item.published_at).toLocaleString()}`
                    : item.scheduled_at
                      ? `Scheduled ${new Date(item.scheduled_at).toLocaleString()}`
                      : `Updated ${new Date(item.updated_at).toLocaleString()}`}
                </small>
                {item.approved_by && (
                  <small>Approved by {item.approved_by}</small>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

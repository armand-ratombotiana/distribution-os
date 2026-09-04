"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "./badge";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";

type ClaimRow = {
  id: string;
  pattern: string;
  description?: string | null;
  category?: string | null;
  severity?: "low" | "medium" | "high" | null;
};

type ForbiddenClaimsResponse = {
  claims?: ClaimRow[];
  error?: string;
};

type ForbiddenClaimsMutationResponse = {
  claim?: ClaimRow;
  error?: string;
};

const severityVariant: Record<NonNullable<ClaimRow["severity"]>, "default" | "success" | "warning" | "danger" | "info" | "neutral"> = {
  low: "info",
  medium: "warning",
  high: "danger",
};

/**
 * Forbidden claims panel. Fetches `/api/workspace/forbidden-claims` and
 * renders the list of brand-safety patterns configured for the workspace.
 * New claims can be added (POST) and existing claims removed (DELETE) —
 * removals go through a confirmation dialog because forbidden claims
 * directly affect brand-safety enforcement.
 */
export function ForbiddenClaimsPanel({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pattern, setPattern] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("guarantee");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [pendingRemoval, setPendingRemoval] = useState<ClaimRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/workspace/forbidden-claims?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        const data = (await response.json()) as ForbiddenClaimsResponse;
        if (cancelled) return;
        if (response.ok && data.claims) {
          setItems(data.claims);
        } else {
          setError(data.error || "Failed to load forbidden claims");
        }
      } catch {
        if (!cancelled) setError("Network error while loading forbidden claims");
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
        `/api/workspace/forbidden-claims?workspace_id=${encodeURIComponent(workspaceId)}`,
      );
      const data = (await response.json()) as ForbiddenClaimsResponse;
      if (response.ok && data.claims) setItems(data.claims);
    } catch {
      // background reloads are non-fatal
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pattern.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/forbidden-claims?workspace_id=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            pattern: pattern.trim(),
            description: description.trim() || null,
            category,
            severity,
          }),
        },
      );
      const data = (await response.json()) as ForbiddenClaimsMutationResponse;
      if (!response.ok || !data.claim) {
        throw new Error(data.error || "Forbidden claim creation failed");
      }
      setPattern("");
      setDescription("");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Forbidden claim creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeClaim(claim: ClaimRow): Promise<void> {
    setPendingRemoval(null);
    try {
      const response = await fetch(
        `/api/workspace/forbidden-claims/${encodeURIComponent(claim.id)}?workspace_id=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Forbidden claim removal failed");
      }
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Forbidden claim removal failed");
    }
  }

  return (
    <section className="ws-panel workspace-forbidden-claims-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Ban /> Forbidden claims
          </p>
          <h2>Brand-safety guardrails</h2>
          <p className="ws-panel-lede">
            Patterns added here are blocked before any content is queued for
            publication. Removals require confirmation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw /> Refresh
        </Button>
      </header>

      <form className="ws-form" onSubmit={submit}>
        <Input
          aria-label="Forbidden claim pattern"
          placeholder="Pattern (e.g. guaranteed revenue)"
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          required
        />
        <Input
          aria-label="Claim description"
          placeholder="Why is this claim forbidden? (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="ws-form-row">
          <select
            aria-label="Claim category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="guarantee">Guarantee</option>
            <option value="performance">Performance</option>
            <option value="regulatory">Regulatory</option>
            <option value="comparative">Comparative</option>
            <option value="social_proof">Social proof</option>
            <option value="sensitive">Sensitive</option>
          </select>
          <select
            aria-label="Claim severity"
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as "low" | "medium" | "high")
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <Button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Add claim
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
          <LoaderCircle className="animate-spin" /> Loading forbidden claims…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No forbidden claims configured"
          description="Add the first pattern above — every queued content row is screened against this list."
        />
      ) : (
        <ul className="forbidden-claims-list">
          {items.map((claim) => (
            <li key={claim.id} className="forbidden-claim-row">
              <div className="forbidden-claim-row-body">
                <header>
                  <strong>{claim.pattern}</strong>
                  {claim.severity ? (
                    <Badge variant={severityVariant[claim.severity]}>
                      {claim.severity}
                    </Badge>
                  ) : null}
                  {claim.category ? (
                    <Badge variant="neutral">{claim.category}</Badge>
                  ) : null}
                </header>
                {claim.description ? <p>{claim.description}</p> : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingRemoval(claim)}
                aria-label={`Remove forbidden claim ${claim.pattern}`}
              >
                <Trash2 /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove forbidden claim?"
        message={
          pendingRemoval
            ? `This will stop blocking "${pendingRemoval.pattern}" in future content reviews. Continue?`
            : ""
        }
        confirmLabel="Remove claim"
        cancelLabel="Keep claim"
        destructive
        onConfirm={() => {
          if (pendingRemoval) void removeClaim(pendingRemoval);
        }}
        onCancel={() => setPendingRemoval(null)}
        testId="forbidden-claim-remove-dialog"
      />
    </section>
  );
}

export default ForbiddenClaimsPanel;

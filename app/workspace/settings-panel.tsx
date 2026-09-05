"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  BellRing,
  CircleAlert,
  Coins,
  LoaderCircle,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type WorkspaceSettingsRow = {
  workspace_id: string;
  monthly_budget_cents: number;
  monthly_spent_cents: number;
  daily_budget_cents: number;
  daily_spent_cents: number;
  per_action_budget_cents: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string;
  forbidden_claims_count: number;
  retention_days: number;
  auto_approve_low_risk: boolean;
  max_daily_actions: number;
  updated_at: number;
};

type SettingsResponse = { settings?: WorkspaceSettingsRow; error?: string };
type ClaimsResponse = { claims?: string[]; error?: string };
type SettingsMutationResponse = {
  settings?: WorkspaceSettingsRow;
  error?: string;
};

export function SettingsPanel({ workspaceId }: { workspaceId: string }) {
  const [settings, setSettings] = useState<WorkspaceSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [monthlyBudget, setMonthlyBudget] = useState(10000);
  const [dailyBudget, setDailyBudget] = useState(2000);
  const [perAction, setPerAction] = useState(1000);
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(8);
  const [timezone, setTimezone] = useState("UTC");
  const [forbiddenClaims, setForbiddenClaims] = useState("");
  const [retention, setRetention] = useState(365);
  const [maxDailyActions, setMaxDailyActions] = useState(50);
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [response, claimsResponse] = await Promise.all([
          fetch(`/api/workspace/settings?workspace_id=${encodeURIComponent(workspaceId)}`),
          fetch("/api/workspace/forbidden-claims"),
        ]);
        const data = (await response.json()) as SettingsResponse;
        const claimsData = (await claimsResponse.json()) as ClaimsResponse;
        if (cancelled) return;
        if (response.ok && claimsResponse.ok && data.settings) {
          hydrate(data.settings);
          setForbiddenClaims((claimsData.claims || []).join("\n"));
        } else {
          setError(data.error || claimsData.error || "Failed to load settings");
        }
      } catch {
        if (!cancelled) setError("Network error while loading settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function hydrate(row: WorkspaceSettingsRow) {
    setSettings(row);
    setMonthlyBudget(row.monthly_budget_cents);
    setDailyBudget(row.daily_budget_cents);
    setPerAction(row.per_action_budget_cents);
    setQuietStart(row.quiet_hours_start);
    setQuietEnd(row.quiet_hours_end);
    setTimezone(row.timezone);
    setRetention(row.retention_days);
    setMaxDailyActions(row.max_daily_actions);
    setAutoApprove(row.auto_approve_low_risk);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSubmitting(true);
    setError("");
    try {
      const claimsList = forbiddenClaims
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const response = await fetch(
        `/api/workspace/settings?workspace_id=${encodeURIComponent(workspaceId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthly_budget_cents: monthlyBudget,
            daily_budget_cents: dailyBudget,
            per_action_budget_cents: perAction,
            quiet_hours_start: quietStart,
            quiet_hours_end: quietEnd,
            timezone,
            forbidden_claims: claimsList,
            retention_days: retention,
            max_daily_actions: maxDailyActions,
            auto_approve_low_risk: autoApprove,
          }),
        },
      );
      const data = (await response.json()) as SettingsMutationResponse;
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "Settings update failed");
      }
      hydrate(data.settings);
      setSavedAt(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings update failed");
    } finally {
      setSubmitting(false);
    }
  }

  const spentPercent = settings
    ? Math.min(
        100,
        Math.round((settings.monthly_spent_cents / settings.monthly_budget_cents) * 100),
      )
    : 0;

  return (
    <section className="ws-panel workspace-settings-panel">
      <header className="ws-panel-head">
        <div>
          <p className="section-label">
            <Settings2 /> Workspace settings
          </p>
          <h2>Budget, quiet hours and brand safety</h2>
          <p className="ws-panel-lede">
            The agent loop respects these guards before any external action is
            prepared or executed.
          </p>
        </div>
      </header>

      {error && (
        <div className="ws-error">
          <CircleAlert /> {error}
        </div>
      )}

      {loading ? (
        <div className="ws-empty">
          <LoaderCircle className="animate-spin" /> Loading settings…
        </div>
      ) : !settings ? (
        <div className="ws-empty">
          <Settings2 /> No settings row found for this workspace.
        </div>
      ) : (
        <form className="ws-settings-grid" onSubmit={submit}>
          <fieldset className="ws-settings-section">
            <legend>
              <Coins /> Budget
            </legend>
            <label>
              <span>Monthly budget (cents)</span>
              <Input
                type="number"
                min={0}
                value={monthlyBudget}
                onChange={(event) => setMonthlyBudget(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Daily budget (cents)</span>
              <Input
                type="number"
                min={0}
                value={dailyBudget}
                onChange={(event) => setDailyBudget(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Per-action budget (cents)</span>
              <Input
                type="number"
                min={0}
                value={perAction}
                onChange={(event) => setPerAction(Number(event.target.value))}
              />
            </label>
            <p className="ws-budget-meter">
              <small>Spent {spentPercent}% of monthly budget</small>
              <span className="ws-progress">
                <i style={{ width: `${spentPercent}%` }} />
              </span>
            </p>
          </fieldset>

          <fieldset className="ws-settings-section">
            <legend>
              <BellRing /> Quiet hours
            </legend>
            <div className="ws-form-row">
              <label>
                <span>Start (0-23)</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={quietStart}
                  onChange={(event) => setQuietStart(Number(event.target.value))}
                />
              </label>
              <label>
                <span>End (0-23)</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={quietEnd}
                  onChange={(event) => setQuietEnd(Number(event.target.value))}
                />
              </label>
            </div>
            <label>
              <span>Timezone</span>
              <Input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </label>
            <label>
              <span>Max daily actions</span>
              <Input
                type="number"
                min={1}
                value={maxDailyActions}
                onChange={(event) => setMaxDailyActions(Number(event.target.value))}
              />
            </label>
          </fieldset>

          <fieldset className="ws-settings-section">
            <legend>
              <Ban /> Forbidden claims
            </legend>
            <label>
              <span>One claim per line</span>
              <textarea
                className="ws-textarea"
                rows={4}
                value={forbiddenClaims}
                onChange={(event) => setForbiddenClaims(event.target.value)}
                placeholder={"e.g. Guaranteed revenue\nCure for …"}
              />
            </label>
            <label>
              <span>Retention days</span>
              <Input
                type="number"
                min={1}
                value={retention}
                onChange={(event) => setRetention(Number(event.target.value))}
              />
            </label>
            <label className="ws-toggle">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(event) => setAutoApprove(event.target.checked)}
              />
              <span>
                <ShieldCheck /> Auto-approve low-risk actions
              </span>
            </label>
          </fieldset>

          <div className="ws-settings-foot">
            <Button type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="animate-spin" /> : <Save />}
              Save settings
            </Button>
            {savedAt && (
              <small className="ws-saved">Saved {new Date(savedAt).toLocaleTimeString()}</small>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

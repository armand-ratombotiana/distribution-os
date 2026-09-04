"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export type KpiTrend = {
  /** Signed delta vs. the previous window. `0` is treated as flat. */
  delta: number;
  /** Optional human-readable label (e.g. "vs. last cycle"). */
  label?: string;
};

export type KpiCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: KpiTrend;
  /** Optional supporting context line under the value. */
  hint?: string;
  /** Optional id for snapshot testing / a11y targeting. */
  testId?: string;
};

const trendDirection = (delta: number): "up" | "down" | "flat" => {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
};

/**
 * Reusable metric card used across the workspace dashboard. Renders a
 * section label, large value, optional icon and an optional trend chip
 * (up/down/flat) with a percentage rounded to one decimal place.
 */
export function KpiCard({ label, value, icon: Icon, trend, hint, testId }: KpiCardProps) {
  const direction = trend ? trendDirection(trend.delta) : "flat";
  const TrendIcon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const pct =
    trend && Number.isFinite(trend.delta)
      ? `${Math.abs(trend.delta).toFixed(1)}%`
      : null;

  return (
    <article className="kpi-card" data-testid={testId} data-trend={trend ? direction : undefined}>
      <header className="kpi-card-head">
        <span className="kpi-label">{label}</span>
        {Icon ? (
          <span className="kpi-icon" aria-hidden="true">
            <Icon />
          </span>
        ) : null}
      </header>
      <strong className="kpi-value">{value}</strong>
      {hint ? <small className="kpi-hint">{hint}</small> : null}
      {trend ? (
        <span className={`kpi-trend kpi-trend-${direction}`} aria-label={`Trend ${direction} ${pct ?? ""}`.trim()}>
          <TrendIcon />
          {pct ? <span>{pct}</span> : null}
          {trend.label ? <span className="kpi-trend-label">{trend.label}</span> : null}
        </span>
      ) : null}
    </article>
  );
}

export default KpiCard;

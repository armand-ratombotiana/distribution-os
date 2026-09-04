"use client";

import { useMemo, type ReactNode } from "react";

export type ChartCardType = "bar" | "line";

export type ChartDatum = {
  /** Bar / point label rendered on the x-axis. */
  label: string;
  /** Numeric value. Must be finite. Negative values are clamped to 0. */
  value: number;
  /** Optional secondary text rendered under the value (e.g. unit). */
  hint?: string;
};

export type ChartCardProps = {
  /** Card title rendered in the panel header. */
  title: string;
  /** Optional eyebrow / kicker above the title. */
  eyebrow?: string;
  /** Series to render. Empty arrays render the empty state. */
  data: ChartDatum[];
  /** Chart variant. Defaults to `bar`. */
  type?: ChartCardType;
  /** Optional supporting content rendered under the chart (legend, totals). */
  footer?: ReactNode;
  /** Optional test id for snapshot / a11y targeting. */
  testId?: string;
};

/**
 * Reusable, dependency-free chart card. Renders a bar or line chart
 * using pure CSS (flexbox bars + an SVG polyline). The component is
 * intentionally lightweight — it does not pull in recharts/chart.js —
 * so it stays fast on the workspace overview and renders crisply in
 * snapshot tests.
 *
 * Heights scale from the maximum datum value (or 1 when all values are
 * 0 so the chart still renders a baseline). Negative values are
 * clamped to 0 — the panels that feed this card only ever surface
 * non-negative counts.
 */
export function ChartCard({
  title,
  eyebrow,
  data,
  type = "bar",
  footer,
  testId,
}: ChartCardProps) {
  const safeData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        value: Number.isFinite(item.value) && item.value > 0 ? item.value : 0,
      })),
    [data],
  );

  const maxValue = useMemo(
    () => safeData.reduce((max, item) => (item.value > max ? item.value : max), 0),
    [safeData],
  );

  const total = useMemo(
    () => safeData.reduce((sum, item) => sum + item.value, 0),
    [safeData],
  );

  const scale = maxValue > 0 ? maxValue : 1;

  return (
    <article className="chart-card ws-card" data-testid={testId} data-chart-type={type}>
      <header className="chart-card-head">
        <div>
          {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
          <h3>{title}</h3>
        </div>
        <span className="chart-card-total">{total}</span>
      </header>

      {safeData.length === 0 ? (
        <div className="chart-card-empty">No data points yet.</div>
      ) : type === "line" ? (
        <LineChart data={safeData} scale={scale} />
      ) : (
        <BarChart data={safeData} scale={scale} />
      )}

      {footer ? <footer className="chart-card-foot">{footer}</footer> : null}
    </article>
  );
}

type ChartProps = {
  data: ChartDatum[];
  scale: number;
};

function BarChart({ data, scale }: ChartProps) {
  return (
    <div className="chart-bar-track" role="img" aria-label="Bar chart">
      {data.map((item) => {
        const heightPct = scale > 0 ? (item.value / scale) * 100 : 0;
        return (
          <div className="chart-bar-col" key={`${item.label}-${item.value}`}>
            <div className="chart-bar-value">{formatValue(item.value)}</div>
            <div className="chart-bar-rail">
              <div
                className="chart-bar-fill"
                style={{ height: `${Math.max(2, heightPct)}%` }}
              />
            </div>
            <div className="chart-bar-label">{item.label}</div>
            {item.hint ? <div className="chart-bar-hint">{item.hint}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data, scale }: ChartProps) {
  const width = 320;
  const height = 120;
  const pad = 8;
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;

  const points = data.map((item, index) => {
    const x = data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth;
    const y = innerHeight - (scale > 0 ? (item.value / scale) * innerHeight : 0);
    return [pad + x, pad + y] as const;
  });

  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  return (
    <div className="chart-line-wrap" role="img" aria-label="Line chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="chart-line-svg"
        aria-hidden="true"
      >
        <path d={path} className="chart-line-path" />
        {points.map(([x, y], index) => (
          <circle
            key={`${data[index]?.label}-${index}`}
            cx={x}
            cy={y}
            r={2.5}
            className="chart-line-point"
          />
        ))}
      </svg>
      <div className="chart-line-labels">
        {data.map((item) => (
          <div key={`${item.label}-${item.value}`} className="chart-line-label">
            <span>{item.label}</span>
            <strong>{formatValue(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

export default ChartCard;

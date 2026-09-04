/**
 * Pure market-research utilities.
 *
 * `MarketData` captures a TAM/SAM/SOM triple plus a sequence of time-stamped
 * data points. This module computes the total addressable market size
 * (`calculateMarketSize`), the trend direction over the data points
 * (`getTrendDirection`), and an overall demand score combining growth,
 * search-volume, and competition signals (`assessDemand`).
 *
 * No I/O, no side effects, deterministic.
 */

export type TrendDirection = "up" | "down" | "flat";

export interface MarketDataPoint {
  /** ISO date or period label. */
  period: string;
  /** Measured market size at this point (in dollars, users, etc.). */
  value: number;
}

export interface MarketData {
  /** Total addressable market. */
  tam: number;
  /** Serviceable addressable market. */
  sam: number;
  /** Serviceable obtainable market. */
  som: number;
  /** Time-series of market-size measurements. */
  dataPoints: MarketDataPoint[];
  /** Normalized search-volume signal in `[0, 1]`. */
  searchVolume?: number;
  /** Normalized competition-density signal in `[0, 1]`. */
  competition?: number;
}

export interface DemandAssessment {
  /** Composite demand score in `[0, 100]`. */
  score: number;
  /** Letter grade A/B/C/D. */
  grade: "A" | "B" | "C" | "D";
}

function safeNum(n: unknown, fallback = 0): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return n;
}

function safePoints(p: unknown): MarketDataPoint[] {
  if (!Array.isArray(p)) return [];
  return p.filter(
    (x): x is MarketDataPoint =>
      x !== null && typeof x === "object" &&
      typeof (x as MarketDataPoint).period === "string" &&
      typeof (x as MarketDataPoint).value === "number" &&
      Number.isFinite((x as MarketDataPoint).value),
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Compute the total market size as the sum of TAM, SAM, and SOM. Each
 * component is clamped to `[0, ∞)`. Returns `0` for invalid input.
 */
export function calculateMarketSize(data: MarketData): number {
  if (!data) return 0;
  const tam = Math.max(0, safeNum(data.tam));
  const sam = Math.max(0, safeNum(data.sam));
  const som = Math.max(0, safeNum(data.som));
  return tam + sam + som;
}

/**
 * Determine the trend direction of `dataPoints`:
 *   - `"up"`   when the last value is > first value by more than 1%
 *   - `"down"` when the last value is < first value by more than 1%
 *   - `"flat"` otherwise (or for < 2 data points)
 */
export function getTrendDirection(data: MarketData): TrendDirection {
  if (!data) return "flat";
  const points = safePoints(data.dataPoints);
  if (points.length < 2) return "flat";
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first === 0) {
    if (last > 0) return "up";
    if (last < 0) return "down";
    return "flat";
  }
  const delta = (last - first) / Math.abs(first);
  if (delta > 0.01) return "up";
  if (delta < -0.01) return "down";
  return "flat";
}

/**
 * Compute a composite demand score in `[0, 100]`:
 *
 *   score = 0.4 × growthPct + 0.3 × (searchVolume × 100)
 *         + 0.3 × ((1 - competition) × 100)
 *
 * where `growthPct` is the percentage change from the first to the last
 * data point, clamped to `[0, 100]`. Returns `{ score, grade }` with
 * grade A (80+), B (60–79), C (40–59), D (<40).
 */
export function assessDemand(data: MarketData): DemandAssessment {
  const empty: DemandAssessment = { score: 0, grade: "D" };
  if (!data) return empty;
  const points = safePoints(data.dataPoints);
  let growthPct = 0;
  if (points.length >= 2) {
    const first = points[0].value;
    const last = points[points.length - 1].value;
    if (first !== 0) {
      growthPct = ((last - first) / Math.abs(first)) * 100;
    } else if (last > 0) {
      growthPct = 100;
    }
  }
  const growth = clamp100(growthPct);
  const search = clamp01(safeNum(data.searchVolume, 0.5));
  const comp = clamp01(safeNum(data.competition, 0.5));
  const score = clamp100(
    0.4 * growth + 0.3 * (search * 100) + 0.3 * ((1 - comp) * 100),
  );
  let grade: "A" | "B" | "C" | "D" = "D";
  if (score >= 80) grade = "A";
  else if (score >= 60) grade = "B";
  else if (score >= 40) grade = "C";
  return { score, grade };
}

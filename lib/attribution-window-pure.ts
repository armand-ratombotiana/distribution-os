/**
 * Pure attribution-window utilities.
 *
 * An attribution window is the period after a touchpoint during which a
 * conversion can still be credited to that touchpoint. Windows are
 * expressed in milliseconds since the touchpoint and may be defined either
 * as a single forward window or as a pair `(startMs, endMs)` that lets the
 * caller exclude an initial delay.
 *
 * No I/O, no side effects, deterministic.
 */

export type AttributionWindowUnit = "ms" | "second" | "minute" | "hour" | "day" | "week";

export interface AttributionWindow {
  /**
   * Length of the window. Interpreted in `unit`.
   */
  length: number;
  /**
   * Unit for `length`. Defaults to `"day"`.
   */
  unit?: AttributionWindowUnit;
  /**
   * Optional delay (in the same `unit`) before the window opens. Useful for
   * "view-through after 1 hour, lasts 7 days" style windows. Defaults to 0.
   */
  startOffset?: number;
}

const MS_PER_UNIT: Record<AttributionWindowUnit, number> = {
  ms: 1,
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

/**
 * Convert a window length expressed in `unit` to milliseconds. Returns `0`
 * for invalid or non-positive lengths.
 */
export function windowToMs(window: AttributionWindow): number {
  if (!window) return 0;
  const unit = window.unit ?? "day";
  const factor = MS_PER_UNIT[unit] ?? MS_PER_UNIT.day;
  const length = typeof window.length === "number" ? window.length : NaN;
  if (!Number.isFinite(length) || length < 0) return 0;
  return length * factor;
}

/**
 * Convert the start offset (delay before the window opens) to milliseconds.
 */
export function startOffsetToMs(window: AttributionWindow): number {
  if (!window) return 0;
  const unit = window.unit ?? "day";
  const factor = MS_PER_UNIT[unit] ?? MS_PER_UNIT.day;
  const offset = typeof window.startOffset === "number" ? window.startOffset : 0;
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return offset * factor;
}

/**
 * Return `true` when the conversion occurred inside the attribution window
 * relative to the touchpoint. The conversion timestamp must satisfy:
 *   touchpoint + startOffset <= conversion <= touchpoint + startOffset + length
 *
 * Negative deltas (conversions before the touchpoint) are never within the
 * window.
 */
export function isWithinWindow(
  touchpointMs: number,
  conversionMs: number,
  window: AttributionWindow,
): boolean {
  if (!Number.isFinite(touchpointMs) || !Number.isFinite(conversionMs)) {
    return false;
  }
  const delta = conversionMs - touchpointMs;
  if (delta < 0) return false;
  const start = startOffsetToMs(window);
  const length = windowToMs(window);
  if (length <= 0) return false;
  return delta >= start && delta <= start + length;
}

export interface WindowStatsInput {
  touchpointMs: number;
  conversionMs: number;
  window: AttributionWindow;
}

export interface WindowStats {
  /** Number of conversions that fell inside any window. */
  attributed: number;
  /** Number of conversions that fell outside every window. */
  unattributed: number;
  /** Total conversions considered. */
  total: number;
  /** Share of conversions attributed, in `[0, 1]`. */
  attributionRate: number;
  /** Average delta (ms) between touchpoint and attributed conversion. */
  averageLagMs: number;
}

/**
 * Compute aggregate attribution stats across a list of (touchpoint,
 * conversion, window) tuples. Returns zeros when the input is empty.
 */
export function calculateWindowStats(inputs: WindowStatsInput[]): WindowStats {
  const safe = Array.isArray(inputs) ? inputs : [];
  let attributed = 0;
  let unattributed = 0;
  let lagSum = 0;
  for (const item of safe) {
    if (!item || !item.window) {
      unattributed++;
      continue;
    }
    if (isWithinWindow(item.touchpointMs, item.conversionMs, item.window)) {
      attributed++;
      lagSum += item.conversionMs - item.touchpointMs;
    } else {
      unattributed++;
    }
  }
  const total = attributed + unattributed;
  return {
    attributed,
    unattributed,
    total,
    attributionRate: total > 0 ? attributed / total : 0,
    averageLagMs: attributed > 0 ? lagSum / attributed : 0,
  };
}

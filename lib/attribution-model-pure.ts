/**
 * Pure attribution model utilities.
 *
 * No I/O, no side effects. Each function takes a list of touchpoints and
 * returns a list of { touchpoint, credit } pairs whose credits sum to 1
 * (unless the input is empty, in which case an empty array is returned).
 */

export type Touchpoint = {
  id: string;
  channel: string;
  /** Epoch milliseconds. */
  timestamp: number;
  weight?: number;
};

export type AttributionResult = {
  touchpoint: Touchpoint;
  /** Share of conversion credit, in the range [0, 1]. */
  credit: number;
};

export type AttributionModel =
  | "first_touch"
  | "last_touch"
  | "linear"
  | "time_decay"
  | "position_based";

const EPSILON = 1e-9;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function sortByTimestampAscending(touchpoints: Touchpoint[]): Touchpoint[] {
  return [...touchpoints].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * First-touch attribution: 100% of credit goes to the earliest touchpoint.
 */
export function firstTouchAttribution(touchpoints: Touchpoint[]): AttributionResult[] {
  if (touchpoints.length === 0) return [];
  const first = sortByTimestampAscending(touchpoints)[0];
  return [{ touchpoint: first, credit: 1 }];
}

/**
 * Last-touch attribution: 100% of credit goes to the latest touchpoint.
 */
export function lastTouchAttribution(touchpoints: Touchpoint[]): AttributionResult[] {
  if (touchpoints.length === 0) return [];
  const sorted = sortByTimestampAscending(touchpoints);
  const last = sorted[sorted.length - 1];
  return [{ touchpoint: last, credit: 1 }];
}

/**
 * Linear attribution: equal credit to every touchpoint.
 */
export function linearAttribution(touchpoints: Touchpoint[]): AttributionResult[] {
  if (touchpoints.length === 0) return [];
  const credit = 1 / touchpoints.length;
  return touchpoints.map((touchpoint) => ({ touchpoint, credit }));
}

/**
 * Time-decay attribution: later touchpoints receive exponentially more credit
 * than earlier ones, with a configurable half-life (default 7 days).
 */
export function timeDecayAttribution(
  touchpoints: Touchpoint[],
  halfLifeDays = 7,
): AttributionResult[] {
  if (touchpoints.length === 0) return [];
  const sorted = sortByTimestampAscending(touchpoints);
  const latest = sorted[sorted.length - 1].timestamp;
  const halfLifeMs = Math.max(halfLifeDays, 0) * MS_PER_DAY;

  const weights = sorted.map((tp) => {
    if (halfLifeMs <= 0) return 1;
    const distance = Math.max(0, latest - tp.timestamp);
    return Math.pow(0.5, distance / halfLifeMs);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total < EPSILON) {
    const credit = 1 / sorted.length;
    return sorted.map((touchpoint) => ({ touchpoint, credit }));
  }
  return sorted.map((touchpoint, i) => ({
    touchpoint,
    credit: weights[i] / total,
  }));
}

/**
 * Position-based (U-shaped) attribution:
 *   - 40% to the first touchpoint
 *   - 40% to the last touchpoint
 *   - the remaining 20% split evenly across any middle touchpoints
 *
 * Edge cases:
 *   - single touchpoint → 100%
 *   - two touchpoints → 50% / 50%
 */
export function positionBasedAttribution(touchpoints: Touchpoint[]): AttributionResult[] {
  if (touchpoints.length === 0) return [];
  const sorted = sortByTimestampAscending(touchpoints);
  const n = sorted.length;
  if (n === 1) return [{ touchpoint: sorted[0], credit: 1 }];
  if (n === 2) {
    return [
      { touchpoint: sorted[0], credit: 0.5 },
      { touchpoint: sorted[1], credit: 0.5 },
    ];
  }
  const middleCredit = 0.2 / (n - 2);
  return sorted.map((touchpoint, i) => {
    if (i === 0) return { touchpoint, credit: 0.4 };
    if (i === n - 1) return { touchpoint, credit: 0.4 };
    return { touchpoint, credit: middleCredit };
  });
}

/**
 * Dispatcher: run the requested attribution model against the touchpoints.
 */
export function runAttribution(
  model: AttributionModel,
  touchpoints: Touchpoint[],
  options?: { halfLifeDays?: number },
): AttributionResult[] {
  switch (model) {
    case "first_touch":
      return firstTouchAttribution(touchpoints);
    case "last_touch":
      return lastTouchAttribution(touchpoints);
    case "linear":
      return linearAttribution(touchpoints);
    case "time_decay":
      return timeDecayAttribution(touchpoints, options?.halfLifeDays);
    case "position_based":
      return positionBasedAttribution(touchpoints);
    default:
      return [];
  }
}

/**
 * Human-readable label for an attribution model.
 */
export function getModelLabel(model: AttributionModel): string {
  switch (model) {
    case "first_touch":
      return "First Touch";
    case "last_touch":
      return "Last Touch";
    case "linear":
      return "Linear";
    case "time_decay":
      return "Time Decay";
    case "position_based":
      return "Position Based (U-Shaped)";
    default:
      return "Unknown";
  }
}

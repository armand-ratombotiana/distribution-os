/**
 * Pure numeric utility functions. All functions are side-effect free;
 * `random` accepts an optional `rng` so it can be made deterministic in
 * tests.
 */

/**
 * Clamp `value` into the inclusive range `[min, max]`.
 *
 *   clamp(5, 1, 10)   // 5
 *   clamp(-1, 1, 10)  // 1
 *   clamp(99, 1, 10)  // 10
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (Number.isNaN(min) || Number.isNaN(max)) return value;
  if (min > max) {
    // Swap so the contract still holds.
    return Math.min(Math.max(value, max), min);
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Round `value` to `decimals` decimal places using the standard
 * "round half away from zero" rule (the rule most users expect).
 *
 * Internally uses string-based exponential conversion so that floating-
 * point representation errors (e.g. `1.005 * 100 === 100.49999999999999`)
 * do not affect the result.
 *
 *   round(1.5)        // 2
 *   round(1.005, 2)   // 1.01
 *   round(-1.5)       // -2
 */
export function round(value: number, decimals: number = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) return NaN;
  if (!Number.isInteger(decimals) || decimals < 0) return NaN;
  // String conversion produces the shortest decimal representation, which
  // side-steps the floating-point representation error of the original
  // number (e.g. `1.005 * 100 === 100.49999999999999`).
  const magnitude = value >= 0 ? value : -value;
  const shifted = Number(`${magnitude}e+${decimals}`);
  if (!Number.isFinite(shifted)) return NaN;
  const rounded = Math.round(shifted);
  const result = Number(`${rounded}e-${decimals}`);
  return value >= 0 ? result : -result;
}

/**
 * Return a random integer in the inclusive range `[min, max]`.
 *
 * The optional `rng` defaults to `Math.random` and must return a float
 * in `[0, 1)`. Useful for deterministic tests.
 */
export function random(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("random: min and max must be finite numbers");
  }
  if (min > max) {
    const t = min;
    min = max;
    max = t;
  }
  const inclusive = max - min + 1;
  return Math.floor(rng() * inclusive) + min;
}

/**
 * Generate an array of integers `[start, end)` (or `[end, start)` when
 * `end < start`). The optional `step` (default 1) controls the spacing.
 *
 *   range(1, 5)        // [1, 2, 3, 4]
 *   range(0, 10, 2)    // [0, 2, 4, 6, 8]
 *   range(5, 1)        // [5, 4, 3, 2]
 */
export function range(start: number, end: number, step: number = 1): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step)) {
    return [];
  }
  if (step === 0) return [];
  const out: number[] = [];
  if (step > 0) {
    if (start <= end) {
      for (let i = start; i < end; i += step) out.push(i);
    } else {
      for (let i = start; i > end; i -= step) out.push(i);
    }
  } else {
    // Negative step.
    if (start >= end) {
      for (let i = start; i > end; i += step) out.push(i);
    } else {
      for (let i = start; i < end; i -= step) out.push(i);
    }
  }
  return out;
}

/**
 * Return the sum of all numeric items. Non-numeric items are ignored.
 *
 *   sum([1, 2, 3])     // 6
 *   sum([])            // 0
 */
export function sum(items: readonly number[]): number {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const item of items) {
    if (typeof item === "number" && !Number.isNaN(item)) total += item;
  }
  return total;
}

/**
 * Return the arithmetic mean. Returns `NaN` for an empty input.
 */
export function average(items: readonly number[]): number {
  if (!Array.isArray(items) || items.length === 0) return NaN;
  return sum(items) / items.length;
}

/**
 * Return the median of the items. For an even count, returns the
 * arithmetic mean of the two middle values. Returns `NaN` for empty input.
 */
export function median(items: readonly number[]): number {
  if (!Array.isArray(items) || items.length === 0) return NaN;
  const sorted = items
    .filter((x) => typeof x === "number" && !Number.isNaN(x))
    .slice()
    .sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export type FormatNumberOptions = {
  /** Number of decimal places to retain. Default 0. */
  decimals?: number;
  /** Thousands separator. Default `,`. */
  thousandsSeparator?: string;
  /** Decimal separator. Default `.`. */
  decimalSeparator?: string;
};

/**
 * Format `value` with grouped thousands and a configurable decimal
 * separator.
 *
 *   formatNumber(1234567.891, { decimals: 2 })  // "1,234,567.89"
 *   formatNumber(1234567, { thousandsSeparator: " " })
 *   // "1 234 567"
 */
export function formatNumber(
  value: number,
  options: FormatNumberOptions = {},
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "NaN";
  const {
    decimals = 0,
    thousandsSeparator = ",",
    decimalSeparator = ".",
  } = options;
  if (!Number.isInteger(decimals) || decimals < 0) return "NaN";

  const negative = value < 0;
  const abs = Math.abs(value);
  const rounded = round(abs, decimals);
  const fixed = rounded.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");

  // Group the integer part in threes from the right.
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  const out =
    decPart !== undefined && decPart.length > 0
      ? `${grouped}${decimalSeparator}${decPart}`
      : grouped;
  return negative ? `-${out}` : out;
}

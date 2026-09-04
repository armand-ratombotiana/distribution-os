/**
 * Pure color utility helpers — no DOM or runtime dependencies.
 * All functions operate on hex strings (#rgb / #rrggbb) and {r,g,b} tuples.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_SHORT_RE = /^#?([a-f0-9]{3})$/i;
const HEX_LONG_RE = /^#?([a-f0-9]{6})$/i;

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexChannel(value: number): string {
  return clampChannel(value).toString(16).padStart(2, "0");
}

/** Parses a hex color string (#rgb or #rrggbb) into an {r,g,b} tuple. */
export function hexToRgb(hex: string): Rgb {
  if (typeof hex !== "string") {
    throw new Error(`hexToRgb expects a string, received ${typeof hex}`);
  }
  const short = hex.match(HEX_SHORT_RE);
  if (short) {
    const [, h] = short;
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  const long = hex.match(HEX_LONG_RE);
  if (long) {
    const [, h] = long;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

/** Converts an {r,g,b} tuple into a #rrggbb hex string. */
export function rgbToHex(rgb: Rgb): string {
  if (!rgb || typeof rgb !== "object") {
    throw new Error("rgbToHex expects an {r,g,b} object");
  }
  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`;
}

/**
 * Mixes two hex colors by the given ratio (0..1). 0 returns `base`,
 * 1 returns `target`. Mixes in linear RGB space.
 */
export function mix(base: string, target: string, ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/** Lightens a hex color toward white by `ratio` (0..1). */
export function lighten(hex: string, ratio: number): string {
  return mix(hex, "#ffffff", ratio);
}

/** Darkens a hex color toward black by `ratio` (0..1). */
export function darken(hex: string, ratio: number): string {
  return mix(hex, "#000000", ratio);
}

/**
 * Returns the relative luminance (0..1) using the sRGB → linear transform
 * from WCAG 2.x. Higher values mean brighter colors.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Returns the WCAG contrast ratio (1..21) between two hex colors.
 * 1 = identical, 21 = black-on-white.
 */
export function getContrast(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns true when the color is brighter than mid-gray (luminance > 0.5). */
export function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.5;
}

/** Returns true when the color is darker than or equal to mid-gray. */
export function isDark(hex: string): boolean {
  return !isLight(hex);
}

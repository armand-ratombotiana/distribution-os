/**
 * Pure accessibility helpers. No DOM access, no globals beyond a single
 * module-level id counter (reset only via internal API in tests if needed).
 */

let a11yCounter = 0;

/** Returns a unique, stable-for-session id suitable for aria attributes. */
export function generateA11yId(prefix = "a11y"): string {
  a11yCounter += 1;
  return `${prefix}-${a11yCounter.toString(36)}`;
}

export type StatusKind =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "idle"
  | "loading";

const STATUS_LABELS: Record<StatusKind, string> = {
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Information",
  idle: "Idle",
  loading: "Loading",
};

const STATUS_COLORS: Record<StatusKind, string> = {
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  info: "#2563eb",
  idle: "#6b7280",
  loading: "#7c3aed",
};

/** Returns a human-readable label for a status kind. */
export function getStatusLabel(status: StatusKind): string {
  return STATUS_LABELS[status] ?? String(status);
}

/** Returns a hex color token for a status kind. */
export function getStatusColor(status: StatusKind): string {
  return STATUS_COLORS[status] ?? "#6b7280";
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (full.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Computes the WCAG contrast ratio between two hex colors. The ratio is
 * always >= 1 (1 = identical, 21 = max contrast).
 */
export function getContrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(hexToRgb(foreground));
  const bg = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns true if a contrast ratio meets WCAG AA for the given text size. */
export function meetsWCAGAA(ratio: number, large = false): boolean {
  return ratio >= (large ? 3 : 4.5);
}

/** Returns true if a contrast ratio meets WCAG AAA for the given text size. */
export function meetsWCAGAAA(ratio: number, large = false): boolean {
  return ratio >= (large ? 4.5 : 7);
}

export type KeyboardShortcut = {
  key: string;
  description: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
};

/** Returns the catalog of keyboard shortcuts surfaced by the application. */
export function getKeyboardShortcuts(): KeyboardShortcut[] {
  return [
    { key: "/", description: "Focus search" },
    { key: "k", description: "Open command palette", ctrlOrCmd: true },
    { key: "Enter", description: "Submit current form" },
    { key: "Escape", description: "Close active dialog" },
    { key: "?", description: "Show keyboard shortcuts", shift: true },
    { key: "g", description: "Go to dashboard", ctrlOrCmd: true },
  ];
}

/**
 * Builds a polite screen-reader announcement for a status. When `context`
 * is provided, it is appended after a colon for clarity.
 */
export function getAnnouncementMessage(
  state: StatusKind,
  context?: string,
): string {
  const label = STATUS_LABELS[state] ?? String(state);
  return context ? `${label}: ${context}` : label;
}

/** Returns true if the given status should be announced to assistive tech. */
export function shouldAnnounce(state: StatusKind): boolean {
  return state !== "idle";
}

/**
 * Joins a sequence of strings/numbers into a single screen-reader sentence,
 * skipping empty values. Useful for building descriptive labels from parts.
 */
export function getScreenReaderText(
  ...parts: Array<string | number | null | undefined>
): string {
  return parts
    .filter(
      (p): p is string | number =>
        p !== null && p !== undefined && p !== "",
    )
    .map((p) => String(p))
    .join(", ");
}

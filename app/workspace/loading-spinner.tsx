"use client";

import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type LoadingSpinnerSize = "sm" | "md" | "lg";

export type LoadingSpinnerProps = {
  /** Spinner diameter. Defaults to `md` (24px). */
  size?: LoadingSpinnerSize;
  /** Optional label rendered next to the spinner. */
  label?: string;
  /** Optional className for the wrapping element. */
  className?: string;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

const sizeClass: Record<LoadingSpinnerSize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

const labelSizeClass: Record<LoadingSpinnerSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

/**
 * Reusable loading spinner used by every workspace panel while data is
 * in flight. Renders a spinning `LoaderCircle` glyph from lucide-react
 * alongside an optional human-readable label. The wrapper carries
 * `role="status"` and `aria-live="polite"` so screen readers announce
 * the loading state without interrupting the user.
 */
export function LoadingSpinner({
  size = "md",
  label,
  className,
  testId,
}: LoadingSpinnerProps) {
  return (
    <span
      className={cn("loading-spinner inline-flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
      data-testid={testId}
      data-size={size}
    >
      <LoaderCircle className={cn("animate-spin", sizeClass[size])} aria-hidden="true" />
      {label ? (
        <span className={cn("loading-spinner-label", labelSizeClass[size])}>{label}</span>
      ) : null}
      <span className="sr-only">Loading{label ? `: ${label}` : "…"}</span>
    </span>
  );
}

export default LoadingSpinner;

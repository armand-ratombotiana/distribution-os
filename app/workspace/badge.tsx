"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export type BadgeProps = {
  /** Visual variant. Defaults to `default`. */
  variant?: BadgeVariant;
  children: ReactNode;
  /** Optional className override / extension. */
  className?: string;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

const variantClass: Record<BadgeVariant, string> = {
  default: "ws-badge ws-badge-default bg-primary text-primary-foreground",
  success: "ws-badge ws-badge-success bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "ws-badge ws-badge-warning bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  danger: "ws-badge ws-badge-danger bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  info: "ws-badge ws-badge-info bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  neutral: "ws-badge ws-badge-neutral bg-muted text-muted-foreground",
};

/**
 * Reusable status badge for the workspace UI. Six variants cover the
 * common states (ok / warning / danger / info / neutral / default).
 * The badge is intentionally lightweight — it does not pull in the
 * shadcn `Badge` primitive because the workspace panels use a flatter
 * pill style that composes better with the existing `ws-*` classes.
 */
export function Badge({ variant = "default", children, className, testId }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        variantClass[variant],
        className,
      )}
      data-variant={variant}
      data-testid={testId}
    >
      {children}
    </span>
  );
}

export default Badge;

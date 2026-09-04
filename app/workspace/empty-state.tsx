"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export type EmptyStateProps = {
  /** Optional leading icon. Defaults to a friendly Sparkles glyph. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional CTA rendered as a slot so callers can drop in any element. */
  action?: ReactNode;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

/**
 * Reusable friendly empty state used by every workspace panel when a list
 * is loaded but contains no rows. The shell is intentionally generic so it
 * composes with the existing `ws-empty` look without duplicating layout.
 */
export function EmptyState({ icon: Icon, title, description, action, testId }: EmptyStateProps) {
  const Glyph = Icon ?? Sparkles;
  return (
    <div className="empty-state" role="status" data-testid={testId}>
      <span className="empty-state-icon" aria-hidden="true">
        <Glyph />
      </span>
      <div className="empty-state-body">
        <strong className="empty-state-title">{title}</strong>
        {description ? <p className="empty-state-desc">{description}</p> : null}
        {action ? <div className="empty-state-action">{action}</div> : null}
      </div>
    </div>
  );
}

export default EmptyState;

"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type TabItem = {
  /** Stable identifier — passed to `onChange` when the tab is clicked. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** When `true`, the tab is rendered but disabled. */
  disabled?: boolean;
};

export type TabsProps = {
  tabs: TabItem[];
  /** The id of the currently active tab. */
  active: string;
  /** Fired with the new tab id when the user clicks a tab. */
  onChange: (id: string) => void;
  /** Optional className for the nav element. */
  className?: string;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

/**
 * Reusable horizontal tab navigation for the workspace UI. Renders a
 * list of buttons (one per tab) and highlights the active one. Keyboard
 * accessible — each tab is a real `<button>` with `aria-selected`.
 *
 * The component is fully controlled: the parent owns the `active` id
 * and decides what to render in the body.
 */
export function Tabs({ tabs, active, onChange, className, testId }: TabsProps) {
  return (
    <nav
      className={cn("ws-tabs", className)}
      role="tablist"
      aria-label="Workspace sections"
      data-testid={testId}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            disabled={tab.disabled}
            className={cn(
              "ws-tab",
              isActive && "ws-tab-active",
              tab.disabled && "ws-tab-disabled",
            )}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id);
            }}
          >
            {Icon ? (
              <span className="ws-tab-icon" aria-hidden="true">
                <Icon />
              </span>
            ) : null}
            <span className="ws-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default Tabs;

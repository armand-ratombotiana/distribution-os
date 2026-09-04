"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchInputProps = {
  /** Controlled value (the debounced value the parent sees). */
  value: string;
  /** Fired with the new debounced value after `debounceMs` elapses. */
  onChange: (value: string) => void;
  /** Optional placeholder. Defaults to "Search…". */
  placeholder?: string;
  /** Debounce delay in milliseconds. Defaults to 250. */
  debounceMs?: number;
  /** Optional ARIA label for the input. */
  ariaLabel?: string;
  /** Optional className for the wrapping element. */
  className?: string;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

/**
 * Reusable debounced search input. The parent owns the canonical
 * `value` (the debounced value used to filter or fetch), while this
 * component owns an intermediate "draft" state so typing stays
 * responsive. After `debounceMs` of inactivity, the draft is committed
 * via `onChange`.
 *
 * The cleanup function in the effect clears the pending timer — the
 * cancelled-flag pattern adapted for a non-async effect — so a stale
 * timer can never fire `onChange` after the component has unmounted or
 * the draft has moved on.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 250,
  ariaLabel = "Search",
  className,
  testId,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const lastCommitted = useRef(value);

  // Keep the draft in sync when the parent's canonical value changes
  // externally (e.g. a "clear" button). Uses the cancelled-flag pattern
  // via the cleanup return.
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setDraft(value);
    }
  }, [value]);

  // Debounce the draft → onChange commit. The cleanup clears the pending
  // timer so a stale commit cannot land after unmount or after the user
  // has typed more characters.
  useEffect(() => {
    if (draft === lastCommitted.current) return;
    const timer = setTimeout(() => {
      lastCommitted.current = draft;
      onChange(draft);
    }, Math.max(0, debounceMs));
    return () => {
      clearTimeout(timer);
    };
  }, [draft, debounceMs, onChange]);

  return (
    <div className={cn("search-input", className)} data-testid={testId}>
      <Search className="search-input-icon" aria-hidden="true" />
      <input
        type="search"
        className="search-input-field"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft ? (
        <button
          type="button"
          className="search-input-clear"
          aria-label="Clear search"
          onClick={() => {
            lastCommitted.current = "";
            setDraft("");
            onChange("");
          }}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export default SearchInput;

/**
 * Pure lazy-loading / pagination helpers for virtualized lists.
 *
 * No I/O, no D1, no globals. Every function is a pure function of its
 * inputs.
 */

export interface PageBounds {
  start: number;
  /** Exclusive end. */
  end: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Compute the [start, end) range for a page of items.
 *
 * Pages are 1-indexed. `page` is clamped to `[1, totalPages]`. `pageSize`
 * is clamped to a minimum of 1. `totalItems` is clamped to a minimum of 0.
 * An empty table yields `totalPages = 1` so callers always have a valid
 * page to land on.
 */
export function getPageBounds(
  page: number,
  pageSize: number,
  totalItems: number,
): PageBounds {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safeTotal = Math.max(0, Math.floor(totalItems));
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * safePageSize;
  const end = Math.min(safeTotal, start + safePageSize);
  return {
    start,
    end,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

/**
 * Decide whether more items should be loaded. Returns `true` when any part
 * of the visible window falls outside the currently-loaded range. An empty
 * visible window (visibleEnd <= visibleStart) returns `false`.
 */
export function shouldLoad(
  visibleStart: number,
  visibleEnd: number,
  loadedStart: number,
  loadedEnd: number,
): boolean {
  if (visibleEnd <= visibleStart) return false;
  if (loadedEnd <= loadedStart) return true; // nothing loaded yet
  if (visibleStart < loadedStart) return true;
  if (visibleEnd > loadedEnd) return true;
  return false;
}

/**
 * Return the list of pages to prefetch given the current page and a
 * direction. `direction` is `-1` (back), `1` (forward), or `0` (both).
 * Pages are clamped to `[1, totalPages]`. The current page itself is never
 * included. Results are sorted ascending and deduped.
 */
export function calculatePrefetch(
  currentPage: number,
  direction: -1 | 0 | 1,
  prefetchPages: number,
  totalPages: number,
): number[] {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeCurrent = Math.min(
    Math.max(1, Math.floor(currentPage)),
    safeTotal,
  );
  const safePrefetch = Math.max(0, Math.floor(prefetchPages));
  const out = new Set<number>();
  if (direction <= 0) {
    for (let i = 1; i <= safePrefetch; i += 1) {
      const p = safeCurrent - i;
      if (p >= 1) out.add(p);
    }
  }
  if (direction >= 0) {
    for (let i = 1; i <= safePrefetch; i += 1) {
      const p = safeCurrent + i;
      if (p <= safeTotal) out.add(p);
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

/**
 * Return the load window that covers the visible viewport plus an
 * `overscan` buffer on each side. Both bounds are clamped to
 * `[0, totalItems]`.
 */
export function getOverscanWindow(
  visibleStart: number,
  visibleEnd: number,
  overscan: number,
  totalItems: number,
): { start: number; end: number } {
  const safeOverscan = Math.max(0, Math.floor(overscan));
  const safeTotal = Math.max(0, Math.floor(totalItems));
  const start = Math.max(0, visibleStart - safeOverscan);
  const end = Math.min(safeTotal, visibleEnd + safeOverscan);
  return { start, end };
}

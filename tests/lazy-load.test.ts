import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculatePrefetch,
  getOverscanWindow,
  getPageBounds,
  shouldLoad,
} from "../lib/lazy-load-pure.ts";

test("getPageBounds returns the correct range for a middle page", () => {
  const b = getPageBounds(2, 10, 35);
  assert.equal(b.start, 10);
  assert.equal(b.end, 20);
  assert.equal(b.page, 2);
  assert.equal(b.pageSize, 10);
  assert.equal(b.totalPages, 4);
  assert.equal(b.hasNext, true);
  assert.equal(b.hasPrev, true);
});

test("getPageBounds clamps page to [1, totalPages]", () => {
  // Page 0 → clamped to 1.
  assert.equal(getPageBounds(0, 10, 35).page, 1);
  // Page 99 → clamped to totalPages=4.
  assert.equal(getPageBounds(99, 10, 35).page, 4);
  // Empty table still has totalPages=1; page 1 is the only valid page.
  const empty = getPageBounds(1, 10, 0);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.page, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
});

test("getPageBounds reports hasNext and hasPrev correctly at the ends", () => {
  const first = getPageBounds(1, 10, 35);
  assert.equal(first.hasPrev, false);
  assert.equal(first.hasNext, true);
  const last = getPageBounds(4, 10, 35);
  assert.equal(last.hasPrev, true);
  assert.equal(last.hasNext, false);
});

test("getPageBounds handles the last partial page", () => {
  // 35 items / 10 per page → last page has 5 items.
  const last = getPageBounds(4, 10, 35);
  assert.equal(last.start, 30);
  assert.equal(last.end, 35);
  // 30 items / 10 per page → last page is full.
  const fullLast = getPageBounds(3, 10, 30);
  assert.equal(fullLast.start, 20);
  assert.equal(fullLast.end, 30);
});

test("shouldLoad returns true when the visible window extends past loaded data", () => {
  // Visible [50, 100), loaded [0, 80) → 80..100 not loaded.
  assert.equal(shouldLoad(50, 100, 0, 80), true);
  // Visible [50, 100), loaded [60, 80) → 50..60 not loaded.
  assert.equal(shouldLoad(50, 100, 60, 80), true);
});

test("shouldLoad returns false when the visible window is fully loaded", () => {
  assert.equal(shouldLoad(50, 100, 0, 100), false);
  assert.equal(shouldLoad(50, 100, 40, 110), false);
});

test("shouldLoad returns true when nothing is loaded yet and false for an empty window", () => {
  assert.equal(shouldLoad(0, 100, 0, 0), true);
  assert.equal(shouldLoad(50, 50, 0, 0), false); // empty window
});

test("calculatePrefetch returns pages in the forward direction", () => {
  // Current page 5, forward 3 pages, 10 total → [6, 7, 8].
  assert.deepEqual(calculatePrefetch(5, 1, 3, 10), [6, 7, 8]);
  // At the end, no forward pages available.
  assert.deepEqual(calculatePrefetch(10, 1, 3, 10), []);
});

test("calculatePrefetch returns pages in both directions when direction=0", () => {
  // Current page 5, both directions, 3 pages each, 10 total → [2, 3, 4, 6, 7, 8].
  assert.deepEqual(calculatePrefetch(5, 0, 3, 10), [2, 3, 4, 6, 7, 8]);
  // Backward direction only.
  assert.deepEqual(calculatePrefetch(5, -1, 3, 10), [2, 3, 4]);
});

test("calculatePrefetch clamps to [1, totalPages] and dedupes", () => {
  // Current page 2, both directions, 5 pages each → back: [1], forward: [3,4,5,6,7].
  assert.deepEqual(calculatePrefetch(2, 0, 5, 10), [1, 3, 4, 5, 6, 7]);
  // Current page 1, backward 3 → nothing (clamped to 1).
  assert.deepEqual(calculatePrefetch(1, -1, 3, 10), []);
  // Oversized prefetch clamps to totalPages.
  assert.deepEqual(calculatePrefetch(5, 1, 100, 10), [6, 7, 8, 9, 10]);
  // Overscan window helper clamps to [0, totalItems].
  assert.deepEqual(getOverscanWindow(50, 100, 20, 90), { start: 30, end: 90 });
  assert.deepEqual(getOverscanWindow(0, 10, 20, 100), { start: 0, end: 30 });
});

/**
 * Property-based pagination tests.
 *
 * 15 tests covering `lib/pagination-pure.ts`:
 *   - `parsePaginationParams` — clamps page/limit, accepts page/pageSize.
 *   - `getOffset`             — `(page - 1) * limit` with floor + max(1, …).
 *   - `buildPaginationMeta`   — totalPages, hasNextPage, hasPrevPage.
 *   - `paginate`              — slices items correctly.
 *   - `buildPaginationLinks`  — HATEOAS link shape.
 *
 * Properties verified:
 *   - Offset correctness — `getOffset(page, limit) === (page - 1) * limit`
 *     for valid (page ≥ 1, limit ≥ 1) inputs.
 *   - Page bounds — page < 1 normalises to 1; limit < 1 normalises to
 *     DEFAULT_PAGE_SIZE; limit > MAX_PAGE_SIZE clamps to MAX_PAGE_SIZE.
 *   - Limit clamping — `parsePaginationParams` always returns a limit in
 *     `[1, MAX_PAGE_SIZE]` (when input is valid) or DEFAULT_PAGE_SIZE.
 *
 * Inputs are produced by a deterministic seeded PRNG (mulberry32).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parsePaginationParams,
  getOffset,
  buildPaginationMeta,
  paginate,
  buildPaginationLinks,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../lib/pagination-pure.ts";

// ─── seeded PRNG ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const SAMPLES = 200;

// ─── 1. parsePaginationParams: valid inputs round-trip ────────────────────

test("property/page-parse: valid page and limit round-trip exactly", () => {
  const rng = mulberry32(801);
  for (let i = 0; i < SAMPLES; i++) {
    const page = randomInt(rng, 1, 1000);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const r = parsePaginationParams({ page, limit });
    assert.equal(r.page, page);
    assert.equal(r.limit, limit);
  }
});

// ─── 2. parsePaginationParams: page < 1 normalises to 1 ───────────────────

test("property/page-parse: page < 1 (zero, negative, NaN-string) normalises to 1", () => {
  const rng = mulberry32(802);
  for (let i = 0; i < SAMPLES; i++) {
    const badPage = pick(rng, [0, -1, -100, "-1", "0", "abc", "", null, undefined]);
    const r = parsePaginationParams({ page: badPage, limit: 20 });
    assert.equal(r.page, 1);
  }
});

// ─── 3. parsePaginationParams: limit clamps to MAX_PAGE_SIZE ──────────────

test("property/page-parse: limit > MAX_PAGE_SIZE clamps to MAX_PAGE_SIZE", () => {
  const rng = mulberry32(803);
  for (let i = 0; i < SAMPLES; i++) {
    const hugeLimit = randomInt(rng, MAX_PAGE_SIZE + 1, MAX_PAGE_SIZE * 100);
    const r = parsePaginationParams({ page: 1, limit: hugeLimit });
    assert.equal(r.limit, MAX_PAGE_SIZE);
  }
});

// ─── 4. parsePaginationParams: limit < 1 normalises to DEFAULT_PAGE_SIZE ──

test("property/page-parse: limit < 1 (zero, negative, NaN-string) normalises to DEFAULT_PAGE_SIZE", () => {
  const rng = mulberry32(804);
  for (let i = 0; i < SAMPLES; i++) {
    const badLimit = pick(rng, [0, -1, -50, "0", "-1", "abc", "", null, undefined]);
    const r = parsePaginationParams({ page: 1, limit: badLimit });
    assert.equal(r.limit, DEFAULT_PAGE_SIZE);
  }
});

// ─── 5. parsePaginationParams: accepts both `limit` and `pageSize` keys ───

test("property/page-parse: pageSize is accepted as an alias for limit", () => {
  const rng = mulberry32(805);
  for (let i = 0; i < SAMPLES; i++) {
    const pageSize = randomInt(rng, 1, MAX_PAGE_SIZE);
    const r = parsePaginationParams({ page: 1, pageSize });
    assert.equal(r.limit, pageSize);
  }
});

// ─── 6. parsePaginationParams: numeric strings are accepted ───────────────

test("property/page-parse: numeric strings (e.g. '5') are parsed to integers", () => {
  const rng = mulberry32(806);
  for (let i = 0; i < SAMPLES; i++) {
    const page = randomInt(rng, 1, 100);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const r = parsePaginationParams({ page: String(page), limit: String(limit) });
    assert.equal(r.page, page);
    assert.equal(r.limit, limit);
  }
});

// ─── 7. parsePaginationParams: floats are truncated to integers ───────────

test("property/page-parse: float inputs are truncated to integers (Math.trunc)", () => {
  const rng = mulberry32(807);
  for (let i = 0; i < SAMPLES; i++) {
    const page = randomInt(rng, 1, 100) + rng();
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE) + rng();
    const r = parsePaginationParams({ page, limit });
    assert.equal(r.page, Math.trunc(page));
    assert.equal(r.limit, Math.min(MAX_PAGE_SIZE, Math.trunc(limit)));
  }
});

// ─── 8. getOffset: (page - 1) * limit for valid inputs ────────────────────

test("property/page-offset: getOffset(page, limit) === (page - 1) * limit for valid inputs", () => {
  const rng = mulberry32(808);
  for (let i = 0; i < SAMPLES; i++) {
    const page = randomInt(rng, 1, 1000);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    assert.equal(getOffset(page, limit), (page - 1) * limit);
  }
});

// ─── 9. getOffset: page < 1 normalises to 1 (offset 0) ────────────────────

test("property/page-offset: getOffset normalises page < 1 to 1 (offset 0) and limit < 1 to 1", () => {
  const rng = mulberry32(809);
  for (let i = 0; i < SAMPLES; i++) {
    const badPage = pick(rng, [0, -1, -50]);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    assert.equal(getOffset(badPage, limit), 0);
    const badLimit = pick(rng, [0, -1, -50]);
    assert.equal(getOffset(1, badLimit), 0);
  }
});

// ─── 10. buildPaginationMeta: totalPages and hasNextPage correctness ──────

test("property/page-meta: totalPages = ceil(total / limit); hasNextPage iff page < totalPages", () => {
  const rng = mulberry32(810);
  for (let i = 0; i < SAMPLES; i++) {
    const total = randomInt(rng, 0, 5000);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const page = randomInt(rng, 1, Math.max(1, totalPages));
    const meta = buildPaginationMeta(page, limit, total);
    assert.equal(meta.total, total);
    assert.equal(meta.limit, limit);
    assert.equal(meta.totalPages, totalPages);
    assert.equal(meta.hasNextPage, page < totalPages);
    assert.equal(meta.hasPrevPage, page > 1);
  }
});

// ─── 11. buildPaginationMeta: total = 0 → 0 pages; hasNextPage false ──────

test("property/page-meta: total = 0 yields totalPages = 0 and hasNextPage = false", () => {
  const rng = mulberry32(811);
  for (let i = 0; i < SAMPLES; i++) {
    const page = randomInt(rng, 1, 100);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const meta = buildPaginationMeta(page, limit, 0);
    assert.equal(meta.totalPages, 0);
    assert.equal(meta.hasNextPage, false);
    assert.equal(meta.hasPrevPage, page > 1);
  }
});

// ─── 12. paginate: slice is correct ───────────────────────────────────────

test("property/page-paginate: slice contains exactly the items at offset..offset+limit", () => {
  const rng = mulberry32(812);
  for (let i = 0; i < SAMPLES; i++) {
    const total = randomInt(rng, 0, 500);
    const items = Array.from({ length: total }, (_, k) => k);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const page = randomInt(rng, 1, Math.max(1, totalPages));
    const result = paginate(items, page, limit);
    const offset = getOffset(page, limit);
    const expected = items.slice(offset, offset + limit);
    assert.deepEqual(result.items, expected);
    assert.equal(result.meta.total, total);
    assert.equal(result.meta.page, page);
    assert.equal(result.meta.limit, limit);
  }
});

// ─── 13. paginate: requesting a page beyond the last returns an empty slice ─

test("property/page-paginate: a page beyond the last returns an empty items array but valid meta", () => {
  const rng = mulberry32(813);
  for (let i = 0; i < SAMPLES; i++) {
    const total = randomInt(rng, 1, 200);
    const items = Array.from({ length: total }, (_, k) => k);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const totalPages = Math.ceil(total / limit);
    const beyondPage = totalPages + randomInt(rng, 1, 10);
    const result = paginate(items, beyondPage, limit);
    assert.equal(result.items.length, 0);
    assert.equal(result.meta.hasNextPage, false);
    assert.equal(result.meta.hasPrevPage, beyondPage > 1);
  }
});

// ─── 14. buildPaginationLinks: HATEOAS shape ──────────────────────────────

test("property/page-links: buildPaginationLinks emits self/first/prev/next/last with correct page numbers", () => {
  const rng = mulberry32(814);
  for (let i = 0; i < SAMPLES; i++) {
    const total = randomInt(rng, 1, 5000);
    const limit = randomInt(rng, 1, MAX_PAGE_SIZE);
    const totalPages = Math.ceil(total / limit);
    const page = randomInt(rng, 1, totalPages);
    const base = pick(rng, ["/api/items", "/api/items?foo=bar"]);
    const links = buildPaginationLinks(page, limit, total, base);
    // self link uses the current page.
    assert.ok(links.self.includes(`page=${page}`));
    assert.ok(links.self.includes(`limit=${limit}`));
    // first link uses page=1.
    assert.ok(links.first.includes("page=1"));
    // last link uses the last page.
    assert.ok(links.last.includes(`page=${totalPages}`));
    // prev link only present when hasPrevPage; uses page-1.
    if (page > 1) {
      assert.ok(links.prev !== null);
      assert.ok(links.prev!.includes(`page=${page - 1}`));
    } else {
      assert.equal(links.prev, null);
    }
    // next link only present when hasNextPage; uses page+1.
    if (page < totalPages) {
      assert.ok(links.next !== null);
      assert.ok(links.next!.includes(`page=${page + 1}`));
    } else {
      assert.equal(links.next, null);
    }
    // Separator: when basePath includes `?`, links append with `&`.
    if (base.includes("?")) {
      assert.ok(links.self.startsWith(`${base}&page=`));
    } else {
      assert.ok(links.self.startsWith(`${base}?page=`));
    }
  }
});

// ─── 15. Constant invariants ──────────────────────────────────────────────

test("property/page-constants: DEFAULT_PAGE_SIZE and MAX_PAGE_SIZE are stable positive integers with sensible bounds", () => {
  assert.ok(Number.isInteger(DEFAULT_PAGE_SIZE) && DEFAULT_PAGE_SIZE > 0);
  assert.ok(Number.isInteger(MAX_PAGE_SIZE) && MAX_PAGE_SIZE > 0);
  assert.ok(DEFAULT_PAGE_SIZE <= MAX_PAGE_SIZE);
  // The constants must remain in their documented ranges — changes here
  // would silently alter API behaviour.
  assert.equal(DEFAULT_PAGE_SIZE, 20);
  assert.equal(MAX_PAGE_SIZE, 100);
});

// Helper used above.
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

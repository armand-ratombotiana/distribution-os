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
} from "../lib/pagination-pure.js";

test("parsePaginationParams falls back to defaults when nothing is provided", () => {
  const result = parsePaginationParams({});
  assert.equal(result.page, 1);
  assert.equal(result.limit, DEFAULT_PAGE_SIZE);
});

test("parsePaginationParams accepts string values for page and limit", () => {
  const result = parsePaginationParams({ page: "3", limit: "5" });
  assert.equal(result.page, 3);
  assert.equal(result.limit, 5);
});

test("parsePaginationParams clamps limit to MAX_PAGE_SIZE", () => {
  const result = parsePaginationParams({ limit: 1000 });
  assert.equal(result.limit, MAX_PAGE_SIZE);
});

test("parsePaginationParams falls back to page=1 for invalid values", () => {
  const result = parsePaginationParams({ page: "abc", limit: -3 });
  assert.equal(result.page, 1);
  assert.equal(result.limit, DEFAULT_PAGE_SIZE);
});

test("getOffset computes the correct skip offset for a page/limit pair", () => {
  assert.equal(getOffset(1, 20), 0);
  assert.equal(getOffset(3, 20), 40);
  assert.equal(getOffset(0, 20), 0);
});

test("buildPaginationMeta computes totalPages from total and limit", () => {
  const meta = buildPaginationMeta(1, 20, 55);
  assert.equal(meta.totalPages, 3);
  assert.equal(meta.total, 55);
});

test("buildPaginationMeta reports hasNextPage when more pages exist", () => {
  const meta = buildPaginationMeta(1, 20, 55);
  assert.equal(meta.hasNextPage, true);
  assert.equal(meta.hasPrevPage, false);
});

test("buildPaginationMeta reports hasPrevPage but not hasNextPage on the last page", () => {
  const meta = buildPaginationMeta(3, 20, 55);
  assert.equal(meta.hasNextPage, false);
  assert.equal(meta.hasPrevPage, true);
});

test("paginate returns the slice of items corresponding to the requested page", () => {
  const items = Array.from({ length: 10 }, (_, i) => i + 1);
  const result = paginate(items, 2, 3);
  assert.deepEqual(result.items, [4, 5, 6]);
  assert.equal(result.meta.total, 10);
  assert.equal(result.meta.totalPages, 4);
});

test("paginate returns an empty slice when the page is beyond the range", () => {
  const items = Array.from({ length: 5 }, (_, i) => i + 1);
  const result = paginate(items, 10, 3);
  assert.deepEqual(result.items, []);
  assert.equal(result.meta.totalPages, 2);
});

test("buildPaginationLinks emits self, first and last links", () => {
  const links = buildPaginationLinks(2, 20, 60, "/api/items");
  assert.equal(links.self, "/api/items?page=2&limit=20");
  assert.equal(links.first, "/api/items?page=1&limit=20");
  assert.equal(links.last, "/api/items?page=3&limit=20");
});

test("buildPaginationLinks sets prev/next links correctly and appends to an existing query string", () => {
  const links = buildPaginationLinks(2, 20, 60, "/api/items?filter=active");
  assert.equal(links.self, "/api/items?filter=active&page=2&limit=20");
  assert.equal(links.prev, "/api/items?filter=active&page=1&limit=20");
  assert.equal(links.next, "/api/items?filter=active&page=3&limit=20");
});

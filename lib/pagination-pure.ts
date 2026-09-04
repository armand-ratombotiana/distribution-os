/**
 * Pure pagination helpers. No I/O; safe to use in workers, servers, browsers.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type ParsedPagination = {
  page: number;
  limit: number;
};

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

/**
 * Parses pagination parameters from a query object. Accepts both
 * `page`/`limit` and `page`/`pageSize` keys. Falls back to safe defaults
 * and clamps `limit` to MAX_PAGE_SIZE.
 */
export function parsePaginationParams(
  query: Record<string, unknown>,
): ParsedPagination {
  const pageRaw = query.page;
  const limitRaw = query.limit ?? query.pageSize;
  const page = toInt(pageRaw);
  const limit = toInt(limitRaw);
  const resolvedPage =
    page === null || page < 1 ? 1 : page;
  let resolvedLimit =
    limit === null || limit < 1 ? DEFAULT_PAGE_SIZE : limit;
  if (resolvedLimit > MAX_PAGE_SIZE) resolvedLimit = MAX_PAGE_SIZE;
  return { page: resolvedPage, limit: resolvedLimit };
}

/** Computes the offset (number of items to skip) for a page/limit pair. */
export function getOffset(page: number, limit: number): number {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  return (safePage - 1) * safeLimit;
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

/** Builds a metadata object describing the pagination state. */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeTotal = Math.max(0, Math.floor(total));
  const totalPages =
    safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);
  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

/** Returns a slice of `items` for the given page/limit, plus metadata. */
export function paginate<T>(
  items: readonly T[],
  page: number,
  limit: number,
): PaginatedResult<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const offset = getOffset(safePage, safeLimit);
  const slice = items.slice(offset, offset + safeLimit);
  return {
    items: slice,
    meta: buildPaginationMeta(safePage, safeLimit, items.length),
  };
}

export type PaginationLinks = {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
};

/**
 * Builds a set of HATEOAS-style pagination links for a collection. The
 * `basePath` may already contain a query string; links are appended with
 * `&page=…&limit=…` in that case, otherwise `?page=…&limit=…`.
 */
export function buildPaginationLinks(
  page: number,
  limit: number,
  total: number,
  basePath: string,
): PaginationLinks {
  const meta = buildPaginationMeta(page, limit, total);
  const separator = basePath.includes("?") ? "&" : "?";
  const link = (p: number): string =>
    `${basePath}${separator}page=${p}&limit=${limit}`;
  const lastPage = Math.max(1, meta.totalPages);
  return {
    self: link(meta.page),
    first: link(1),
    prev: meta.hasPrevPage ? link(meta.page - 1) : null,
    next: meta.hasNextPage ? link(meta.page + 1) : null,
    last: link(lastPage),
  };
}

/**
 * Pure HTTP response-shape builders.
 *
 * Each function returns a plain `{ status, body, headers }` triple ready to be
 * fed into `new Response(JSON.stringify(body), { status, headers })`. No I/O,
 * no globals, safe to use in workers, servers, and tests.
 */

export type ResponseShape = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/**
 * Builds a JSON response shape. Defaults to status 200 and a
 * `content-type: application/json; charset=utf-8` header. Custom headers are
 * merged on top (and may override the content type).
 */
export function jsonResponse(
  body: unknown,
  status: number = 200,
  headers: Record<string, string> = {},
): ResponseShape {
  return {
    status,
    body,
    headers: { "content-type": JSON_CONTENT_TYPE, ...headers },
  };
}

/**
 * Builds a standard error envelope `{ error: { message, code?, details? } }`
 * with the given HTTP status. Defaults to 500.
 */
export function errorResponse(
  message: string,
  status: number = 500,
  options: {
    code?: string;
    details?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): ResponseShape {
  const error: Record<string, unknown> = { message };
  if (options.code !== undefined) error.code = options.code;
  if (options.details !== undefined) error.details = options.details;
  return jsonResponse({ error }, status, options.headers);
}

export type PaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

/**
 * Builds a paginated collection response: `{ items, meta }` with derived
 * `totalPages`, `hasNextPage` and `hasPrevPage` fields. Defaults to status 200.
 */
export function paginatedResponse<T>(
  items: readonly T[],
  page: number,
  limit: number,
  total: number,
  status: number = 200,
  headers: Record<string, string> = {},
): ResponseShape {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeTotal = Math.max(0, Math.floor(total));
  const totalPages =
    safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);
  const meta: PaginatedMeta = {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
  return jsonResponse({ items: [...items], meta }, status, headers);
}

/**
 * Builds a 204 No Content response with a `null` body and no content-type
 * header (per RFC 9110 a 204 response must not have a body).
 */
export function noContentResponse(
  headers: Record<string, string> = {},
): ResponseShape {
  return {
    status: 204,
    body: null,
    headers: { ...headers },
  };
}

/**
 * Pure request-context extraction helpers.
 *
 * Pulls well-known identifiers (request id, workspace id, user id) out of
 * incoming request headers in a case-insensitive manner. All functions are
 * pure: they only read from the headers object passed to them and return
 * either a trimmed string or `null`.
 *
 * No I/O, no global state, safe to use in workers, servers, and tests.
 */

/** A normalized view of the per-request context derived from headers. */
export type RequestContext = {
  requestId: string | null;
  workspaceId: string | null;
  userId: string | null;
  method?: string;
  url?: string;
};

/** Headers are accepted as a plain string-keyed object (any casing). */
export type HeadersLike = Record<string, string>;

function lowerHeaders(headers: HeadersLike): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const v of values) {
    if (v === undefined) continue;
    const trimmed = String(v).trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}

/**
 * Extracts a request id from the standard set of headers, in priority order:
 * `x-request-id`, `x-correlation-id`, `request-id`, `x-amzn-requestid`.
 * Lookup is case-insensitive. Returns `null` when none of the headers carry a
 * non-empty value.
 */
export function extractRequestId(headers: HeadersLike): string | null {
  const h = lowerHeaders(headers);
  return firstNonEmpty(
    h["x-request-id"],
    h["x-correlation-id"],
    h["request-id"],
    h["x-amzn-requestid"],
  );
}

/**
 * Extracts the workspace identifier from the `x-workspace-id` (or
 * `x-workspace`) header. Lookup is case-insensitive. Returns `null` when the
 * header is absent or empty.
 */
export function extractWorkspaceId(headers: HeadersLike): string | null {
  const h = lowerHeaders(headers);
  return firstNonEmpty(h["x-workspace-id"], h["x-workspace"]);
}

/**
 * Extracts the authenticated user identifier from the `x-user-id` (or
 * `x-subject` / `x-authenticated-user`) header. Lookup is case-insensitive.
 * Returns `null` when the header is absent or empty.
 */
export function extractUserId(headers: HeadersLike): string | null {
  const h = lowerHeaders(headers);
  return firstNonEmpty(
    h["x-user-id"],
    h["x-subject"],
    h["x-authenticated-user"],
  );
}

/**
 * Builds a complete RequestContext from headers plus optional request metadata.
 * Convenience helper that calls all three extractors.
 */
export function buildRequestContext(
  headers: HeadersLike,
  meta: { method?: string; url?: string } = {},
): RequestContext {
  return {
    requestId: extractRequestId(headers),
    workspaceId: extractWorkspaceId(headers),
    userId: extractUserId(headers),
    method: meta.method,
    url: meta.url,
  };
}

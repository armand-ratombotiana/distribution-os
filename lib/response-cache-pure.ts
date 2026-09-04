/**
 * Pure HTTP response cache helpers.
 *
 * Builds cache keys, decides whether a response is cacheable, computes a
 * TTL, and matches keys against glob-style invalidation patterns. No I/O,
 * no D1.
 */

export interface CacheableResponse {
  method: string;
  status: number;
  contentType: string;
  /** Response size in bytes. */
  sizeBytes: number;
}

/** Default TTL when no content-type rule matches. */
export const DEFAULT_RESPONSE_TTL_MS = 60_000;

const CACHEABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** HTTP statuses that MAY be served from cache per RFC 9111. */
const CACHEABLE_STATUSES = new Set([
  200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501,
]);

const NO_CACHE_CONTENT_TYPES = ["text/event-stream", "application/grpc"];

/**
 * Build a deterministic cache key for a request. Method is uppercased;
 * path is taken as-is; an optional body is hashed (FNV-1a, 8 hex chars) so
 * different request bodies get different keys.
 *
 *   getCacheKey("get", "/api/users")              → "res:GET:/api/users"
 *   getCacheKey("POST", "/api/search", '{"q":"a"}') → "res:POST:/api/search:<hash>"
 */
export function getCacheKey(
  method: string,
  path: string,
  body?: string,
): string {
  const m = (method ?? "").toUpperCase();
  if (body === undefined || body === "") {
    return `res:${m}:${path}`;
  }
  return `res:${m}:${path}:${hashBody(body)}`;
}

/** Lightweight FNV-1a 32-bit hash; no Node deps so it's trivially portable. */
function hashBody(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i += 1) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Return `true` when the response is cacheable. Requires:
 *   - method in {GET, HEAD, OPTIONS}
 *   - status in the cacheable set per RFC 9111
 *   - content type is not in the no-cache list (event-stream, gRPC, …)
 *   - response size is at or below `maxCacheableBytes`
 */
export function shouldCache(
  response: CacheableResponse,
  maxCacheableBytes: number = 5 * 1024 * 1024,
): boolean {
  if (!CACHEABLE_METHODS.has((response.method ?? "").toUpperCase())) return false;
  if (!CACHEABLE_STATUSES.has(response.status)) return false;
  const ct = (response.contentType ?? "").toLowerCase();
  for (const bad of NO_CACHE_CONTENT_TYPES) {
    if (ct.includes(bad)) return false;
  }
  if (response.sizeBytes > maxCacheableBytes) return false;
  return true;
}

/**
 * Compute a TTL (in milliseconds) for a cached response. Static assets get
 * a long TTL; API JSON gets a short one; HTML gets a medium TTL; error
 * statuses get a short "negative caching" TTL.
 */
export function getCacheTTL(
  status: number,
  contentType: string,
): number {
  const ct = (contentType ?? "").toLowerCase();
  if (
    ct.startsWith("image/") ||
    ct.includes("font") ||
    ct.includes("javascript") ||
    ct.includes("text/css")
  ) {
    return 24 * 60 * 60 * 1000; // 24 hours
  }
  if (ct.includes("application/json")) {
    return 5_000;
  }
  if (ct.startsWith("text/html")) {
    return 60_000;
  }
  if (status >= 400 && status < 600) {
    return 5_000;
  }
  return DEFAULT_RESPONSE_TTL_MS;
}

/**
 * Match `key` against a glob-style `pattern`. Supports `*` (any run of
 * characters within a path segment — i.e. not crossing `:`) and `**` (any
 * run including the separator `:`). The pattern must match the whole key.
 *
 *   matchPattern("res:GET:/api/users", "res:GET:/api/*") → true
 *   matchPattern("res:GET:/api/users:1", "res:GET:/api/*") → false
 *   matchPattern("res:GET:/api/users:1", "res:**") → true
 */
export function matchPattern(key: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern === key) return true;
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^:]*")
        .replace(/\u0000/g, ".*") +
      "$",
  );
  return re.test(key);
}

/**
 * Return the keys in `cache` that match the given pattern. Does not mutate
 * the input.
 */
export function invalidatePattern(
  cache: ReadonlyMap<string, unknown>,
  pattern: string,
): string[] {
  const out: string[] = [];
  for (const key of cache.keys()) {
    if (matchPattern(key, pattern)) out.push(key);
  }
  return out;
}

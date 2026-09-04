/**
 * Shared, side-effect-free constants for Distribution OS.
 *
 * This module is the single source of truth for tunable defaults that
 * cut across the API surface, the HTTP layer and the pure business
 * modules. It is intentionally a leaf module: it imports nothing, performs
 * no I/O, and contains only `const` exports, so it can be pulled into any
 * pure module, runtime adapter, test or worker without dragging in a
 * dependency graph.
 *
 * Note: `lib/pagination-pure.ts` keeps its own (stricter) `DEFAULT_PAGE_SIZE`
 * and `MAX_PAGE_SIZE` constants for its legacy collection behaviour; the
 * values here are the canonical defaults for new HTTP-facing code. Migrate
 * the pagination module onto these values in a follow-up.
 */

// ── API surface ─────────────────────────────────────────────────────────────

/** API version segment used in the `/api/<version>/...` URL prefix. */
export const API_VERSION = "v1";

/** Full API base path (no trailing slash). */
export const API_BASE_PATH = `/api/${API_VERSION}`;

// ── Pagination defaults ─────────────────────────────────────────────────────

/** Default page size returned by list endpoints when the client omits `limit`. */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size accepted by list endpoints; larger values are clamped. */
export const MAX_PAGE_SIZE = 500;

/** Default 1-indexed page number when the client omits `page`. */
export const DEFAULT_PAGE_NUMBER = 1;

// ── Timeouts & retries ──────────────────────────────────────────────────────

/** Default timeout in milliseconds for outbound HTTP requests. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Maximum number of HTTP redirects followed by `fetchWithRedirectLimit`. */
export const MAX_REDIRECTS = 5;

/** Default number of retry attempts for transient failures (network, 5xx). */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** Base backoff in milliseconds for full-jitter retry strategies. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/** Maximum backoff in milliseconds for full-jitter retry strategies. */
export const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

// ── Caching ─────────────────────────────────────────────────────────────────

/** Default TTL for in-memory response caches (10 minutes). */
export const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

/** Maximum number of entries retained by an LRU cache before eviction. */
export const DEFAULT_CACHE_MAX_ENTRIES = 1_000;

// ── Rate limiting ───────────────────────────────────────────────────────────

/** Default rate-limit window in milliseconds (1 minute). */
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

/** Default maximum number of requests per window per identity. */
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 600;

// ── Webhook & idempotency ───────────────────────────────────────────────────

/** Stripe-style webhook signature tolerance window in seconds (5 minutes). */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Default TTL for idempotency-key records (24 hours). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

// ── Budget & spend ──────────────────────────────────────────────────────────

/** Number of cents in one dollar — used to convert between cents and dollars. */
export const CENTS_PER_DOLLAR = 100;

/** Default monthly spend budget in cents (US$1,000) when no override is set. */
export const DEFAULT_MONTHLY_BUDGET_CENTS = 100_000;

/** Default per-action spend cap in cents (US$10). */
export const DEFAULT_PER_ACTION_BUDGET_CENTS = 1_000;

// ── Content & input limits ──────────────────────────────────────────────────

/** Maximum bytes downloaded from an external URL before truncation. */
export const MAX_BODY_BYTES = 120_000;

/** Maximum length of a normalised string field before truncation. */
export const MAX_STRING_FIELD_LENGTH = 1_000;

/** Maximum depth of a JSON object accepted by the API. */
export const MAX_JSON_DEPTH = 32;

// ── Identity & sessions ─────────────────────────────────────────────────────

/** Default session TTL in milliseconds (7 days). */
export const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Header injected by the ChatGPT control plane carrying the user id. */
export const USER_ID_HEADER = "oai-authenticated-user-id";

/** Header injected by the ChatGPT control plane carrying the user email. */
export const USER_EMAIL_HEADER = "oai-authenticated-user-email";

// ── Pagination query parameter names ────────────────────────────────────────

/** Query-parameter name for the 1-indexed page number. */
export const PAGE_PARAM = "page";

/** Query-parameter name for the page size (alias: `pageSize`). */
export const LIMIT_PARAM = "limit";

/** Alternative query-parameter name for the page size. */
export const PAGE_SIZE_PARAM = "pageSize";

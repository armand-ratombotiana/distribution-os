/**
 * Shared, side-effect-free TypeScript types for Distribution OS.
 *
 * These are the canonical wire shapes returned by every API route and
 * consumed by the workspace UI. Pure modules may also use them as
 * inputs/outputs. This module declares types only — no runtime values —
 * so it is erased at compile time and can be imported by any other
 * module without cost.
 *
 * Where a type is owned by a single pure module (e.g. `PaginationMeta`
 * in `lib/pagination-pure.ts`), keep it there; the types collected here
 * are the cross-cutting envelope shapes that span many modules.
 */

// ── JSON primitive helpers ──────────────────────────────────────────────────

/** JSON-friendly value: primitives, arrays or plain objects. */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

/** Plain JSON object whose keys are strings. */
export type JsonObject = { [key: string]: Json };

/** ISO 8601 timestamp string, e.g. `"2026-04-12T08:30:00.000Z"`. */
export type Timestamp = string;

/** Opaque identifier (UUID, ULID, or custom prefixed id). */
export type Id = string;

// ── Error envelope ──────────────────────────────────────────────────────────

/** Machine-readable error codes that may appear in `ErrorResponse.error.code`. */
export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "GONE"
  | "RATE_LIMITED"
  | "BUDGET_EXCEEDED"
  | "INTERNAL_ERROR";

/** A single field-level validation issue. */
export interface FieldError {
  /** Dotted path to the offending field, e.g. `"mission.url"`. */
  field: string;
  /** Human-readable explanation of what went wrong. */
  message: string;
  /** Optional machine code for the field error (e.g. `"invalid_format"`). */
  code?: string;
}

/**
 * Error payload returned in the `error` field of an `ApiResponse` when
 * the request could not be fulfilled. Mirrors the shape produced by
 * `lib/api-errors-pure.ts` -> `toResponse()`.
 */
export interface ErrorResponse {
  /** Stable machine code for the error class. */
  type: string;
  /** Stable machine code, finer-grained than `type` when available. */
  code?: string;
  /** Human-readable explanation safe to surface to the operator. */
  message: string;
  /** Optional structured details (field errors, hint, budget value, ...). */
  details?: JsonObject;
  /** Seconds to wait before retrying, for `RATE_LIMITED` errors. */
  retryAfter?: number;
}

// ── Pagination metadata ─────────────────────────────────────────────────────

/** Metadata describing the position of a page within a paginated collection. */
export interface PaginationMeta {
  /** 1-indexed page number returned. */
  page: number;
  /** Page size used to compute the slice. */
  limit: number;
  /** Total item count across all pages. */
  total: number;
  /** Total page count (`ceil(total / limit)`). */
  totalPages: number;
  /** True when another page exists after this one. */
  hasNextPage: boolean;
  /** True when a previous page exists before this one. */
  hasPrevPage: boolean;
}

/** HATEOAS-style links accompanying a paginated response. */
export interface PaginationLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
}

// ── Response envelopes ──────────────────────────────────────────────────────

/** Success envelope returned by every non-error API response. */
export interface SuccessResponse<T = unknown> {
  /** `true` for the success variant — enables `if (resp.success)` narrowing. */
  success: true;
  /** The payload. */
  data: T;
  /** Optional metadata (e.g. `totalCount`, `cachedAt`). */
  meta?: JsonObject;
}

/** Error envelope returned by every erroring API response. */
export interface FailureResponse {
  /** `false` for the failure variant. */
  success: false;
  /** The error payload. */
  error: ErrorResponse;
}

/**
 * Canonical API response shape. A successful response carries `data`
 * under `success: true`; an erroring response carries `error` under
 * `success: false`. Routes should serialise this object directly via
 * `Response.json()`.
 *
 * @example
 *   const ok: ApiResponse<Mission> = { success: true, data: mission };
 *   const err: ApiResponse<Mission> = {
 *     success: false,
 *     error: { type: "not_found", message: "Mission not found" },
 *   };
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | FailureResponse;

/**
 * Paginated response: a success envelope whose `data` is the page of
 * items plus `pagination` metadata and optional HATEOAS links.
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  links?: PaginationLinks;
  meta?: JsonObject;
}

// ── Query parameters ────────────────────────────────────────────────────────

/** Standard query parameters accepted by every list endpoint. */
export interface ListQueryParams {
  /** 1-indexed page number. */
  page?: number;
  /** Page size; clamped to `[1, MAX_PAGE_SIZE]`. */
  limit?: number;
  /** Optional filter (interpreted per-resource). */
  filter?: string;
  /** Optional sort key (interpreted per-resource). */
  sort?: string;
  /** Optional sort direction. */
  order?: "asc" | "desc";
  /** Optional free-text search query. */
  q?: string;
}

/** Cursor-style query parameters, used by endpoints that prefer cursors. */
export interface CursorQueryParams {
  /** Opaque cursor returned by the previous page. */
  cursor?: string;
  /** Page size; clamped to `[1, MAX_PAGE_SIZE]`. */
  limit?: number;
}

// ── Health & telemetry ──────────────────────────────────────────────────────

/** Status reported by `/api/health`. */
export type HealthStatus = "ok" | "degraded" | "down";

/** Health-check response body. */
export interface HealthResponse {
  status: HealthStatus;
  /** ISO timestamp of the check. */
  checkedAt: Timestamp;
  /** Per-subsystem status (db, openai, stripe, ...). */
  checks: Record<string, { status: HealthStatus; latencyMs?: number }>;
  /** Optional commit SHA the running Worker was built from. */
  version?: string;
}

/** A single log entry emitted by `lib/observability-pure.ts`. */
export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  /** ISO timestamp. */
  ts: Timestamp;
  /** Optional correlation id (request-scoped). */
  correlationId?: string;
  /** Optional workspace id. */
  workspaceId?: Id;
  /** Optional mission id. */
  missionId?: Id;
  /** Optional structured fields. */
  fields?: JsonObject;
}

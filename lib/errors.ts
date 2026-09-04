/**
 * Shared, side-effect-free error class hierarchy for Distribution OS.
 *
 * Each error class extends `AppError`, carries a stable HTTP status, and
 * exposes a `toResponse()` helper that serialises the error into the wire
 * shape consumed by `lib/types.ts` -> `ErrorResponse`. Route handlers
 * should `throw` these from pure modules and convert them to a
 * `Response.json(...)` at the adapter boundary.
 *
 * This hierarchy is complementary to `lib/api-errors-pure.ts`, which uses
 * plain-object error envelopes for cross-worker serialisation. The two
 * representations are isomorphic: `AppError.toResponse()` produces an
 * `ErrorResponse`, and `fromThrownError()` (in api-errors-pure) accepts
 * either an `AppError` instance or a plain `ApiError` object.
 */

import type { ErrorResponse, FieldError, JsonObject } from "./types.js";

/**
 * Base class for every error thrown by application code. Carries a
 * stable `code`, an HTTP `status`, and an optional structured `details`
 * payload. Subclasses set their canonical status and default message.
 */
export abstract class AppError extends Error {
  /** Stable machine code, e.g. `"NOT_FOUND"`. Set by subclasses. */
  abstract readonly code: string;
  /** Canonical HTTP status for this error class. Set by subclasses. */
  abstract readonly status: number;

  /** Optional structured details (field errors, hint, budget value, ...). */
  readonly details?: JsonObject;
  /** Seconds to wait before retrying, for rate-limited errors. */
  readonly retryAfter?: number;

  constructor(
    message: string,
    options?: {
      details?: JsonObject;
      retryAfter?: number;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    if (options?.details !== undefined) this.details = options.details;
    if (options?.retryAfter !== undefined) this.retryAfter = options.retryAfter;
    // Restore the prototype chain after a `super()` call when the class is
    // extended by transpiled code; without this, `instanceof` checks may
    // fail in some runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Serialises the error into the `ErrorResponse` wire shape. */
  toResponse(): ErrorResponse {
    const body: ErrorResponse = {
      type: snakeCase(this.code),
      message: this.message,
    };
    if (this.details !== undefined) body.details = this.details;
    if (this.retryAfter !== undefined) body.retryAfter = this.retryAfter;
    return body;
  }
}

/** 401 — the caller must authenticate before accessing the resource. */
export class AuthError extends AppError {
  readonly code = "AUTH_REQUIRED";
  readonly status = 401;
  constructor(message = "Authentication required") {
    super(message);
  }
}

/** 403 — the caller is authenticated but lacks permission. */
export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly status = 403;
  constructor(message = "You do not have access to this resource") {
    super(message);
  }
}

/** 404 — the requested resource was not found. */
export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly status = 404;
  constructor(
    message = "Resource not found",
    options?: { resource?: string; details?: JsonObject; cause?: unknown },
  ) {
    const details: JsonObject = options?.details ?? {};
    if (options?.resource !== undefined) details.resource = options.resource;
    super(message, {
      details: Object.keys(details).length > 0 ? details : undefined,
      cause: options?.cause,
    });
  }
}

/** 422 — the request body failed validation. */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_FAILED";
  readonly status = 422;
  constructor(
    errors: FieldError[] | string,
    message = "Validation failed",
  ) {
    const details: JsonObject =
      typeof errors === "string"
        ? { message: errors }
        : { errors: errors as unknown as JsonObject };
    super(message, { details });
  }
}

/** 409 — the request conflicts with the current state (e.g. duplicate). */
export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly status = 409;
  constructor(
    message = "Resource already exists",
    options?: { details?: JsonObject; cause?: unknown },
  ) {
    super(message, options);
  }
}

/** 410 — the resource existed previously but has been permanently removed. */
export class GoneError extends AppError {
  readonly code = "GONE";
  readonly status = 410;
  constructor(message = "Resource is no longer available") {
    super(message);
  }
}

/** 429 — the caller has been rate limited; `retryAfter` is in seconds. */
export class RateLimitError extends AppError {
  readonly code = "RATE_LIMITED";
  readonly status = 429;
  constructor(retryAfter?: number, message = "Rate limit exceeded") {
    super(message, { retryAfter });
  }
}

/** 402 — the request would exceed the configured spend budget. */
export class BudgetExceededError extends AppError {
  readonly code = "BUDGET_EXCEEDED";
  readonly status = 402;
  constructor(
    message = "Budget exceeded",
    options?: { budget?: number; spent?: number; details?: JsonObject },
  ) {
    const details: JsonObject = options?.details ?? {};
    if (options?.budget !== undefined) details.budget = options.budget;
    if (options?.spent !== undefined) details.spent = options.spent;
    super(message, {
      details: Object.keys(details).length > 0 ? details : undefined,
    });
  }
}

/** 500 — an unexpected server-side failure. */
export class InternalError extends AppError {
  readonly code = "INTERNAL_ERROR";
  readonly status = 500;
  constructor(message = "Internal server error", cause?: unknown) {
    super(message, { cause });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Converts `SCREAMING_SNAKE_CASE` to `snake_case` (no-op if already lower). */
function snakeCase(input: string): string {
  if (input.length === 0) return input;
  if (input === input.toUpperCase()) return input.toLowerCase();
  return input
    .replace(/([A-Z]+)([A-Z][a-z])/g, "_$1$2")
    .replace(/([a-z\d])([A-Z])/g, "_$1$2")
    .toLowerCase();
}

/** Type guard: true when the value is an `AppError` instance. */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Normalises any thrown value into an `AppError`. Already-shaped
 * `AppError` instances are passed through; `Error` instances become
 * `InternalError`; strings become `InternalError` with that message;
 * anything else becomes a generic `InternalError`.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) return new InternalError(error.message, error);
  if (typeof error === "string") return new InternalError(error);
  return new InternalError("An unknown error occurred");
}

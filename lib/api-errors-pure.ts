/**
 * Pure API error constructors and serializers. Errors are plain objects
 * (not Error instances) so they can be JSON-serialized and passed across
 * worker boundaries without lossy `.toString()` coercion.
 */

export type ApiErrorType =
  | "auth_required"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "gone"
  | "rate_limited"
  | "budget_exceeded"
  | "internal";

/** Maps each error type to its canonical HTTP status code. */
export const ERROR_STATUS_MAP: Record<ApiErrorType, number> = {
  auth_required: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  gone: 410,
  rate_limited: 429,
  budget_exceeded: 402,
  internal: 500,
};

export type ApiErrorOptions = {
  code?: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
  cause?: unknown;
};

export type ApiError = {
  type: ApiErrorType;
  message: string;
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  retryAfter?: number;
  cause?: unknown;
};

/** Creates a structured ApiError with the correct HTTP status for its type. */
export function createApiError(
  type: ApiErrorType,
  message: string,
  options: ApiErrorOptions = {},
): ApiError {
  const error: ApiError = {
    type,
    message,
    status: ERROR_STATUS_MAP[type],
  };
  if (options.code !== undefined) error.code = options.code;
  if (options.details !== undefined) error.details = options.details;
  if (options.retryAfter !== undefined) error.retryAfter = options.retryAfter;
  if (options.cause !== undefined) error.cause = options.cause;
  return error;
}

/** 401 — caller must authenticate before accessing the resource. */
export function authRequired(message = "Authentication required"): ApiError {
  return createApiError("auth_required", message);
}

/** 403 — caller is authenticated but lacks permission. */
export function forbidden(
  message = "You do not have access to this resource",
): ApiError {
  return createApiError("forbidden", message);
}

/** 404 — requested resource was not found. */
export function notFound(
  message = "Resource not found",
  resource?: string,
): ApiError {
  return createApiError(
    "not_found",
    message,
    resource !== undefined ? { details: { resource } } : {},
  );
}

/** 422 — request body failed validation. */
export function validationError(
  errors: Array<{ field: string; message: string }>,
  message = "Validation failed",
): ApiError {
  return createApiError("validation", message, {
    details: { errors },
  });
}

/** 409 — request conflicts with current state (e.g. duplicate). */
export function conflict(message = "Resource already exists"): ApiError {
  return createApiError("conflict", message);
}

/** 410 — resource existed previously but has been permanently removed. */
export function gone(message = "Resource is no longer available"): ApiError {
  return createApiError("gone", message);
}

/** 429 — caller has been rate limited; `retryAfter` is in seconds. */
export function rateLimited(
  retryAfter?: number,
  message = "Rate limit exceeded",
): ApiError {
  return createApiError(
    "rate_limited",
    message,
    retryAfter !== undefined ? { retryAfter } : {},
  );
}

/** 402 — request would exceed the configured spend budget. */
export function budgetExceeded(
  message = "Budget exceeded",
  budget?: number,
): ApiError {
  return createApiError(
    "budget_exceeded",
    message,
    budget !== undefined ? { details: { budget } } : {},
  );
}

/** 500 — unexpected server-side failure. */
export function internalError(message = "Internal server error"): ApiError {
  return createApiError("internal", message);
}

export type ApiResponse = {
  status: number;
  body: {
    error: {
      type: string;
      message: string;
      code?: string;
      details?: Record<string, unknown>;
      retryAfter?: number;
    };
  };
};

/** Serializes an ApiError into a plain response shape ready for `Response.json`. */
export function toResponse(error: ApiError): ApiResponse {
  const body: ApiResponse["body"] = {
    error: {
      type: error.type,
      message: error.message,
    },
  };
  if (error.code !== undefined) body.error.code = error.code;
  if (error.details !== undefined) body.error.details = error.details;
  if (error.retryAfter !== undefined) body.error.retryAfter = error.retryAfter;
  return { status: error.status, body };
}

function isApiError(error: unknown): error is ApiError {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.type === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.message === "string"
  );
}

/**
 * Normalizes any thrown value into an ApiError. Already-shaped ApiErrors are
 * passed through; Error instances become internal errors; strings become
 * internal errors with that message; anything else becomes a generic
 * internal error.
 */
export function fromThrownError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof Error) {
    return internalError(error.message);
  }
  if (typeof error === "string") {
    return internalError(error);
  }
  return internalError("An unknown error occurred");
}

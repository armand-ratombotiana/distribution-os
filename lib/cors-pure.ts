/**
 * Pure CORS (Cross-Origin Resource Sharing) helpers.
 *
 * Decides whether an origin is allowed, builds the standard CORS response
 * headers for an allowed origin, and validates the structural shape of an
 * OPTIONS preflight request. No I/O, no globals, safe to use in workers,
 * servers, and tests.
 */

export type CorsConfig = {
  /** Allowed origin list. `["*"]` permits any origin. */
  allowedOrigins: readonly string[];
  /** When true, sets `access-control-allow-credentials: true`. */
  allowCredentials?: boolean;
  /** Methods exposed to cross-origin callers. */
  allowedMethods?: readonly string[];
  /** Request headers exposed to cross-origin callers. */
  allowedHeaders?: readonly string[];
  /** How long (seconds) the client may cache preflight results. */
  maxAge?: number;
};

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const DEFAULT_ALLOWED_HEADERS = ["content-type", "authorization"] as const;
const DEFAULT_MAX_AGE = 86400;

/**
 * Returns true when `origin` matches an entry in the configured allow-list.
 * A `*` allow-list entry permits any origin (including non-credentialed
 * requests). Returns false for an empty origin string.
 */
export function isAllowedOrigin(origin: string, config: CorsConfig): boolean {
  if (typeof origin !== "string" || origin === "") return false;
  if (config.allowedOrigins.includes("*")) return true;
  return config.allowedOrigins.includes(origin);
}

/**
 * Builds the CORS response headers for the given origin. When the origin is
 * allowed, `access-control-allow-origin` is set to the request origin (echoed
 * back so credentials can flow); otherwise no allow-origin header is set.
 *
 * Always includes `access-control-allow-methods`,
 * `access-control-allow-headers`, and `access-control-max-age` so the same
 * function can be used for both preflight and simple responses.
 */
export function buildCorsHeaders(
  origin: string | null | undefined,
  config: CorsConfig,
  options: {
    methods?: readonly string[];
    headers?: readonly string[];
    maxAge?: number;
  } = {},
): Record<string, string> {
  const methods = options.methods ?? config.allowedMethods ?? DEFAULT_ALLOWED_METHODS;
  const requestHeaders =
    options.headers ?? config.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
  const maxAge = options.maxAge ?? config.maxAge ?? DEFAULT_MAX_AGE;

  const out: Record<string, string> = {
    "access-control-allow-methods": methods.join(", "),
    "access-control-allow-headers": requestHeaders.join(", "),
    "access-control-max-age": String(maxAge),
  };

  if (origin && isAllowedOrigin(origin, config)) {
    out["access-control-allow-origin"] = origin;
    out["vary"] = "origin";
    if (config.allowCredentials) {
      out["access-control-allow-credentials"] = "true";
    }
  }

  return out;
}

/** Outcome of validating a CORS preflight (OPTIONS) request. */
export type PreflightValidation = {
  valid: boolean;
  /** CORS headers to attach to the preflight response (empty when invalid). */
  headers: Record<string, string>;
  /** Human-readable reason when `valid` is false. */
  reason?: string;
};

/**
 * Validates a CORS preflight request: requires an Origin header, requires the
 * origin to be on the allow-list, and (when `requestedMethod` /
 * `requestedHeaders` are provided) requires them to be subsets of the
 * configured allow-list. Returns the CORS response headers on success.
 */
export function validatePreflightRequest(
  origin: string | null | undefined,
  config: CorsConfig,
  options: {
    requestedMethod?: string;
    requestedHeaders?: string | readonly string[];
  } = {},
): PreflightValidation {
  if (!origin || origin === "") {
    return { valid: false, headers: {}, reason: "missing origin header" };
  }
  if (!isAllowedOrigin(origin, config)) {
    return { valid: false, headers: {}, reason: "origin not allowed" };
  }

  const allowedMethods = config.allowedMethods ?? DEFAULT_ALLOWED_METHODS;
  if (options.requestedMethod) {
    const method = options.requestedMethod.toUpperCase();
    if (!allowedMethods.map((m) => m.toUpperCase()).includes(method)) {
      return {
        valid: false,
        headers: {},
        reason: `requested method ${method} not allowed`,
      };
    }
  }

  const allowedHeaders =
    (config.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS).map((h) => h.toLowerCase());
  if (options.requestedHeaders) {
    const requested = Array.isArray(options.requestedHeaders)
      ? options.requestedHeaders
      : String(options.requestedHeaders)
          .split(",")
          .map((h) => h.trim())
          .filter((h) => h !== "");
    for (const h of requested) {
      if (!allowedHeaders.includes(h.toLowerCase())) {
        return {
          valid: false,
          headers: {},
          reason: `requested header ${h} not allowed`,
        };
      }
    }
  }

  return { valid: true, headers: buildCorsHeaders(origin, config) };
}

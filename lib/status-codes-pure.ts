/**
 * Pure HTTP status-code utilities.
 *
 * Provides a status-code → reason-phrase lookup and a set of classification
 * predicates (success / redirect / error / client-error / server-error).
 * No I/O, no globals, safe to use in workers, servers, and tests.
 */

/** Canonical RFC 9110 reason phrases for the most common status codes. */
export const STATUS_TEXT: Readonly<Record<number, string>> = {
  // 1xx — Informational
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",

  // 2xx — Success
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",

  // 3xx — Redirection
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",

  // 4xx — Client error
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  409: "Conflict",
  410: "Gone",
  412: "Precondition Failed",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",

  // 5xx — Server error
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/** Returns the canonical reason phrase for a status code, or "Unknown". */
export function getStatusText(status: number): string {
  return STATUS_TEXT[status] ?? "Unknown";
}

/** True for 2xx status codes. */
export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/** True for 3xx status codes. */
export function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

/** True for any 4xx or 5xx status code. */
export function isError(status: number): boolean {
  return status >= 400;
}

/** True for 4xx status codes. */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/** True for 5xx status codes. */
export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

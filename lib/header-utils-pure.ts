/**
 * Pure HTTP header parsing and inspection helpers.
 *
 * All functions are pure: they take primitive inputs (strings or plain
 * header objects) and return derived primitive values. No I/O, no globals,
 * safe to use in workers, servers, and tests.
 */

export type Headers = Record<string, string>;

/**
 * Parses an HTTP header block — either as a raw CRLF/LF-delimited string, or
 * as a plain object whose keys may be in any casing. The result is always a
 * fresh object whose keys are lowercased.
 */
export function parseHeaders(input: string | Headers): Headers {
  const out: Headers = {};
  if (typeof input === "string") {
    const lines = input.split(/\r?\n/);
    for (const line of lines) {
      if (line === "") continue;
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key === "") continue;
      out[key] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(input)) {
    out[key.toLowerCase()] = String(value);
  }
  return out;
}

/**
 * Returns the bare MIME type from the `content-type` header (i.e. the type
 * with any `;` parameters stripped) and lowercased. Returns `null` when the
 * header is missing. Expects the input to already be lowercased (e.g. from
 * {@link parseHeaders}); for raw-cased objects, lowercase the lookup first.
 */
export function getContentType(headers: Headers): string | null {
  const raw = headers["content-type"];
  if (raw === undefined || raw === "") return null;
  return raw.split(";")[0].trim().toLowerCase();
}

/**
 * Returns true when the request indicates a JSON body. Recognizes
 * `application/json` as well as the `+json` structured-syntax suffix
 * (e.g. `application/vnd.api+json`).
 */
export function isJsonRequest(headers: Headers): boolean {
  const ct = getContentType(headers);
  if (ct === null) return false;
  if (ct === "application/json") return true;
  return ct.endsWith("+json");
}

/**
 * Builds a baseline set of CORS response headers for a permissive API.
 * `origin` defaults to `*`, methods default to the standard RESTful set, and
 * the allowed request headers default to `content-type, authorization`.
 */
export function getCorsHeaders(options: {
  origin?: string;
  methods?: readonly string[];
  headers?: readonly string[];
  maxAge?: number;
  credentials?: boolean;
} = {}): Headers {
  const origin = options.origin ?? "*";
  const methods = options.methods ?? [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ];
  const requestHeaders = options.headers ?? ["content-type", "authorization"];
  const maxAge = options.maxAge ?? 86400;
  const out: Headers = {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": methods.join(", "),
    "access-control-allow-headers": requestHeaders.join(", "),
    "access-control-max-age": String(maxAge),
  };
  if (options.credentials) {
    out["access-control-allow-credentials"] = "true";
  }
  return out;
}

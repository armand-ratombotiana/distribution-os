/**
 * Pure URL validation and manipulation helpers. All functions are
 * side-effect free; they operate only on their inputs.
 */

export type UrlValidationResult = {
  ok: boolean;
  error?: string;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validate that a value is a syntactically correct http(s) URL.
 * Returns the normalized `href` on success.
 */
export function validateUrlFormat(value: unknown): UrlValidationResult & {
  value?: string;
} {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, error: "URL must be a non-empty string" };
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, error: "URL is not syntactically valid" };
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, error: "URL must use http or https" };
  }
  if (!url.hostname) {
    return { ok: false, error: "URL must have a hostname" };
  }
  return { ok: true, value: url.toString() };
}

/**
 * Return `true` when the value is a well-formed `https:` URL.
 */
export function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname.length > 0;
}

/**
 * Extract the hostname from a URL string. Returns `null` for invalid URLs.
 */
export function extractHostname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Determine whether a hostname is an apex (bare) domain — i.e. it has
 * exactly one dot, no `www.` prefix, and no subdomain. Uses the simple
 * "count the dots" heuristic which is sufficient for most validation
 * use-cases; for full eTLD handling use the `psl` library.
 *
 * Examples:
 *   isApexDomain("example.com")     // true
 *   isApexDomain("www.example.com") // false
 *   isApexDomain("sub.example.com") // false
 *   isApexDomain("example")         // false
 */
export function isApexDomain(hostname: string): boolean {
  if (typeof hostname !== "string") return false;
  const host = hostname.trim().toLowerCase();
  if (host.length === 0) return false;
  if (host.startsWith("www.")) return false;
  const dotCount = (host.match(/\./g) || []).length;
  return dotCount === 1;
}

/**
 * Split the pathname of a URL into decoded path segments, omitting the
 * empty segments produced by leading/trailing/repeated slashes.
 *
 * Examples:
 *   extractPathSegments("https://x.com/a/b/c")      // ["a", "b", "c"]
 *   extractPathSegments("https://x.com/a//b/")      // ["a", "b"]
 *   extractPathSegments("https://x.com/")           // []
 *   extractPathSegments("https://x.com/a%2Bb/c")    // ["a+b", "c"]
 */
export function extractPathSegments(value: unknown): string[] {
  if (typeof value !== "string") return [];
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return [];
  }
  const segments: string[] = [];
  for (const raw of url.pathname.split("/")) {
    if (raw.length === 0) continue;
    try {
      segments.push(decodeURIComponent(raw));
    } catch {
      segments.push(raw);
    }
  }
  return segments;
}

export type BuildUrlOptions = {
  /** Query string parameters. */
  query?: Record<string, string | number | boolean | string[] | undefined>;
  /** URL fragment (without the `#`). */
  hash?: string;
  /** Username for basic-auth embedding. */
  username?: string;
  /** Password for basic-auth embedding. */
  password?: string;
};

/**
 * Build a URL string from constituent parts. Re-uses the WHATWG `URL`
 * constructor so the output is always correctly encoded.
 *
 *   buildUrl({ protocol: "https", host: "example.com", pathname: "/a/b",
 *             query: { x: "1", y: ["2", "3"] } })
 *   // "https://example.com/a/b?x=1&y=2&y=3"
 */
export function buildUrl(parts: {
  protocol?: "http" | "https";
  host: string;
  pathname?: string;
  port?: number;
} & BuildUrlOptions): string {
  const protocol = parts.protocol ?? "https";
  const portPart =
    parts.port !== undefined && parts.port > 0 ? `:${parts.port}` : "";
  const auth =
    parts.username !== undefined
      ? `${parts.username}${parts.password !== undefined ? `:${parts.password}` : ""}@`
      : "";
  const base = `${protocol}://${auth}${parts.host}${portPart}`;
  const url = new URL(base);
  if (parts.pathname) {
    url.pathname = parts.pathname.startsWith("/")
      ? parts.pathname
      : `/${parts.pathname}`;
  }
  if (parts.query) {
    for (const [key, raw] of Object.entries(parts.query)) {
      if (raw === undefined) continue;
      if (Array.isArray(raw)) {
        for (const v of raw) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.append(key, String(raw));
      }
    }
  }
  if (parts.hash !== undefined && parts.hash.length > 0) {
    url.hash = parts.hash;
  }
  return url.toString();
}

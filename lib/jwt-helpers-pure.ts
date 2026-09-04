/**
 * Pure JWT helpers. These functions do NOT verify the token signature —
 * they only decode and inspect the structure and claims. Signature
 * verification must be performed by the issuing auth layer before
 * trusting any of these helpers' outputs.
 *
 * All functions are side-effect free; `now` is accepted as a parameter
 * so time-based checks are deterministic in tests.
 */

export type JwtHeader = {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
};

export type JwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
};

export type JwtStructure = {
  header: JwtHeader;
  payload: JwtPayload;
  signature: string;
};

export type JwtValidationResult = {
  ok: boolean;
  error?: string;
};

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Validate that `token` is structurally a JWT — three base64url-encoded
 * segments separated by dots. Does not validate the contents.
 */
export function validateJwtStructure(token: unknown): JwtValidationResult {
  if (typeof token !== "string") {
    return { ok: false, error: "JWT must be a string" };
  }
  if (token.trim().length === 0) {
    return { ok: false, error: "JWT must not be empty" };
  }
  if (!JWT_RE.test(token)) {
    return { ok: false, error: "JWT must have three dot-separated base64url segments" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "JWT must have exactly three segments" };
  }
  if (parts[0].length === 0 || parts[1].length === 0 || parts[2].length === 0) {
    return { ok: false, error: "JWT segments must not be empty" };
  }
  return { ok: true };
}

function decodeBase64Url(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64").toString("utf8");
}

/**
 * Decode the payload (middle segment) of a JWT. Returns `null` when the
 * token is structurally invalid or the payload is not valid JSON.
 */
export function decodeJwtPayload(token: unknown): JwtPayload | null {
  if (!validateJwtStructure(token).ok) return null;
  const parts = (token as string).split(".");
  try {
    const json = decodeBase64Url(parts[1]);
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Decode the header (first segment) of a JWT. Returns `null` on failure.
 */
export function decodeJwtHeader(token: unknown): JwtHeader | null {
  if (!validateJwtStructure(token).ok) return null;
  const parts = (token as string).split(".");
  try {
    const json = decodeBase64Url(parts[0]);
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as JwtHeader;
  } catch {
    return null;
  }
}

/**
 * Fully decode a JWT into its three parts. Returns `null` on failure.
 */
export function decodeJwt(token: unknown): JwtStructure | null {
  if (!validateJwtStructure(token).ok) return null;
  const header = decodeJwtHeader(token);
  const payload = decodeJwtPayload(token);
  if (!header || !payload) return null;
  const signature = (token as string).split(".")[2];
  return { header, payload, signature };
}

/**
 * Return `true` when the JWT's `exp` claim is in the past (or absent
 * past `graceMs` in the future). Tokens without an `exp` claim are
 * considered "not expired" (`false`).
 *
 * @param token     The JWT string.
 * @param nowMs     Current Unix time in milliseconds. Defaults to `Date.now()`.
 * @param graceMs   Skew tolerance in milliseconds. Defaults to 0.
 */
export function isJwtExpired(
  token: unknown,
  nowMs: number = Date.now(),
  graceMs: number = 0,
): boolean {
  const payload = decodeJwtPayload(token);
  if (payload === null) return true;
  if (typeof payload.exp !== "number") return false;
  const expMs = payload.exp * 1000;
  return nowMs >= expMs + graceMs;
}

/**
 * Extract the `sub` claim from a JWT. Returns `null` when the token is
 * invalid or does not carry a `sub` claim.
 */
export function extractUserId(token: unknown): string | null {
  const payload = decodeJwtPayload(token);
  if (payload === null) return null;
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) return null;
  return sub;
}

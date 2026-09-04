/**
 * Pure authentication / authorization helpers.
 *
 * Extracts bearer tokens from `Authorization` headers and answers simple
 * authorization questions about an in-memory subject (user id, role,
 * permissions). No I/O, no globals, safe to use in workers, servers, and
 * tests.
 */

/** A normalized view of the authenticated principal. */
export type AuthSubject = {
  userId?: string | null;
  role?: string | null;
  permissions?: readonly string[];
};

/**
 * Extracts the bearer token from an `Authorization` header value. Returns the
 * raw token string (trimmed) when the header uses the `Bearer` scheme and
 * carries a non-empty token, or `null` otherwise. The scheme match is
 * case-insensitive.
 *
 * @example
 *   extractBearerToken("Bearer abc123")    // "abc123"
 *   extractBearerToken("bearer   xyz")     // "xyz"
 *   extractBearerToken("Basic abc")        // null
 *   extractBearerToken(undefined)          // null
 */
export function extractBearerToken(
  authHeader: string | null | undefined,
): string | null {
  if (typeof authHeader !== "string") return null;
  const trimmed = authHeader.trim();
  if (trimmed === "") return null;
  // Match "Bearer" prefix case-insensitively, followed by whitespace.
  const match = /^bearer\s+(.+)$/i.exec(trimmed);
  if (!match) return null;
  const token = match[1].trim();
  return token === "" ? null : token;
}

/**
 * Returns true when the subject has been authenticated (carries a non-empty
 * `userId`). A null/undefined subject is treated as anonymous.
 */
export function isAuthorized(subject: AuthSubject | null | undefined): boolean {
  if (!subject) return false;
  if (subject.userId === null || subject.userId === undefined) return false;
  return String(subject.userId).trim() !== "";
}

/**
 * Returns true when the subject is authorized and holds the given permission.
 * A wildcard permission `"*"` grants every permission check.
 */
export function hasPermission(
  subject: AuthSubject | null | undefined,
  permission: string,
): boolean {
  if (!isAuthorized(subject)) return false;
  const permissions = subject!.permissions;
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
}

/**
 * Returns true when the subject is authorized and its role matches one of the
 * required roles. `requiredRole` may be a single string or an array (any match
 * wins). Comparison is case-sensitive.
 */
export function checkRole(
  subject: AuthSubject | null | undefined,
  requiredRole: string | readonly string[],
): boolean {
  if (!isAuthorized(subject)) return false;
  if (!subject!.role) return false;
  const required = Array.isArray(requiredRole)
    ? requiredRole
    : [requiredRole];
  return required.includes(subject!.role);
}

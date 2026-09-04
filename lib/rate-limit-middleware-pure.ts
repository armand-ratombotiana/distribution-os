/**
 * Pure rate-limit *middleware* helpers.
 *
 * Sits on top of `lib/rate-limit-pure.ts` (the token-bucket algorithm) and
 * provides the request-scoped decisions a middleware needs: which key to
 * bucket on for a given request identity, whether the request should be
 * subject to rate limiting at all, and how to shape the 429 response.
 *
 * No I/O, no globals, safe to use in workers, servers, and tests.
 */

export type RateLimitScope = "global" | "workspace" | "user" | "ip";

/** Identity of the caller extracted from the request context. */
export type RateLimitIdentity = {
  workspaceId?: string | null;
  userId?: string | null;
  ip?: string | null;
};

/** Decision returned by {@link shouldRateLimit}. */
export type RateLimitDecision = {
  /** True when the request should be counted against a rate-limit bucket. */
  limit: boolean;
  scope: RateLimitScope;
  /** Cache key for the bucket; empty string when `limit` is false. */
  key: string;
  /** Human-readable reason when `limit` is false. */
  reason?: string;
};

/**
 * Builds a deterministic cache key for a rate-limit bucket. Throws when the
 * identity is missing the field required for the chosen scope.
 *
 * @example
 *   getRateLimitKey("global", {})                      // "rl:global"
 *   getRateLimitKey("workspace", { workspaceId: "ws_1" }) // "rl:workspace:ws_1"
 */
export function getRateLimitKey(
  scope: RateLimitScope,
  identity: RateLimitIdentity,
): string {
  switch (scope) {
    case "global":
      return "rl:global";
    case "workspace": {
      if (!identity.workspaceId) {
        throw new Error("workspaceId is required for the workspace scope");
      }
      return `rl:workspace:${identity.workspaceId}`;
    }
    case "user": {
      if (!identity.userId) {
        throw new Error("userId is required for the user scope");
      }
      return `rl:user:${identity.userId}`;
    }
    case "ip": {
      if (!identity.ip) {
        throw new Error("ip is required for the ip scope");
      }
      return `rl:ip:${identity.ip}`;
    }
  }
}

/**
 * Decides whether a request should be counted against a rate-limit bucket.
 * Returns `limit: false` (with a reason) when the identity is missing the
 * required field, or when the request method is not in the configured
 * `writeMethods` set (used to limit only mutation requests).
 */
export function shouldRateLimit(
  scope: RateLimitScope,
  identity: RateLimitIdentity,
  options: {
    method?: string;
    writeMethods?: readonly string[];
  } = {},
): RateLimitDecision {
  const { method, writeMethods } = options;

  if (scope === "workspace" && !identity.workspaceId) {
    return { limit: false, scope, key: "", reason: "no workspace id available" };
  }
  if (scope === "user" && !identity.userId) {
    return { limit: false, scope, key: "", reason: "no user id available" };
  }
  if (scope === "ip" && !identity.ip) {
    return { limit: false, scope, key: "", reason: "no ip available" };
  }

  if (method && writeMethods && writeMethods.length > 0) {
    const upper = method.toUpperCase();
    const configured = writeMethods.map((m) => m.toUpperCase());
    if (!configured.includes(upper)) {
      return {
        limit: false,
        scope,
        key: "",
        reason: `method ${upper} is not rate limited`,
      };
    }
  }

  return { limit: true, scope, key: getRateLimitKey(scope, identity) };
}

/** Shape of the 429 response returned by {@link buildRateLimitResponse}. */
export type RateLimitResponse = {
  status: 429;
  headers: Record<string, string>;
  body: {
    error: {
      message: string;
      retryAfter?: number;
    };
  };
};

/**
 * Builds the canonical rate-limit-exceeded response: HTTP 429 with the
 * IETF `RateLimit-*` header family and a `Retry-After` header (in seconds)
 * when provided.
 */
export function buildRateLimitResponse(params: {
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds?: number;
}): RateLimitResponse {
  const { limit, remaining, resetSeconds, retryAfterSeconds } = params;
  const headers: Record<string, string> = {
    "ratelimit-limit": String(limit),
    "ratelimit-remaining": String(Math.max(0, Math.floor(remaining))),
    "ratelimit-reset": String(Math.max(0, Math.floor(resetSeconds))),
  };
  const body: RateLimitResponse["body"] = {
    error: { message: "Rate limit exceeded" },
  };
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    const sec = Math.ceil(retryAfterSeconds);
    headers["retry-after"] = String(sec);
    body.error.retryAfter = sec;
  }
  return { status: 429, headers, body };
}

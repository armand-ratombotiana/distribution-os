import { test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldRateLimit,
  getRateLimitKey,
  buildRateLimitResponse,
} from "../lib/rate-limit-middleware-pure.ts";

test("getRateLimitKey returns \"rl:global\" for the global scope", () => {
  assert.equal(getRateLimitKey("global", {}), "rl:global");
});

test("getRateLimitKey includes the workspace id for the workspace scope", () => {
  assert.equal(
    getRateLimitKey("workspace", { workspaceId: "ws_123" }),
    "rl:workspace:ws_123",
  );
});

test("getRateLimitKey includes the user id and ip for their respective scopes", () => {
  assert.equal(
    getRateLimitKey("user", { userId: "usr_42" }),
    "rl:user:usr_42",
  );
  assert.equal(getRateLimitKey("ip", { ip: "1.2.3.4" }), "rl:ip:1.2.3.4");
});

test("getRateLimitKey throws when the identity is missing the required field", () => {
  assert.throws(() => getRateLimitKey("workspace", {}), /workspaceId/);
  assert.throws(() => getRateLimitKey("user", {}), /userId/);
  assert.throws(() => getRateLimitKey("ip", {}), /ip/);
});

test("shouldRateLimit returns limit=true with the bucket key for a valid workspace scope", () => {
  const decision = shouldRateLimit("workspace", { workspaceId: "ws_1" });
  assert.equal(decision.limit, true);
  assert.equal(decision.key, "rl:workspace:ws_1");
  assert.equal(decision.reason, undefined);
});

test("shouldRateLimit returns limit=false when the required identity field is missing", () => {
  const decision = shouldRateLimit("workspace", {});
  assert.equal(decision.limit, false);
  assert.equal(decision.key, "");
  assert.match(decision.reason ?? "", /workspace/i);
});

test("shouldRateLimit returns limit=false for read methods when only write methods are rate limited", () => {
  const decision = shouldRateLimit("user", { userId: "u_1" }, {
    method: "GET",
    writeMethods: ["POST", "PUT", "PATCH", "DELETE"],
  });
  assert.equal(decision.limit, false);
  assert.match(decision.reason ?? "", /GET/);
});

test("shouldRateLimit returns limit=true for write methods when only write methods are rate limited", () => {
  const decision = shouldRateLimit("user", { userId: "u_1" }, {
    method: "POST",
    writeMethods: ["POST", "PUT", "PATCH", "DELETE"],
  });
  assert.equal(decision.limit, true);
  assert.equal(decision.key, "rl:user:u_1");
});

test("buildRateLimitResponse returns HTTP 429 with the standard RateLimit-* headers", () => {
  const res = buildRateLimitResponse({ limit: 100, remaining: 0, resetSeconds: 60 });
  assert.equal(res.status, 429);
  assert.equal(res.headers["ratelimit-limit"], "100");
  assert.equal(res.headers["ratelimit-remaining"], "0");
  assert.equal(res.headers["ratelimit-reset"], "60");
  assert.equal(res.headers["retry-after"], undefined);
  assert.equal(res.body.error.message, "Rate limit exceeded");
});

test("buildRateLimitResponse adds Retry-After when retryAfterSeconds is provided", () => {
  const res = buildRateLimitResponse({
    limit: 100,
    remaining: 0,
    resetSeconds: 60,
    retryAfterSeconds: 12,
  });
  assert.equal(res.headers["retry-after"], "12");
  assert.equal(res.body.error.retryAfter, 12);
});

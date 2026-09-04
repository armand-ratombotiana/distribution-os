import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_RESPONSE_TTL_MS,
  getCacheKey,
  getCacheTTL,
  invalidatePattern,
  matchPattern,
  shouldCache,
} from "../lib/response-cache-pure.ts";

test("getCacheKey uppercases the method and prefixes with res:", () => {
  assert.equal(getCacheKey("get", "/api/users"), "res:GET:/api/users");
  assert.equal(getCacheKey("Get", "/api/users"), "res:GET:/api/users");
  assert.equal(getCacheKey("HEAD", "/api/x"), "res:HEAD:/api/x");
});

test("getCacheKey omits the body hash when no body is supplied", () => {
  assert.equal(getCacheKey("GET", "/api/users"), "res:GET:/api/users");
  assert.equal(getCacheKey("GET", "/api/users", ""), "res:GET:/api/users");
});

test("getCacheKey produces the same hash for identical bodies and different hashes for different bodies", () => {
  const a = getCacheKey("POST", "/api/search", '{"q":"a"}');
  const b = getCacheKey("POST", "/api/search", '{"q":"a"}');
  const c = getCacheKey("POST", "/api/search", '{"q":"b"}');
  assert.equal(a, b);
  assert.notEqual(a, c);
  // Hash is 8 hex chars.
  const hash = a.split(":").slice(-1)[0]!;
  assert.equal(hash.length, 8);
  assert.match(hash, /^[0-9a-f]{8}$/);
});

test("shouldCache returns true for a 200 GET with a JSON content type", () => {
  assert.equal(
    shouldCache({ method: "GET", status: 200, contentType: "application/json", sizeBytes: 100 }),
    true,
  );
  assert.equal(
    shouldCache({ method: "HEAD", status: 200, contentType: "application/json", sizeBytes: 100 }),
    true,
  );
});

test("shouldCache returns false for non-cacheable methods (POST, PUT, DELETE)", () => {
  assert.equal(
    shouldCache({ method: "POST", status: 200, contentType: "application/json", sizeBytes: 100 }),
    false,
  );
  assert.equal(
    shouldCache({ method: "PUT", status: 200, contentType: "application/json", sizeBytes: 100 }),
    false,
  );
  assert.equal(
    shouldCache({ method: "DELETE", status: 200, contentType: "application/json", sizeBytes: 100 }),
    false,
  );
});

test("shouldCache returns false for non-cacheable statuses (e.g. 401, 500)", () => {
  assert.equal(
    shouldCache({ method: "GET", status: 401, contentType: "application/json", sizeBytes: 100 }),
    false,
  );
  assert.equal(
    shouldCache({ method: "GET", status: 500, contentType: "application/json", sizeBytes: 100 }),
    false,
  );
  // 404 is cacheable per RFC 9111.
  assert.equal(
    shouldCache({ method: "GET", status: 404, contentType: "application/json", sizeBytes: 100 }),
    true,
  );
});

test("shouldCache returns false for streaming content types", () => {
  assert.equal(
    shouldCache({ method: "GET", status: 200, contentType: "text/event-stream", sizeBytes: 100 }),
    false,
  );
  assert.equal(
    shouldCache({ method: "GET", status: 200, contentType: "application/grpc", sizeBytes: 100 }),
    false,
  );
});

test("shouldCache returns false when the response exceeds the size limit", () => {
  assert.equal(
    shouldCache(
      { method: "GET", status: 200, contentType: "application/json", sizeBytes: 10 * 1024 * 1024 },
      5 * 1024 * 1024,
    ),
    false,
  );
  // Exactly at the limit is allowed.
  assert.equal(
    shouldCache(
      { method: "GET", status: 200, contentType: "application/json", sizeBytes: 5 * 1024 * 1024 },
      5 * 1024 * 1024,
    ),
    true,
  );
});

test("getCacheTTL returns a long TTL for static assets (24 hours)", () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(getCacheTTL(200, "image/png"), day);
  assert.equal(getCacheTTL(200, "font/woff2"), day);
  assert.equal(getCacheTTL(200, "application/javascript"), day);
  assert.equal(getCacheTTL(200, "text/css"), day);
});

test("getCacheTTL returns a short TTL for JSON API responses and HTML", () => {
  assert.equal(getCacheTTL(200, "application/json"), 5_000);
  assert.equal(getCacheTTL(200, "text/html"), 60_000);
  // Errors get a short negative-caching TTL.
  assert.equal(getCacheTTL(500, "text/plain"), 5_000);
  assert.equal(getCacheTTL(404, "text/plain"), 5_000);
  // Unknown content type uses the default.
  assert.equal(getCacheTTL(200, "application/octet-stream"), DEFAULT_RESPONSE_TTL_MS);
});

test("matchPattern supports * within segments and ** across segments", () => {
  assert.equal(matchPattern("res:GET:/api/users", "res:GET:/api/*"), true);
  // * does not cross `:`.
  assert.equal(matchPattern("res:GET:/api/users:1", "res:GET:/api/*"), false);
  // ** crosses `:`.
  assert.equal(matchPattern("res:GET:/api/users:1", "res:**"), true);
  // Bare * matches anything.
  assert.equal(matchPattern("anything:at:all", "*"), true);
  // Exact match.
  assert.equal(matchPattern("res:GET:/api/users", "res:GET:/api/users"), true);
  assert.equal(matchPattern("res:GET:/api/users", "res:GET:/api/other"), false);
});

test("invalidatePattern returns the matching keys without mutating the cache", () => {
  const cache = new Map<string, unknown>([
    ["res:GET:/api/users", 1],
    ["res:GET:/api/users:1", 2],
    ["res:GET:/api/orgs", 3],
    ["res:POST:/api/search", 4],
  ]);
  // Single `*` does NOT cross `:`, so `users:1` is excluded.
  const matched = invalidatePattern(cache, "res:GET:/api/*");
  assert.deepEqual(matched.sort(), ["res:GET:/api/orgs", "res:GET:/api/users"]);
  // `**` DOES cross `:`, so `users:1` is included.
  const deep = invalidatePattern(cache, "res:GET:/api/**");
  assert.deepEqual(deep.sort(), [
    "res:GET:/api/orgs",
    "res:GET:/api/users",
    "res:GET:/api/users:1",
  ]);
  // Cache is unchanged.
  assert.equal(cache.size, 4);
  // Bare `**` matches every key.
  const all = invalidatePattern(cache, "res:**");
  assert.equal(all.length, 4);
});

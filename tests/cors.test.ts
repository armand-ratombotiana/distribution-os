import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isAllowedOrigin,
  buildCorsHeaders,
  validatePreflightRequest,
} from "../lib/cors-pure.ts";

test("isAllowedOrigin returns true when the origin is in the allow-list", () => {
  const config = { allowedOrigins: ["https://example.com", "https://app.example.com"] };
  assert.equal(isAllowedOrigin("https://example.com", config), true);
  assert.equal(isAllowedOrigin("https://app.example.com", config), true);
});

test("isAllowedOrigin returns true when the allow-list contains a wildcard", () => {
  const config = { allowedOrigins: ["*"] };
  assert.equal(isAllowedOrigin("https://anything.example.com", config), true);
});

test("isAllowedOrigin returns false when the origin is not in the allow-list", () => {
  const config = { allowedOrigins: ["https://example.com"] };
  assert.equal(isAllowedOrigin("https://evil.example.com", config), false);
});

test("isAllowedOrigin returns false for an empty origin string", () => {
  const config = { allowedOrigins: ["*"] };
  assert.equal(isAllowedOrigin("", config), false);
});

test("buildCorsHeaders echoes back an allowed origin and sets vary: origin", () => {
  const config = { allowedOrigins: ["https://example.com"] };
  const headers = buildCorsHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-origin"], "https://example.com");
  assert.equal(headers["vary"], "origin");
  assert.equal(headers["access-control-allow-credentials"], undefined);
});

test("buildCorsHeaders sets allow-credentials when configured", () => {
  const config = { allowedOrigins: ["https://example.com"], allowCredentials: true };
  const headers = buildCorsHeaders("https://example.com", config);
  assert.equal(headers["access-control-allow-credentials"], "true");
  assert.ok(headers["access-control-allow-methods"].length > 0);
  assert.ok(headers["access-control-allow-headers"].length > 0);
  assert.equal(headers["access-control-max-age"], "86400");
});

test("buildCorsHeaders omits allow-origin when the origin is not allowed", () => {
  const config = { allowedOrigins: ["https://example.com"] };
  const headers = buildCorsHeaders("https://evil.example.com", config);
  assert.equal(headers["access-control-allow-origin"], undefined);
  assert.equal(headers["vary"], undefined);
});

test("validatePreflightRequest returns valid=true with headers for an allowed origin", () => {
  const config = { allowedOrigins: ["https://example.com"] };
  const result = validatePreflightRequest("https://example.com", config);
  assert.equal(result.valid, true);
  assert.equal(result.headers["access-control-allow-origin"], "https://example.com");
});

test("validatePreflightRequest returns invalid when the origin is missing", () => {
  const config = { allowedOrigins: ["*"] };
  const result = validatePreflightRequest("", config);
  assert.equal(result.valid, false);
  assert.deepEqual(result.headers, {});
  assert.match(result.reason ?? "", /missing origin/i);
});

test("validatePreflightRequest returns invalid when the requested method is not allowed", () => {
  const config = {
    allowedOrigins: ["https://example.com"],
    allowedMethods: ["GET", "POST"],
  };
  const result = validatePreflightRequest("https://example.com", config, {
    requestedMethod: "DELETE",
  });
  assert.equal(result.valid, false);
  assert.match(result.reason ?? "", /method/i);
});

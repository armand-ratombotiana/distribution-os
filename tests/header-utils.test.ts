import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseHeaders,
  getContentType,
  isJsonRequest,
  getCorsHeaders,
} from "../lib/header-utils-pure.ts";

test("parseHeaders parses a raw HTTP header string into a lowercased map", () => {
  const headers = parseHeaders("Content-Type: application/json\r\nX-Trace-Id: abc");
  assert.equal(headers["content-type"], "application/json");
  assert.equal(headers["x-trace-id"], "abc");
});

test("parseHeaders lowercases keys and trims whitespace around colons", () => {
  const headers = parseHeaders("Content-Type:   text/plain  ");
  assert.equal(headers["content-type"], "text/plain");
  assert.equal(headers["Content-Type"], undefined);
});

test("parseHeaders accepts a plain object and lowercases its keys", () => {
  const headers = parseHeaders({ "X-Request-ID": "req_1", Accept: "*/*" });
  assert.equal(headers["x-request-id"], "req_1");
  assert.equal(headers["accept"], "*/*");
});

test("parseHeaders skips blank lines and lines without a colon", () => {
  const headers = parseHeaders("Host: example.com\r\n\r\nthis-has-no-colon\r\nX-A: 1");
  assert.equal(headers["host"], "example.com");
  assert.equal(headers["this-has-no-colon"], undefined);
  assert.equal(headers["x-a"], "1");
});

test("parseHeaders returns an empty object for an empty string", () => {
  assert.deepEqual(parseHeaders(""), {});
});

test("getContentType returns the MIME type without parameters", () => {
  assert.equal(
    getContentType({ "content-type": "application/json; charset=utf-8" }),
    "application/json",
  );
});

test("getContentType returns null when the content-type header is missing", () => {
  assert.equal(getContentType({ accept: "*/*" }), null);
});

test("isJsonRequest returns true for application/json and +json suffixes", () => {
  assert.equal(
    isJsonRequest({ "content-type": "application/json" }),
    true,
  );
  assert.equal(
    isJsonRequest({ "content-type": "application/vnd.api+json; charset=utf-8" }),
    true,
  );
});

test("isJsonRequest returns false for non-json content types and missing headers", () => {
  assert.equal(isJsonRequest({ "content-type": "text/plain" }), false);
  assert.equal(isJsonRequest({}), false);
});

test("getCorsHeaders returns the standard CORS headers with sensible defaults", () => {
  const headers = getCorsHeaders();
  assert.equal(headers["access-control-allow-origin"], "*");
  assert.equal(headers["access-control-allow-methods"], "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  assert.equal(headers["access-control-allow-headers"], "content-type, authorization");
  assert.equal(headers["access-control-max-age"], "86400");
  assert.equal(headers["access-control-allow-credentials"], undefined);
});

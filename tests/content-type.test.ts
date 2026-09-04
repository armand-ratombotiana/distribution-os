import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getContentTypeForExtension,
  isCompressible,
  parseAcceptHeader,
} from "../lib/content-type-pure.ts";

test("getContentTypeForExtension returns the canonical MIME for a known extension", () => {
  assert.equal(getContentTypeForExtension("html"), "text/html; charset=utf-8");
  assert.equal(getContentTypeForExtension("json"), "application/json; charset=utf-8");
  assert.equal(getContentTypeForExtension("png"), "image/png");
});

test("getContentTypeForExtension accepts extensions with a leading dot", () => {
  assert.equal(getContentTypeForExtension(".css"), "text/css; charset=utf-8");
  assert.equal(getContentTypeForExtension(".svg"), "image/svg+xml");
});

test("getContentTypeForExtension is case-insensitive", () => {
  assert.equal(getContentTypeForExtension("HTML"), "text/html; charset=utf-8");
  assert.equal(getContentTypeForExtension("JPG"), "image/jpeg");
});

test("getContentTypeForExtension returns null for unknown extensions", () => {
  assert.equal(getContentTypeForExtension("xyz"), null);
  assert.equal(getContentTypeForExtension(""), null);
});

test("isCompressible returns true for text-based MIME types", () => {
  assert.equal(isCompressible("text/html"), true);
  assert.equal(isCompressible("text/css"), true);
  assert.equal(isCompressible("application/javascript"), true);
  assert.equal(isCompressible("application/json"), true);
  assert.equal(isCompressible("image/svg+xml"), true);
});

test("isCompressible returns true for +json and +xml structured-syntax suffixes", () => {
  assert.equal(isCompressible("application/vnd.api+json"), true);
  assert.equal(isCompressible("application/atom+xml"), true);
});

test("isCompressible returns false for already-compressed binary types", () => {
  assert.equal(isCompressible("image/png"), false);
  assert.equal(isCompressible("image/jpeg"), false);
  assert.equal(isCompressible("video/mp4"), false);
  assert.equal(isCompressible("application/gzip"), false);
});

test("parseAcceptHeader parses a single media range with default q=1", () => {
  const result = parseAcceptHeader("application/json");
  assert.deepEqual(result, [{ type: "application/json", q: 1 }]);
});

test("parseAcceptHeader parses multiple ranges with explicit q values", () => {
  const result = parseAcceptHeader("text/html, application/xml;q=0.9, */*;q=0.8");
  assert.deepEqual(result, [
    { type: "text/html", q: 1 },
    { type: "application/xml", q: 0.9 },
    { type: "*/*", q: 0.8 },
  ]);
});

test("parseAcceptHeader sorts ranges by q value descending and drops q=0 entries", () => {
  const result = parseAcceptHeader("text/html;q=0.5, application/json;q=0.9, image/png;q=0");
  assert.deepEqual(
    result.map((r) => r.type),
    ["application/json", "text/html"],
  );
  assert.equal(result.length, 2);
});

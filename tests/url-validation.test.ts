import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateUrlFormat,
  isHttpsUrl,
  extractHostname,
  isApexDomain,
  extractPathSegments,
  buildUrl,
} from "../lib/url-validation-pure";

test("validateUrlFormat accepts a well-formed https URL", () => {
  const r = validateUrlFormat("https://example.com/path");
  assert.equal(r.ok, true);
  assert.equal(r.value, "https://example.com/path");
});

test("validateUrlFormat rejects non-http(s) protocols", () => {
  assert.equal(validateUrlFormat("ftp://example.com").ok, false);
  assert.equal(validateUrlFormat("javascript:alert(1)").ok, false);
});

test("validateUrlFormat rejects empty and malformed inputs", () => {
  assert.equal(validateUrlFormat("").ok, false);
  assert.equal(validateUrlFormat("   ").ok, false);
  assert.equal(validateUrlFormat("not-a-url").ok, false);
  assert.equal(validateUrlFormat(42).ok, false);
});

test("isHttpsUrl returns true only for https URLs (and trims input)", () => {
  assert.equal(isHttpsUrl("https://example.com"), true);
  assert.equal(isHttpsUrl("   https://example.com  "), true);
  assert.equal(isHttpsUrl("http://example.com"), false);
  assert.equal(isHttpsUrl("ftp://example.com"), false);
  assert.equal(isHttpsUrl("garbage"), false);
});

test("extractHostname returns the hostname for valid URLs", () => {
  assert.equal(extractHostname("https://example.com/a/b"), "example.com");
  assert.equal(extractHostname("http://sub.example.org:8080/x"), "sub.example.org");
});

test("extractHostname returns null for invalid URLs", () => {
  assert.equal(extractHostname(""), null);
  assert.equal(extractHostname("not-a-url"), null);
  assert.equal(extractHostname(123), null);
});

test("isApexDomain recognises bare domains", () => {
  assert.equal(isApexDomain("example.com"), true);
  assert.equal(isApexDomain("Example.COM"), true);
});

test("isApexDomain rejects subdomains, www and single labels", () => {
  assert.equal(isApexDomain("www.example.com"), false);
  assert.equal(isApexDomain("sub.example.com"), false);
  assert.equal(isApexDomain("example"), false);
  assert.equal(isApexDomain(""), false);
});

test("extractPathSegments decodes and trims path segments, returns [] for invalid URLs", () => {
  assert.deepEqual(extractPathSegments("https://x.com/a/b/c"), ["a", "b", "c"]);
  assert.deepEqual(extractPathSegments("https://x.com/a//b/"), ["a", "b"]);
  assert.deepEqual(extractPathSegments("https://x.com/"), []);
  assert.deepEqual(extractPathSegments("https://x.com/a%2Bb/c"), ["a+b", "c"]);
  assert.deepEqual(extractPathSegments(""), []);
  assert.deepEqual(extractPathSegments("not-a-url"), []);
});

test("buildUrl assembles a URL with query and hash", () => {
  const url = buildUrl({
    protocol: "https",
    host: "example.com",
    pathname: "/a/b",
    query: { x: "1", y: true, z: 3 },
    hash: "frag",
  });
  // searchParams order follows insertion order
  assert.equal(url, "https://example.com/a/b?x=1&y=true&z=3#frag");
});

test("buildUrl supports array-valued query params and a custom port", () => {
  const url = buildUrl({
    protocol: "http",
    host: "example.com",
    port: 8080,
    query: { tag: ["a", "b"] },
  });
  assert.equal(url, "http://example.com:8080/?tag=a&tag=b");
});

test("buildUrl defaults to https and skips undefined query values", () => {
  const url = buildUrl({
    host: "example.com",
    query: { keep: "1", drop: undefined },
  });
  assert.equal(url, "https://example.com/?keep=1");
});

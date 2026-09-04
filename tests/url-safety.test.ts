import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validatePublicUrl,
  fetchWithRedirectLimit,
  MAX_BODY_BYTES,
  ALLOWED_PORTS,
  type FetchImpl,
} from "../lib/url-safety";

test("validatePublicUrl accepts a valid https URL", () => {
  const url = validatePublicUrl("https://example.com/path?q=1");
  assert.equal(url.hostname, "example.com");
  assert.equal(url.protocol, "https:");
});

test("validatePublicUrl rejects the ftp:// scheme", () => {
  assert.throws(
    () => validatePublicUrl("ftp://example.com/file"),
    /non-http/i,
  );
});

test("validatePublicUrl rejects the file:// scheme", () => {
  assert.throws(
    () => validatePublicUrl("file:///etc/passwd"),
    /non-http/i,
  );
});

test("validatePublicUrl rejects embedded credentials", () => {
  assert.throws(
    () => validatePublicUrl("https://user:pass@example.com/"),
    /credential/i,
  );
});

test("validatePublicUrl rejects a non-standard port", () => {
  assert.throws(
    () => validatePublicUrl("https://example.com:22/"),
    /port/i,
  );
});

test("validatePublicUrl rejects localhost", () => {
  assert.throws(
    () => validatePublicUrl("https://localhost/"),
    /localhost/i,
  );
});

test("validatePublicUrl rejects 127.0.0.1", () => {
  assert.throws(
    () => validatePublicUrl("https://127.0.0.1/"),
    /private|reserved|loopback/i,
  );
});

test("validatePublicUrl rejects 10.0.0.1", () => {
  assert.throws(
    () => validatePublicUrl("https://10.0.0.1/"),
    /private|reserved/i,
  );
});

test("validatePublicUrl rejects 192.168.1.1", () => {
  assert.throws(
    () => validatePublicUrl("https://192.168.1.1/"),
    /private|reserved/i,
  );
});

test("validatePublicUrl rejects a .local hostname", () => {
  assert.throws(
    () => validatePublicUrl("https://myhost.local/"),
    /local/i,
  );
});

test("validatePublicUrl rejects multicast 224.0.0.1", () => {
  assert.throws(
    () => validatePublicUrl("https://224.0.0.1/"),
    /multicast|private|reserved/i,
  );
});

test("validatePublicUrl rejects IPv6 ULA fc00::1", () => {
  assert.throws(
    () => validatePublicUrl("https://[fc00::1]/"),
    /private|reserved|ipv6/i,
  );
});

test("fetchWithRedirectLimit follows a single redirect", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchImpl = async (input) => {
    const href =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    calls.push(href);
    if (calls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://example.com/final" },
      });
    }
    return new Response("hello world", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  };
  const result = await fetchWithRedirectLimit("https://example.com/start", {
    fetchImpl,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body, "hello world");
  assert.equal(result.redirectCount, 1);
  assert.equal(result.truncated, false);
  assert.equal(result.url, "https://example.com/final");
});

test("fetchWithRedirectLimit throws when the redirect cap is exceeded", async () => {
  const fetchImpl: FetchImpl = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com/loop" },
    });
  await assert.rejects(
    () => fetchWithRedirectLimit("https://example.com/start", { fetchImpl }),
    /redirect/i,
  );
});

test("fetchWithRedirectLimit truncates a body larger than MAX_BODY_BYTES", async () => {
  assert.ok(
    ALLOWED_PORTS.includes(443),
    "sanity check: 443 is in ALLOWED_PORTS",
  );
  const bigBody = "A".repeat(MAX_BODY_BYTES + 5_000);
  const fetchImpl: FetchImpl = async () =>
    new Response(bigBody, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  const result = await fetchWithRedirectLimit("https://example.com/", {
    fetchImpl,
  });
  assert.equal(result.truncated, true);
  assert.equal(result.bytes, MAX_BODY_BYTES);
  assert.equal(result.body.length, MAX_BODY_BYTES);
});

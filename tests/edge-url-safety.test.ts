/**
 * Edge-case tests for the URL safety module (lib/url-safety.ts).
 *
 * Each test exercises a boundary: IPv6 literals, IDN domains, very long URLs,
 * port edge cases (80, 443, 8080, 22), redirect chains, data: and file:
 * schemes, etc.
 *
 * Run:  npx tsx --test tests/edge-url-safety.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_PORTS,
  MAX_REDIRECTS,
  fetchWithRedirectLimit,
  validatePublicUrl,
  type FetchImpl,
} from "../lib/url-safety";

test("edge: validatePublicUrl accepts a public IPv6 literal in brackets", () => {
  // 2606:4700::1 is a public Cloudflare IPv6 address.
  const url = validatePublicUrl("https://[2606:4700::1]/path");
  assert.equal(url.hostname, "[2606:4700::1]");
  assert.equal(url.protocol, "https:");
});

test("edge: validatePublicUrl rejects IPv6 loopback ::1", () => {
  assert.throws(
    () => validatePublicUrl("https://[::1]/"),
    /private|reserved|ipv6/i,
  );
});

test("edge: validatePublicUrl rejects IPv6 ULA fc00::1 and link-local fe80::1", () => {
  assert.throws(
    () => validatePublicUrl("https://[fc00::1]/"),
    /private|reserved|ipv6/i,
  );
  assert.throws(
    () => validatePublicUrl("https://[fe80::1]/"),
    /private|reserved|ipv6/i,
  );
  // fd-prefix is also ULA.
  assert.throws(
    () => validatePublicUrl("https://[fd12:3456:789a::1]/"),
    /private|reserved|ipv6/i,
  );
});

test("edge: validatePublicUrl does NOT block IPv4-mapped IPv6 (Node URL parser normalises to hex form)", () => {
  // Node's URL parser converts `https://[::ffff:127.0.0.1]/` into the host
  // `[::ffff:7f00:1]` (pure-hex form), which no longer matches the
  // implementation's `^::ffff:([0-9.]+)$` regex. This is a known limitation
  // of the current SSRF guard — we document it here so future hardening can
  // flip the assertion from "accepts" to "rejects".
  const url = validatePublicUrl("https://[::ffff:127.0.0.1]/");
  // The normalised hostname is the pure-hex form (no dotted-quad).
  assert.equal(url.hostname, "[::ffff:7f00:1]");
  // The same applies to a mapped private IPv4.
  const urlPrivate = validatePublicUrl("https://[::ffff:10.0.0.1]/");
  assert.equal(urlPrivate.hostname, "[::ffff:a00:1]");
});

test("edge: validatePublicUrl accepts IDN domains (auto-punycoded by Node URL parser)", () => {
  // Node's URL parser converts unicode hostnames to punycode automatically.
  const url = validatePublicUrl("https://例え.jp/path");
  assert.equal(url.hostname, "xn--r8jz45g.jp");
  assert.equal(url.protocol, "https:");
  // A pre-punycoded URL is also accepted.
  const punycoded = validatePublicUrl("https://xn--r8jz45g.xn--zckzah/");
  assert.equal(punycoded.hostname, "xn--r8jz45g.xn--zckzah");
});

test("edge: validatePublicUrl accepts a very long URL (8 KB path)", () => {
  // Build an 8 KB path under a public hostname.
  const longPath = "a".repeat(8_000);
  const url = validatePublicUrl(`https://example.com/${longPath}`);
  assert.equal(url.hostname, "example.com");
  assert.ok(url.pathname.length > 7_000);
});

test("edge: validatePublicUrl accepts default ports 80 and 443 (Node strips them from the URL)", () => {
  // Node's URL parser strips the default port for the scheme — 80 for http
  // and 443 for https — so the URL object's `port` becomes "". The validator
  // accepts an empty port unconditionally.
  const http80 = validatePublicUrl("http://example.com:80/path");
  assert.equal(http80.port, "");
  assert.equal(http80.hostname, "example.com");
  const https443 = validatePublicUrl("https://example.com:443/path");
  assert.equal(https443.port, "");
  assert.ok(ALLOWED_PORTS.includes(80));
  assert.ok(ALLOWED_PORTS.includes(443));
  // An explicit non-default port on the same scheme is preserved.
  const https80 = validatePublicUrl("https://example.com:80/path");
  assert.equal(https80.port, "80");
});

test("edge: validatePublicUrl accepts ports 8080, 8443, 3000 and 5173 (non-default allowed)", () => {
  for (const port of [8080, 8443, 3000, 5173]) {
    const url = validatePublicUrl(`https://example.com:${port}/path`);
    assert.equal(Number(url.port), port, `port ${port} should be preserved`);
    assert.ok(ALLOWED_PORTS.includes(port));
  }
});

test("edge: validatePublicUrl rejects non-allowed ports like 22, 21, 25, 3306", () => {
  for (const port of [22, 21, 25, 3306, 9000, 65535]) {
    assert.throws(
      () => validatePublicUrl(`https://example.com:${port}/`),
      /port/i,
      `port ${port} should be rejected`,
    );
  }
});

test("edge: validatePublicUrl rejects data: URLs regardless of payload", () => {
  assert.throws(
    () => validatePublicUrl("data:text/html,<script>alert(1)</script>"),
    /non-http/i,
  );
  assert.throws(
    () => validatePublicUrl("data:image/png;base64,iVBORw0KGgo="),
    /non-http/i,
  );
});

test("edge: validatePublicUrl rejects file: URLs", () => {
  assert.throws(
    () => validatePublicUrl("file:///etc/passwd"),
    /non-http/i,
  );
  assert.throws(
    () => validatePublicUrl("file://localhost/etc/passwd"),
    /non-http/i,
  );
});

test("edge: validatePublicUrl rejects empty, whitespace-only and non-string input", () => {
  assert.throws(() => validatePublicUrl(""), /non-empty/i);
  assert.throws(() => validatePublicUrl("   "), /non-empty/i);
  // @ts-expect-error — deliberately passing a non-string.
  assert.throws(() => validatePublicUrl(null), /non-empty/i);
  // @ts-expect-error — deliberately passing a non-string.
  assert.throws(() => validatePublicUrl(undefined), /non-empty/i);
});

test("edge: fetchWithRedirectLimit follows a chain of MAX_REDIRECTS hops and stops there", async () => {
  // Build a chain that redirects exactly MAX_REDIRECTS times, then succeeds.
  let count = 0;
  const fetchImpl: FetchImpl = async (input) => {
    const href = typeof input === "string" ? input : (input as URL).href ?? (input as Request).url;
    count++;
    if (count <= MAX_REDIRECTS) {
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/hop-${count}` },
      });
    }
    return new Response("final", { status: 200, headers: { "content-type": "text/plain" } });
  };
  const result = await fetchWithRedirectLimit("https://example.com/start", { fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(result.body, "final");
  assert.equal(result.redirectCount, MAX_REDIRECTS);
});

test("edge: fetchWithRedirectLimit rejects a redirect to a private IP via Location header (SSRF guard)", async () => {
  // The validator must re-check every redirect target, even if the original
  // URL was public.
  const fetchImpl: FetchImpl = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/admin" },
    });
  await assert.rejects(
    () => fetchWithRedirectLimit("https://example.com/start", { fetchImpl }),
    /private|reserved|loopback/i,
  );
});

test("edge: fetchWithRedirectLimit throws when a redirect Location header is missing", async () => {
  const fetchImpl: FetchImpl = async () =>
    new Response(null, { status: 302 }); // no Location header
  await assert.rejects(
    () => fetchWithRedirectLimit("https://example.com/start", { fetchImpl }),
    /location/i,
  );
});

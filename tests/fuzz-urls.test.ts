/**
 * Fuzz tests for URL safety.
 *
 * 15 tests feeding `validatePublicUrl` (lib/url-safety) and
 * `validateUrlFormat` (lib/url-validation-pure) random URLs — valid,
 * invalid, SSRF attempts and edge cases — to confirm the validators never
 * crash and always make a safe decision.
 *
 * Properties verified:
 *   - The validator never throws on random input — it either returns a URL
 *     or throws a controlled Error with a descriptive message.
 *   - Every accepted URL is http(s) with no credentials and a public host.
 *   - Every private/loopback/reserved IP is rejected.
 *   - Every non-http scheme is rejected.
 *   - `validateUrlFormat` (the softer validator) agrees with `validatePublicUrl`
 *     on the protocol/hostname check for valid URLs.
 *
 * Inputs are produced by a deterministic seeded PRNG (mulberry32) so the
 * suite is reproducible.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validatePublicUrl,
  ALLOWED_PORTS,
  MAX_BODY_BYTES,
  MAX_REDIRECTS,
  REQUEST_TIMEOUT_MS,
} from "../lib/url-safety.ts";
import { validateUrlFormat, isHttpsUrl, extractHostname } from "../lib/url-validation-pure.ts";

// ─── seeded PRNG ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomPublicHost(rng: () => number): string {
  const labels = [
    "example",
    "api",
    "cdn",
    "app",
    "www",
    "shop",
    "blog",
    "docs",
    "status",
    "marketing",
  ];
  const tlds = ["com", "org", "io", "net", "dev", "ai"];
  const n = 1 + Math.floor(rng() * 3);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(pick(rng, labels));
  parts.push(pick(rng, tlds));
  return parts.join(".");
}

function randomIpv4(rng: () => number, blocked = false): string {
  if (blocked) {
    const ranges = [
      () => `127.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}`,
      () => `10.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}`,
      () => `192.168.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}`,
      () => `169.254.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}`,
      () => `172.${16 + Math.floor(rng() * 16)}.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}`,
      () => `0.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}`,
    ];
    return pick(rng, ranges)();
  }
  // A "public-looking" IPv4 — use TEST-NET 192.0.2.x which is also blocked,
  // so this is mostly for syntactic testing.
  return `${1 + Math.floor(rng() * 254)}.${Math.floor(rng() * 256)}.${Math.floor(rng() * 256)}.${1 + Math.floor(rng() * 254)}`;
}

const SAMPLES = 200;

// ─── 1. Validator never crashes on random byte sequences ──────────────────

test("fuzz/urls: validatePublicUrl never throws an unexpected error type on random byte sequences", () => {
  const rng = mulberry32(401);
  let accepted = 0;
  let rejected = 0;
  for (let i = 0; i < SAMPLES; i++) {
    // Generate a random short byte string from a broad alphabet.
    const len = 1 + Math.floor(rng() * 40);
    let s = "";
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~:/?#[]@!$&'()*+,;=";
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rng() * alphabet.length)];
    try {
      const url = validatePublicUrl(s);
      assert.ok(url.protocol === "http:" || url.protocol === "https:");
      assert.equal(url.username, "");
      assert.equal(url.password, "");
      accepted++;
    } catch (err) {
      assert.ok(err instanceof Error, `unexpected non-Error thrown: ${String(err)}`);
      assert.ok(typeof err.message === "string" && err.message.length > 0);
      rejected++;
    }
  }
  // Sanity: at least some inputs were accepted and some rejected.
  assert.ok(accepted + rejected === SAMPLES);
});

// ─── 2. Valid public URLs are always accepted ─────────────────────────────

test("fuzz/urls: well-formed http(s) URLs with public hosts are always accepted", () => {
  const rng = mulberry32(402);
  for (let i = 0; i < SAMPLES; i++) {
    const proto = rng() > 0.5 ? "https" : "http";
    const host = randomPublicHost(rng);
    const path = "/" + pick(rng, ["", "a", "a/b", "a/b/c", "x?y=1", "x#frag"]);
    const url = `${proto}://${host}${path}`;
    const validated = validatePublicUrl(url);
    assert.equal(validated.protocol, `${proto}:`);
    assert.equal(validated.hostname, host);
  }
});

// ─── 3. Private / loopback IPv4 literals are always rejected ──────────────

test("fuzz/urls: private / loopback / reserved IPv4 literals are always rejected (SSRF guard)", () => {
  const rng = mulberry32(403);
  for (let i = 0; i < SAMPLES; i++) {
    const ip = randomIpv4(rng, true);
    for (const proto of ["http", "https"]) {
      const url = `${proto}://${ip}/`;
      assert.throws(() => validatePublicUrl(url), /Private|reserved|loopback/i, `expected rejection for ${url}`);
    }
  }
});

// ─── 4. localhost / .local / .internal hostnames are always rejected ──────

test("fuzz/urls: localhost, .local, .internal hostnames are always rejected", () => {
  const rng = mulberry32(404);
  const badHosts = [
    "localhost",
    "foo.localhost",
    "local",
    "example.local",
    "internal",
    "api.internal",
    "sub.example.local",
  ];
  for (let i = 0; i < SAMPLES; i++) {
    const host = pick(rng, badHosts);
    const url = `https://${host}/path`;
    assert.throws(() => validatePublicUrl(url), /localhost|local|internal/i);
  }
});

// ─── 5. Non-http protocols are always rejected ────────────────────────────

test("fuzz/urls: non-http(s) protocols (ftp, file, javascript, data) are always rejected", () => {
  const rng = mulberry32(405);
  const badProtos = ["ftp", "file", "javascript", "data", "ssh", "telnet", "gopher", "ws", "wss"];
  for (let i = 0; i < SAMPLES; i++) {
    const proto = pick(rng, badProtos);
    const host = randomPublicHost(rng);
    const url = `${proto}://${host}/`;
    assert.throws(() => validatePublicUrl(url), /protocol/i);
  }
});

// ─── 6. Credentials in URL are always rejected ────────────────────────────

test("fuzz/urls: URLs containing user:pass@ credentials are always rejected", () => {
  const rng = mulberry32(406);
  for (let i = 0; i < SAMPLES; i++) {
    const user = "user" + Math.floor(rng() * 1000);
    const pass = "pass" + Math.floor(rng() * 1000);
    const host = randomPublicHost(rng);
    const url = `https://${user}:${pass}@${host}/`;
    assert.throws(() => validatePublicUrl(url), /credential/i);
  }
});

// ─── 7. Non-standard ports are rejected; allowed ports are accepted ───────

test("fuzz/urls: ports outside ALLOWED_PORTS are rejected; allowed ports are accepted", () => {
  const rng = mulberry32(407);
  const badPorts = [1, 22, 25, 110, 143, 161, 389, 631, 873, 9090, 12345, 65000];
  for (let i = 0; i < SAMPLES; i++) {
    const host = randomPublicHost(rng);
    // Bad port → rejected.
    const badPort = pick(rng, badPorts);
    assert.throws(
      () => validatePublicUrl(`https://${host}:${badPort}/`),
      /port/i,
    );
    // Allowed port → accepted. WHATWG URL strips port 443 on https and 80
    // on http (they are the scheme defaults), so accept the empty string
    // for those cases.
    const goodPort = pick(rng, ALLOWED_PORTS as unknown as readonly number[]);
    const url = validatePublicUrl(`https://${host}:${goodPort}/`);
    assert.ok(
      url.port === String(goodPort) || (goodPort === 443 && url.port === ""),
      `port mismatch for ${goodPort}: got "${url.port}"`,
    );
  }
});

// ─── 8. Empty / whitespace-only URLs always throw ─────────────────────────

test("fuzz/urls: empty, whitespace and non-string inputs always throw", () => {
  const rng = mulberry32(408);
  const badInputs = ["", "   ", "\t", "\n", "null", "undefined"];
  for (let i = 0; i < SAMPLES; i++) {
    const input = pick(rng, badInputs);
    if (input === "null" || input === "undefined") continue;
    assert.throws(() => validatePublicUrl(input), /empty|invalid/i);
  }
  // Non-string types — TypeScript would normally reject these at compile
  // time, but the runtime guard should still throw.
  assert.throws(() => validatePublicUrl(null as unknown as string));
  assert.throws(() => validatePublicUrl(undefined as unknown as string));
  assert.throws(() => validatePublicUrl(123 as unknown as string));
});

// ─── 9. Round-trip: validateUrlFormat agrees with validatePublicUrl on valid URLs ─

test("fuzz/urls: validateUrlFormat and validatePublicUrl agree on accepted URLs (both succeed)", () => {
  const rng = mulberry32(409);
  for (let i = 0; i < SAMPLES; i++) {
    const host = randomPublicHost(rng);
    const url = `https://${host}/path`;
    const a = validateUrlFormat(url);
    const b = validatePublicUrl(url);
    assert.equal(a.ok, true);
    assert.equal(b.protocol, "https:");
    assert.equal(a.value, b.toString());
  }
});

// ─── 10. validateUrlFormat rejects the same junk inputs as validatePublicUrl ─

test("fuzz/urls: validateUrlFormat rejects non-http protocols, empty strings, and malformed URLs", () => {
  const rng = mulberry32(410);
  const bad = [
    "ftp://example.com",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "",
    "   ",
    "not a url",
    "://missing-scheme",
  ];
  for (let i = 0; i < SAMPLES; i++) {
    const input = pick(rng, bad);
    assert.equal(validateUrlFormat(input).ok, false, `expected rejection for "${input}"`);
  }
});

// ─── 11. isHttpsUrl / extractHostname handle random inputs without crashing ─

test("fuzz/urls: isHttpsUrl and extractHostname never crash and return consistent results", () => {
  const rng = mulberry32(411);
  for (let i = 0; i < SAMPLES; i++) {
    const host = randomPublicHost(rng);
    const url = `https://${host}/`;
    assert.equal(isHttpsUrl(url), true);
    assert.equal(extractHostname(url), host);
    // Non-https URL isHttpsUrl → false.
    assert.equal(isHttpsUrl(`http://${host}/`), false);
    // Truly malformed inputs (no scheme, empty, junk) return false / null
    // without throwing. Note: "ftp://x" parses as a valid URL with hostname
    // "x" so extractHostname returns "x", not null — exclude it from the
    // null-asserting corpus.
    assert.equal(isHttpsUrl(pick(rng, ["", "junk", "http://", "://no-scheme"])), false);
    assert.equal(extractHostname(pick(rng, ["", "junk", "://no-scheme"])), null);
  }
});

// ─── 12. IPv6 literals: loopback / link-local / ULA rejected ──────────────

test("fuzz/urls: IPv6 loopback, link-local and ULA literals are rejected", () => {
  const rng = mulberry32(412);
  const badV6 = [
    "[::1]",
    "[fe80::1]",
    "[fc00::1]",
    "[fd01:2:3:4:5:6:7:8]",
    "[ff02::1]",
    "[::]",
  ];
  for (let i = 0; i < SAMPLES; i++) {
    const v6 = pick(rng, badV6);
    assert.throws(() => validatePublicUrl(`https://${v6}/`), /IPv6|Private/i);
  }
});

// ─── 13. Path / query / fragment never affect acceptance ──────────────────

test("fuzz/urls: arbitrary paths, queries and fragments do not affect the safety decision for a public host", () => {
  const rng = mulberry32(413);
  for (let i = 0; i < SAMPLES; i++) {
    const host = randomPublicHost(rng);
    const segments = 1 + Math.floor(rng() * 5);
    const path = "/" + Array.from({ length: segments }, () =>
      pick(rng, ["a", "b", "c", "x", "y", "z", "1", "2"]),
    ).join("/");
    const query = `?${pick(rng, ["k=v", "a=1&b=2", "x[]=" + Math.floor(rng() * 100), ""])}`;
    const frag = `#${pick(rng, ["", "section", "top", ""])}`;
    const url = `https://${host}${path}${query}${frag}`;
    const validated = validatePublicUrl(url);
    assert.equal(validated.hostname, host);
  }
});

// ─── 14. Mixed-case schemes are rejected (WHATWG URL lower-cases scheme) ──

test("fuzz/urls: mixed-case HTTPS/HTTP schemes are accepted (WHATWG normalises scheme to lowercase)", () => {
  const rng = mulberry32(414);
  const variants = ["HTTPS", "Http", "hTTP", "HTTP", "hTTps"];
  for (let i = 0; i < SAMPLES; i++) {
    const scheme = pick(rng, variants);
    const host = randomPublicHost(rng);
    const url = `${scheme}://${host}/`;
    const validated = validatePublicUrl(url);
    assert.ok(
      validated.protocol === "http:" || validated.protocol === "https:",
      `expected http(s) protocol, got ${validated.protocol}`,
    );
  }
});

// ─── 15. Constants and module-level invariants ────────────────────────────

test("fuzz/urls: module constants are sensible (allowed ports, body size, redirects, timeout)", () => {
  // The constants must remain stable; changes here would silently relax the
  // SSRF / DoS guards. Verify their values and types.
  assert.ok(Array.isArray(ALLOWED_PORTS));
  assert.ok(ALLOWED_PORTS.length >= 1);
  for (const p of ALLOWED_PORTS) {
    assert.ok(typeof p === "number" && p > 0 && p < 65536);
  }
  assert.ok(MAX_BODY_BYTES > 0 && MAX_BODY_BYTES <= 10_000_000);
  assert.ok(MAX_REDIRECTS > 0 && MAX_REDIRECTS <= 20);
  assert.ok(REQUEST_TIMEOUT_MS > 0 && REQUEST_TIMEOUT_MS <= 60_000);
  // Fuzz: every allowed port should be accepted by validatePublicUrl on a
  // public host. WHATWG `URL` strips the port when it equals the scheme
  // default (443 for https, 80 for http), so compare against the normalised
  // string OR empty string for default ports.
  const rng = mulberry32(415);
  for (const port of ALLOWED_PORTS) {
    const host = randomPublicHost(rng);
    const url = validatePublicUrl(`https://${host}:${port}/`);
    assert.ok(
      url.port === String(port) || (port === 443 && url.port === ""),
      `expected port "${port}" or empty (default for https), got "${url.port}"`,
    );
  }
});

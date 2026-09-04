import { test } from "node:test";
import assert from "node:assert/strict";

import {
  utf8Encode,
  utf8Decode,
  urlEncode,
  urlDecode,
  htmlEncode,
  htmlDecode,
  base64Encode,
  base64Decode,
  base64UrlEncode,
  base64UrlDecode,
} from "../lib/encoding-pure.ts";

test("utf8Encode round-trips an ASCII string", () => {
  const bytes = utf8Encode("hello");
  assert.deepEqual(Array.from(bytes), [104, 101, 108, 108, 111]);
  assert.equal(utf8Decode(bytes), "hello");
});

test("utf8Encode encodes multibyte characters correctly", () => {
  const bytes = utf8Encode("ñ");
  // U+00F1 → 0xC3 0xB1 in UTF-8
  assert.deepEqual(Array.from(bytes), [0xc3, 0xb1]);
  assert.equal(utf8Decode(bytes), "ñ");
});

test("utf8Decode accepts a plain number[] as well as Uint8Array", () => {
  assert.equal(utf8Decode([104, 105]), "hi");
});

test("urlEncode / urlDecode round-trip reserved characters", () => {
  const raw = "hello world&foo=bar/baz?qux";
  assert.equal(urlDecode(urlEncode(raw)), raw);
  assert.equal(urlEncode(" "), "%20");
});

test("urlEncode encodes reserved characters that need escaping", () => {
  // encodeURIComponent leaves unreserved chars (A-Za-z0-9-_.!~*'()) alone,
  // and percent-encodes everything else.
  assert.equal(urlEncode(" "), "%20");
  assert.equal(urlEncode("a/b"), "a%2Fb");
  assert.equal(urlEncode("a?b=c&d"), "a%3Fb%3Dc%26d");
  assert.equal(urlEncode("a#b"), "a%23b");
});

test("urlDecode throws on malformed percent-encoding", () => {
  assert.throws(() => urlDecode("%zz"), URIError);
});

test("htmlEncode escapes the five significant HTML characters", () => {
  assert.equal(
    htmlEncode(`<a href="x">Tom & Jerry's</a>`),
    "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
  );
});

test("htmlDecode reverses htmlEncode exactly", () => {
  const raw = `<script>alert("x" && 'y')</script>`;
  assert.equal(htmlDecode(htmlEncode(raw)), raw);
});

test("htmlDecode leaves unrelated entities untouched", () => {
  assert.equal(htmlDecode("plain &amp; text &copy;"), "plain & text &copy;");
});

test("base64Encode produces standard alphabet with padding", () => {
  assert.equal(base64Encode(""), "");
  assert.equal(base64Encode("f"), "Zg==");
  assert.equal(base64Encode("fo"), "Zm8=");
  assert.equal(base64Encode("foo"), "Zm9v");
  assert.equal(base64Encode("foob"), "Zm9vYg==");
  assert.equal(base64Encode("fooba"), "Zm9vYmE=");
  assert.equal(base64Encode("foobar"), "Zm9vYmFy");
});

test("base64Decode round-trips arbitrary UTF-8 strings", () => {
  const samples = ["", "f", "fo", "foo", "foob", "fooba", "foobar", "héllo 世界"];
  for (const s of samples) {
    assert.equal(base64Decode(base64Encode(s)), s);
  }
});

test("base64Decode throws on bad length", () => {
  assert.throws(() => base64Decode("abc"), /Invalid base64 length/);
});

test("base64UrlEncode omits padding and uses URL-safe alphabet", () => {
  // 3 bytes → 4 chars, no padding
  assert.equal(base64UrlEncode("foo"), "Zm9v");
  // 1 byte: standard Zg==, URL-safe Zg
  assert.equal(base64UrlEncode("f"), "Zg");
  // Bytes that would produce + and / in standard base64
  // 0xfb 0xff 0xbf → standard base64 "+/+/" → url-safe "-_-_" then strip pad
  const bytes = Uint8Array.from([0xfb, 0xff, 0xbf]);
  assert.equal(base64UrlEncode(bytes), "-_-_");
});

test("base64UrlDecode round-trips URL-safe encoded values", () => {
  const samples = ["f", "fo", "foo", "foob", "fooba", "foobar", "héllo 世界"];
  for (const s of samples) {
    assert.equal(base64UrlDecode(base64UrlEncode(s)), s);
  }
});

test("base64UrlDecode accepts standard base64 too (after padding fix)", () => {
  // base64Encode returns padded standard form; base64UrlDecode should accept it.
  assert.equal(base64UrlDecode(base64Encode("hello world")), "hello world");
});

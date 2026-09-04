import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decodeJwtPayload,
  isJwtExpired,
  extractUserId,
  validateJwtStructure,
} from "../lib/jwt-helpers-pure";

/** Build an unsigned JWT for testing. payload is JSON-encoded. */
function makeJwt(payload: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj), "utf8")
      .toString("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64url(header)}.${b64url(payload)}.signature`;
}

test("validateJwtStructure accepts a well-formed token", () => {
  const r = validateJwtStructure("aaa.bbb.ccc");
  assert.equal(r.ok, true);
  assert.equal(r.error, undefined);
});

test("validateJwtStructure rejects non-string, empty and malformed inputs", () => {
  assert.equal(validateJwtStructure(42).ok, false);
  assert.equal(validateJwtStructure(null).ok, false);
  assert.equal(validateJwtStructure("").ok, false);
  assert.equal(validateJwtStructure("aaa.bbb").ok, false);
  assert.equal(validateJwtStructure("aaa.bbb.ccc.ddd").ok, false);
});

test("decodeJwtPayload returns the parsed payload for a valid token", () => {
  const token = makeJwt({ sub: "user-123", exp: 1234567890, custom: "x" });
  const payload = decodeJwtPayload(token);
  assert.equal(payload?.sub, "user-123");
  assert.equal(payload?.exp, 1234567890);
  assert.equal(payload?.custom, "x");
});

test("decodeJwtPayload returns null for tokens with non-JSON payloads or invalid structure", () => {
  assert.equal(decodeJwtPayload("header.!!notjson!!.sig"), null);
  assert.equal(decodeJwtPayload("not-a-jwt"), null);
  assert.equal(decodeJwtPayload(123), null);
});

test("isJwtExpired returns true when exp is in the past and false when in the future", () => {
  assert.equal(isJwtExpired(makeJwt({ exp: 1 }), 1_000_000), true);
  assert.equal(isJwtExpired(makeJwt({ exp: 9_999_999_999 }), 1_000_000), false);
});

test("isJwtExpired returns false when exp is absent", () => {
  const token = makeJwt({ sub: "x" });
  assert.equal(isJwtExpired(token, 1_000_000), false);
});

test("isJwtExpired applies graceMs as a skew tolerance", () => {
  const nowSec = 1_000_000;
  const token = makeJwt({ exp: nowSec });
  // exp == now -> expired without grace
  assert.equal(isJwtExpired(token, nowSec * 1000), true);
  // with 5s grace, still valid
  assert.equal(isJwtExpired(token, nowSec * 1000, 5_000), false);
});

test("isJwtExpired returns true when the token is unparseable", () => {
  assert.equal(isJwtExpired("garbage", 1_000_000), true);
  assert.equal(isJwtExpired(null, 1_000_000), true);
});

test("extractUserId returns the sub claim when present", () => {
  const token = makeJwt({ sub: "user-42" });
  assert.equal(extractUserId(token), "user-42");
});

test("extractUserId returns null when sub is missing, empty or invalid", () => {
  assert.equal(extractUserId(makeJwt({ sub: "" })), null);
  assert.equal(extractUserId(makeJwt({ sub: 42 })), null);
  assert.equal(extractUserId(makeJwt({})), null);
  assert.equal(extractUserId("garbage"), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractBearerToken,
  isAuthorized,
  hasPermission,
  checkRole,
} from "../lib/auth-helpers-pure.ts";

test("extractBearerToken extracts the token from a valid Bearer header", () => {
  assert.equal(extractBearerToken("Bearer abc123"), "abc123");
});

test("extractBearerToken is case-insensitive on the Bearer scheme", () => {
  assert.equal(extractBearerToken("bearer xyz"), "xyz");
  assert.equal(extractBearerToken("BEARER  token"), "token");
});

test("extractBearerToken trims whitespace around the token", () => {
  assert.equal(extractBearerToken("Bearer   spaced   "), "spaced");
});

test("extractBearerToken returns null when the scheme is not Bearer or the token is empty", () => {
  assert.equal(extractBearerToken("Basic abc123"), null);
  assert.equal(extractBearerToken("abc123"), null);
  assert.equal(extractBearerToken("Bearer "), null);
  assert.equal(extractBearerToken("Bearer"), null);
});

test("extractBearerToken returns null for undefined or null input", () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken(""), null);
});

test("isAuthorized returns true when the subject has a non-empty userId", () => {
  assert.equal(isAuthorized({ userId: "usr_1" }), true);
});

test("isAuthorized returns false when the subject has no userId or is null", () => {
  assert.equal(isAuthorized({ userId: null }), false);
  assert.equal(isAuthorized({ role: "admin" }), false);
  assert.equal(isAuthorized(null), false);
  assert.equal(isAuthorized(undefined), false);
});

test("hasPermission returns true when the permission is in the subject list", () => {
  assert.equal(
    hasPermission(
      { userId: "u", permissions: ["read", "write"] },
      "write",
    ),
    true,
  );
});

test("hasPermission returns true when the subject has the wildcard permission", () => {
  assert.equal(
    hasPermission({ userId: "u", permissions: ["*"] }, "anything"),
    true,
  );
});

test("hasPermission returns false when the subject is anonymous or lacks the permission", () => {
  assert.equal(hasPermission(null, "read"), false);
  assert.equal(
    hasPermission({ userId: "u", permissions: ["read"] }, "write"),
    false,
  );
  assert.equal(
    hasPermission({ userId: "u", permissions: [] }, "read"),
    false,
  );
});

test("checkRole returns true when the subject's role matches the required role", () => {
  assert.equal(checkRole({ userId: "u", role: "admin" }, "admin"), true);
  assert.equal(
    checkRole({ userId: "u", role: "editor" }, ["admin", "editor"]),
    true,
  );
});

test("checkRole returns false when the subject is anonymous or the role does not match", () => {
  assert.equal(checkRole(null, "admin"), false);
  assert.equal(checkRole({ userId: "u" }, "admin"), false);
  assert.equal(checkRole({ userId: "u", role: "viewer" }, "admin"), false);
  assert.equal(
    checkRole({ userId: "u", role: "viewer" }, ["admin", "editor"]),
    false,
  );
});

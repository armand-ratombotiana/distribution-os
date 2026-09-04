import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getStatusText,
  isSuccess,
  isRedirect,
  isError,
  isClientError,
  isServerError,
} from "../lib/status-codes-pure.ts";

test("getStatusText returns the canonical reason phrase for known codes", () => {
  assert.equal(getStatusText(200), "OK");
  assert.equal(getStatusText(404), "Not Found");
  assert.equal(getStatusText(500), "Internal Server Error");
  assert.equal(getStatusText(429), "Too Many Requests");
});

test("getStatusText returns \"Unknown\" for unrecognized codes", () => {
  assert.equal(getStatusText(799), "Unknown");
  assert.equal(getStatusText(0), "Unknown");
});

test("isSuccess returns true for 2xx codes", () => {
  assert.equal(isSuccess(200), true);
  assert.equal(isSuccess(201), true);
  assert.equal(isSuccess(204), true);
  assert.equal(isSuccess(299), true);
});

test("isSuccess returns false for non-2xx codes", () => {
  assert.equal(isSuccess(199), false);
  assert.equal(isSuccess(300), false);
  assert.equal(isSuccess(404), false);
  assert.equal(isSuccess(500), false);
});

test("isRedirect returns true for 3xx codes", () => {
  assert.equal(isRedirect(301), true);
  assert.equal(isRedirect(302), true);
  assert.equal(isRedirect(304), true);
  assert.equal(isRedirect(308), true);
});

test("isRedirect returns false for non-3xx codes", () => {
  assert.equal(isRedirect(200), false);
  assert.equal(isRedirect(400), false);
  assert.equal(isRedirect(500), false);
});

test("isError returns true for both 4xx and 5xx codes", () => {
  assert.equal(isError(400), true);
  assert.equal(isError(404), true);
  assert.equal(isError(429), true);
  assert.equal(isError(500), true);
  assert.equal(isError(503), true);
});

test("isError returns false for 2xx and 3xx codes", () => {
  assert.equal(isError(200), false);
  assert.equal(isError(204), false);
  assert.equal(isError(301), false);
  assert.equal(isError(304), false);
});

test("isClientError returns true for 4xx codes", () => {
  assert.equal(isClientError(400), true);
  assert.equal(isClientError(401), true);
  assert.equal(isClientError(422), true);
  assert.equal(isClientError(499), true);
});

test("isClientError returns false for 5xx codes", () => {
  assert.equal(isClientError(500), false);
  assert.equal(isClientError(503), false);
  assert.equal(isClientError(599), false);
});

test("isServerError returns true for 5xx codes", () => {
  assert.equal(isServerError(500), true);
  assert.equal(isServerError(501), true);
  assert.equal(isServerError(503), true);
  assert.equal(isServerError(599), true);
});

test("isServerError returns false for 4xx codes and 6xx+ codes", () => {
  assert.equal(isServerError(499), false);
  assert.equal(isServerError(404), false);
  assert.equal(isServerError(600), false);
});

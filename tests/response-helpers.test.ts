import { test } from "node:test";
import assert from "node:assert/strict";

import {
  jsonResponse,
  errorResponse,
  paginatedResponse,
  noContentResponse,
} from "../lib/response-helpers-pure.ts";

test("jsonResponse defaults to status 200", () => {
  const res = jsonResponse({ ok: true });
  assert.equal(res.status, 200);
});

test("jsonResponse sets the content-type header to application/json", () => {
  const res = jsonResponse({});
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
});

test("jsonResponse accepts a custom status code", () => {
  const res = jsonResponse({ created: true }, 201);
  assert.equal(res.status, 201);
});

test("jsonResponse merges custom headers on top of defaults", () => {
  const res = jsonResponse({}, 200, { "x-trace-id": "abc" });
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(res.headers["x-trace-id"], "abc");
});

test("jsonResponse allows the caller to override content-type", () => {
  const res = jsonResponse({}, 200, { "content-type": "text/plain" });
  assert.equal(res.headers["content-type"], "text/plain");
});

test("errorResponse wraps the message in a standard error envelope", () => {
  const res = errorResponse("boom");
  assert.deepEqual(res.body, { error: { message: "boom" } });
  assert.equal(res.status, 500);
});

test("errorResponse accepts a custom status code", () => {
  const res = errorResponse("not found", 404);
  assert.equal(res.status, 404);
});

test("errorResponse includes code and details when provided", () => {
  const res = errorResponse("bad input", 422, {
    code: "INVALID_SLUG",
    details: { field: "slug" },
  });
  assert.deepEqual(res.body, {
    error: {
      message: "bad input",
      code: "INVALID_SLUG",
      details: { field: "slug" },
    },
  });
});

test("paginatedResponse includes items and meta with computed totalPages", () => {
  const res = paginatedResponse([1, 2, 3], 1, 3, 10);
  assert.equal(res.status, 200);
  const body = res.body as { items: number[]; meta: Record<string, number | boolean> };
  assert.deepEqual(body.items, [1, 2, 3]);
  assert.equal(body.meta.totalPages, 4);
  assert.equal(body.meta.total, 10);
});

test("paginatedResponse reports hasNextPage and hasPrevPage correctly", () => {
  const mid = paginatedResponse([], 2, 10, 30);
  const meta = (mid.body as { meta: Record<string, unknown> }).meta;
  assert.equal(meta.hasNextPage, true);
  assert.equal(meta.hasPrevPage, true);

  const last = paginatedResponse([], 3, 10, 30);
  const metaLast = (last.body as { meta: Record<string, unknown> }).meta;
  assert.equal(metaLast.hasNextPage, false);
  assert.equal(metaLast.hasPrevPage, true);
});

test("noContentResponse returns 204 with a null body and no content-type", () => {
  const res = noContentResponse();
  assert.equal(res.status, 204);
  assert.equal(res.body, null);
  assert.equal(res.headers["content-type"], undefined);
});

test("noContentResponse preserves caller-supplied headers", () => {
  const res = noContentResponse({ "x-foo": "bar" });
  assert.equal(res.headers["x-foo"], "bar");
});

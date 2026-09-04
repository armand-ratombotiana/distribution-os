import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ERROR_STATUS_MAP,
  createApiError,
  authRequired,
  forbidden,
  notFound,
  validationError,
  conflict,
  gone,
  rateLimited,
  budgetExceeded,
  internalError,
  toResponse,
  fromThrownError,
} from "../lib/api-errors-pure.js";

test("ERROR_STATUS_MAP maps each error type to its canonical HTTP status", () => {
  assert.equal(ERROR_STATUS_MAP.auth_required, 401);
  assert.equal(ERROR_STATUS_MAP.forbidden, 403);
  assert.equal(ERROR_STATUS_MAP.not_found, 404);
  assert.equal(ERROR_STATUS_MAP.validation, 422);
  assert.equal(ERROR_STATUS_MAP.rate_limited, 429);
  assert.equal(ERROR_STATUS_MAP.budget_exceeded, 402);
  assert.equal(ERROR_STATUS_MAP.internal, 500);
});

test("createApiError derives the HTTP status from the error type", () => {
  const error = createApiError("conflict", "duplicate slug");
  assert.equal(error.type, "conflict");
  assert.equal(error.status, 409);
  assert.equal(error.message, "duplicate slug");
});

test("createApiError preserves code, details and cause when provided", () => {
  const error = createApiError("validation", "bad input", {
    code: "INVALID_SLUG",
    details: { field: "slug" },
    cause: new Error("root"),
  });
  assert.equal(error.code, "INVALID_SLUG");
  assert.deepEqual(error.details, { field: "slug" });
  assert.ok(error.cause instanceof Error);
});

test("authRequired creates a 401 error with a default message", () => {
  const error = authRequired();
  assert.equal(error.status, 401);
  assert.match(error.message, /authentication/i);
});

test("forbidden creates a 403 error", () => {
  const error = forbidden();
  assert.equal(error.status, 403);
  assert.equal(error.type, "forbidden");
});

test("notFound creates a 404 error and includes the resource name when given", () => {
  const error = notFound("Workspace not found", "workspace");
  assert.equal(error.status, 404);
  assert.deepEqual(error.details, { resource: "workspace" });
});

test("validationError creates a 422 error with a list of field errors", () => {
  const error = validationError([
    { field: "email", message: "Invalid email" },
  ]);
  assert.equal(error.status, 422);
  assert.deepEqual(error.details, {
    errors: [{ field: "email", message: "Invalid email" }],
  });
});

test("conflict creates a 409 error", () => {
  const error = conflict();
  assert.equal(error.status, 409);
});

test("gone creates a 410 error", () => {
  const error = gone();
  assert.equal(error.status, 410);
});

test("rateLimited creates a 429 error and includes retryAfter when provided", () => {
  const error = rateLimited(60);
  assert.equal(error.status, 429);
  assert.equal(error.retryAfter, 60);
});

test("budgetExceeded creates a 402 error and includes the budget when provided", () => {
  const error = budgetExceeded("Spend cap reached", 100);
  assert.equal(error.status, 402);
  assert.deepEqual(error.details, { budget: 100 });
});

test("internalError creates a 500 error with a default message", () => {
  const error = internalError();
  assert.equal(error.status, 500);
  assert.match(error.message, /internal/i);
});

test("toResponse serializes the error into a JSON-friendly response shape", () => {
  const response = toResponse(rateLimited(30, "Slow down"));
  assert.equal(response.status, 429);
  assert.equal(response.body.error.type, "rate_limited");
  assert.equal(response.body.error.message, "Slow down");
  assert.equal(response.body.error.retryAfter, 30);
});

test("fromThrownError passes through already-shaped ApiError objects", () => {
  const original = validationError([{ field: "x", message: "required" }]);
  const normalized = fromThrownError(original);
  assert.equal(normalized, original);
});

test("fromThrownError wraps generic Error instances as internal errors", () => {
  const error = fromThrownError(new Error("boom"));
  assert.equal(error.type, "internal");
  assert.equal(error.status, 500);
  assert.equal(error.message, "boom");
});

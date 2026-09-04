/**
 * Comprehensive API-error coverage. Verifies every error type, its canonical
 * HTTP status, the constructor helpers, the response serializer, and the
 * `fromThrownError` normaliser.
 *
 * 15 tests, all pure.
 */
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
  type ApiError,
  type ApiErrorType,
} from "../lib/api-errors-pure.ts";

// ─── ERROR_STATUS_MAP ─────────────────────────────────────────────────────

test("api-errors/ERROR_STATUS_MAP: maps every error type to its canonical HTTP status", () => {
  const expected: Record<ApiErrorType, number> = {
    auth_required: 401,
    forbidden: 403,
    not_found: 404,
    validation: 422,
    conflict: 409,
    gone: 410,
    rate_limited: 429,
    budget_exceeded: 402,
    internal: 500,
  };
  for (const [type, status] of Object.entries(expected)) {
    assert.equal(ERROR_STATUS_MAP[type as ApiErrorType], status);
  }
  // Every type appears in the map.
  assert.equal(Object.keys(ERROR_STATUS_MAP).length, 9);
});

// ─── createApiError ───────────────────────────────────────────────────────

test("api-errors/createApiError: derives status from type and preserves code/details/cause", () => {
  const error = createApiError("conflict", "duplicate slug");
  assert.equal(error.type, "conflict");
  assert.equal(error.status, 409);
  assert.equal(error.message, "duplicate slug");
  assert.equal(error.code, undefined);
  assert.equal(error.details, undefined);

  const withOpts = createApiError("validation", "bad input", {
    code: "INVALID_SLUG",
    details: { field: "slug" },
    cause: new Error("root"),
  });
  assert.equal(withOpts.code, "INVALID_SLUG");
  assert.deepEqual(withOpts.details, { field: "slug" });
  assert.ok(withOpts.cause instanceof Error);
});

test("api-errors/createApiError: omits optional fields entirely (not just undefined values)", () => {
  // No options → no optional keys on the object at all.
  const minimal = createApiError("not_found", "missing");
  assert.deepEqual(Object.keys(minimal).sort(), ["message", "status", "type"]);
  // Partial options → only the supplied ones appear.
  const withRetry = createApiError("rate_limited", "slow", { retryAfter: 5 });
  assert.deepEqual(Object.keys(withRetry).sort(), ["message", "retryAfter", "status", "type"]);
});

// ─── authRequired + forbidden ─────────────────────────────────────────────

test("api-errors/authRequired + forbidden: 401 and 403 with sensible default messages", () => {
  const a = authRequired();
  assert.equal(a.status, 401);
  assert.equal(a.type, "auth_required");
  assert.match(a.message, /authentication/i);

  const aCustom = authRequired("Login required");
  assert.equal(aCustom.message, "Login required");

  const f = forbidden();
  assert.equal(f.status, 403);
  assert.equal(f.type, "forbidden");
  assert.match(f.message, /access/i);
});

// ─── notFound + validationError ───────────────────────────────────────────

test("api-errors/notFound + validationError: 404 with resource detail; 422 with field errors", () => {
  const n = notFound("Workspace not found", "workspace");
  assert.equal(n.status, 404);
  assert.deepEqual(n.details, { resource: "workspace" });

  const nPlain = notFound();
  assert.equal(nPlain.details, undefined);

  const v = validationError([
    { field: "email", message: "Invalid email" },
    { field: "name", message: "Required" },
  ]);
  assert.equal(v.status, 422);
  assert.equal(v.type, "validation");
  assert.deepEqual(v.details, {
    errors: [
      { field: "email", message: "Invalid email" },
      { field: "name", message: "Required" },
    ],
  });
});

// ─── conflict + gone ──────────────────────────────────────────────────────

test("api-errors/conflict + gone: 409 and 410 with default messages", () => {
  const c = conflict();
  assert.equal(c.status, 409);
  assert.equal(c.type, "conflict");
  assert.match(c.message, /already exists/i);

  const cCustom = conflict("Slug taken");
  assert.equal(cCustom.message, "Slug taken");

  const g = gone();
  assert.equal(g.status, 410);
  assert.equal(g.type, "gone");
  assert.match(g.message, /no longer available/i);
});

// ─── rateLimited + budgetExceeded ─────────────────────────────────────────

test("api-errors/rateLimited + budgetExceeded: 429 with retryAfter; 402 with budget amount", () => {
  const r = rateLimited(60);
  assert.equal(r.status, 429);
  assert.equal(r.type, "rate_limited");
  assert.equal(r.retryAfter, 60);

  const rNoRetry = rateLimited();
  assert.equal(rNoRetry.retryAfter, undefined);

  const b = budgetExceeded("Spend cap reached", 100);
  assert.equal(b.status, 402);
  assert.equal(b.type, "budget_exceeded");
  assert.deepEqual(b.details, { budget: 100 });

  const bNoBudget = budgetExceeded();
  assert.equal(bNoBudget.details, undefined);
});

// ─── internalError ────────────────────────────────────────────────────────

test("api-errors/internalError: 500 with default and custom messages", () => {
  const i = internalError();
  assert.equal(i.status, 500);
  assert.equal(i.type, "internal");
  assert.match(i.message, /internal/i);

  const iCustom = internalError("DB down");
  assert.equal(iCustom.message, "DB down");
});

// ─── toResponse ───────────────────────────────────────────────────────────

test("api-errors/toResponse: serializes a basic error into a JSON-friendly response shape", () => {
  const response = toResponse(forbidden("No access"));
  assert.equal(response.status, 403);
  assert.equal(response.body.error.type, "forbidden");
  assert.equal(response.body.error.message, "No access");
  // Optional fields are absent on a basic error.
  assert.equal("code" in response.body.error, false);
  assert.equal("details" in response.body.error, false);
  assert.equal("retryAfter" in response.body.error, false);
});

test("api-errors/toResponse: preserves code, details, and retryAfter when present", () => {
  const error = createApiError("rate_limited", "Slow down", {
    code: "RATE_LIMITED",
    details: { scope: "workspace" },
    retryAfter: 30,
  });
  const response = toResponse(error);
  assert.equal(response.status, 429);
  assert.equal(response.body.error.code, "RATE_LIMITED");
  assert.deepEqual(response.body.error.details, { scope: "workspace" });
  assert.equal(response.body.error.retryAfter, 30);
});

// ─── fromThrownError ──────────────────────────────────────────────────────

test("api-errors/fromThrownError: passes already-shaped ApiError objects through unchanged", () => {
  const original: ApiError = validationError([
    { field: "x", message: "required" },
  ]);
  const normalized = fromThrownError(original);
  assert.equal(normalized, original); // identity check
  assert.equal(normalized.status, 422);
});

test("api-errors/fromThrownError: wraps generic Error instances as 500 internal errors", () => {
  const error = fromThrownError(new Error("boom"));
  assert.equal(error.type, "internal");
  assert.equal(error.status, 500);
  assert.equal(error.message, "boom");
});

test("api-errors/fromThrownError: wraps a string as an internal error with that message", () => {
  const fromString = fromThrownError("something went wrong");
  assert.equal(fromString.type, "internal");
  assert.equal(fromString.status, 500);
  assert.equal(fromString.message, "something went wrong");
});

test("api-errors/fromThrownError: wraps null, undefined, and arbitrary objects as generic internal errors", () => {
  // Unknown object input.
  const fromUnknown = fromThrownError({ random: "object" });
  assert.equal(fromUnknown.type, "internal");
  assert.equal(fromUnknown.status, 500);
  assert.match(fromUnknown.message, /unknown/i);

  // Null.
  const fromNull = fromThrownError(null);
  assert.equal(fromNull.type, "internal");
  assert.equal(fromNull.status, 500);

  // Undefined.
  const fromUndefined = fromThrownError(undefined);
  assert.equal(fromUndefined.type, "internal");
  assert.equal(fromUndefined.status, 500);
});

// ─── cross-cutting invariant ──────────────────────────────────────────────

test("api-errors/cross-cutting: every constructor helper returns an ApiError whose status matches ERROR_STATUS_MAP", () => {
  const cases: Array<{ type: ApiErrorType; error: ApiError }> = [
    { type: "auth_required", error: authRequired() },
    { type: "forbidden", error: forbidden() },
    { type: "not_found", error: notFound() },
    { type: "validation", error: validationError([{ field: "x", message: "y" }]) },
    { type: "conflict", error: conflict() },
    { type: "gone", error: gone() },
    { type: "rate_limited", error: rateLimited(30) },
    { type: "budget_exceeded", error: budgetExceeded() },
    { type: "internal", error: internalError() },
  ];
  for (const { type, error } of cases) {
    assert.equal(error.type, type);
    assert.equal(error.status, ERROR_STATUS_MAP[type]);
    assert.ok(typeof error.message === "string" && error.message.length > 0);
    // Every helper result serialises without throwing.
    const response = toResponse(error);
    assert.equal(response.status, error.status);
    assert.equal(response.body.error.type, type);
  }
});

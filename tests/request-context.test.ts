import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractRequestId,
  extractWorkspaceId,
  extractUserId,
  buildRequestContext,
} from "../lib/request-context-pure.ts";

test("extractRequestId returns the value of x-request-id when present", () => {
  assert.equal(extractRequestId({ "x-request-id": "req_123" }), "req_123");
});

test("extractRequestId falls back to x-correlation-id", () => {
  assert.equal(
    extractRequestId({ "x-correlation-id": "corr_456" }),
    "corr_456",
  );
});

test("extractRequestId is case-insensitive on header names", () => {
  assert.equal(
    extractRequestId({ "X-Request-ID": "req_789" }),
    "req_789",
  );
});

test("extractRequestId trims surrounding whitespace", () => {
  assert.equal(extractRequestId({ "x-request-id": "  req_trim  " }), "req_trim");
});

test("extractRequestId returns null when no request-id header is present", () => {
  assert.equal(extractRequestId({ "content-type": "application/json" }), null);
});

test("extractWorkspaceId returns the value of x-workspace-id when present", () => {
  assert.equal(
    extractWorkspaceId({ "x-workspace-id": "ws_abc" }),
    "ws_abc",
  );
});

test("extractWorkspaceId falls back to x-workspace and is case-insensitive", () => {
  assert.equal(
    extractWorkspaceId({ "X-Workspace": "ws_xyz" }),
    "ws_xyz",
  );
});

test("extractWorkspaceId returns null when no workspace header is present", () => {
  assert.equal(extractWorkspaceId({ "x-request-id": "req_1" }), null);
});

test("extractUserId returns the value of x-user-id when present", () => {
  assert.equal(extractUserId({ "x-user-id": "usr_001" }), "usr_001");
});

test("buildRequestContext combines all three extractors with request metadata", () => {
  const ctx = buildRequestContext(
    {
      "x-request-id": "req_combined",
      "X-Workspace-Id": "ws_combined",
      "x-user-id": "usr_combined",
    },
    { method: "GET", url: "/api/items" },
  );
  assert.equal(ctx.requestId, "req_combined");
  assert.equal(ctx.workspaceId, "ws_combined");
  assert.equal(ctx.userId, "usr_combined");
  assert.equal(ctx.method, "GET");
  assert.equal(ctx.url, "/api/items");
});

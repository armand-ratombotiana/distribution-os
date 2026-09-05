import { test } from "node:test";
import assert from "node:assert/strict";

import {
  composeMiddleware,
  applyMiddleware,
  type MiddlewareContext,
} from "../lib/middleware-pure.ts";

test("composeMiddleware returns a function", () => {
  const composed = composeMiddleware([]);
  assert.equal(typeof composed, "function");
});

test("applyMiddleware runs middlewares in registration order", async () => {
  const calls: string[] = [];
  const ctx: MiddlewareContext = {
    request: {},
    state: {},
  };
  await applyMiddleware(
    [
      async (_c, next) => {
        calls.push("a:before");
        await next();
        calls.push("a:after");
      },
      async (_c, next) => {
        calls.push("b:before");
        await next();
        calls.push("b:after");
      },
    ],
    ctx,
  );
  assert.deepEqual(calls, [
    "a:before",
    "b:before",
    "b:after",
    "a:after",
  ]);
});

test("applyMiddleware returns the (mutated) context", async () => {
  const ctx: MiddlewareContext<{ touched?: boolean }> = {
    request: {},
    state: {},
  };
  const out = await applyMiddleware<Record<string, unknown>>(
    [
      async (c, next) => {
        c.state.touched = true;
        await next();
      },
    ],
    ctx,
  );
  assert.equal(out, ctx);
  assert.equal(out.state.touched, true);
});

test("composeMiddleware calls the supplied next after the chain", async () => {
  const calls: string[] = [];
  const composed = composeMiddleware([
    async (_c, next) => {
      calls.push("mw:before");
      await next();
      calls.push("mw:after");
    },
  ]);
  await composed(
    { request: {}, state: {} },
    async () => {
      calls.push("terminal");
    },
  );
  assert.deepEqual(calls, ["mw:before", "terminal", "mw:after"]);
});

test("composeMiddleware short-circuits when next is not called", async () => {
  const calls: string[] = [];
  const composed = composeMiddleware<Record<string, unknown>>([
    async () => {
      calls.push("first");
      // deliberately do not call next()
    },
    async () => {
      calls.push("second");
    },
  ]);
  await composed({ request: {}, state: {} }, async () => {
    calls.push("terminal");
  });
  assert.deepEqual(calls, ["first"]);
});

test("composeMiddleware throws when a middleware calls next() multiple times", async () => {
  const composed = composeMiddleware<Record<string, unknown>>([
    async (_c, next) => {
      await next();
      await next();
    },
  ]);
  await assert.rejects(
    async () => { await composed({ request: {}, state: {} }, async () => {}); },
    /next\(\) called multiple times/,
  );
});

test("composeMiddleware passes the same context to every middleware", async () => {
  const seen: unknown[] = [];
  const ctx: MiddlewareContext = { request: {}, state: {} };
  const composed = composeMiddleware<Record<string, unknown>>([
    async (c, next) => {
      seen.push(c);
      await next();
    },
    async (c, next) => {
      seen.push(c);
      await next();
    },
  ]);
  await composed(ctx, async () => {});
  assert.equal(seen.length, 2);
  assert.equal(seen[0], ctx);
  assert.equal(seen[1], ctx);
});

test("applyMiddleware works with an empty chain", async () => {
  const ctx: MiddlewareContext = { request: {}, state: {} };
  const out = await applyMiddleware([], ctx);
  assert.equal(out, ctx);
  assert.deepEqual(out.state, {});
});

test("composeMiddleware supports synchronous middlewares", async () => {
  const calls: string[] = [];
  const composed = composeMiddleware<Record<string, unknown>>([
    (_c, next) => {
      calls.push("sync:before");
      void next();
      calls.push("sync:after");
    },
  ]);
  await composed({ request: {}, state: {} }, async () => {
    calls.push("terminal");
  });
  assert.deepEqual(calls, ["sync:before", "terminal", "sync:after"]);
});

test("composeMiddleware allows a middleware to set the response before next", async () => {
  const ctx: MiddlewareContext = { request: {}, state: {} };
  const composed = composeMiddleware<Record<string, unknown>>([
    (c, next) => {
      c.response = { status: 201, body: { ok: true } };
      void next();
    },
  ]);
  await composed(ctx, async () => {});
  assert.deepEqual(ctx.response, { status: 201, body: { ok: true } });
});

test("composeMiddleware allows downstream middlewares to override the response", async () => {
  const ctx: MiddlewareContext = { request: {}, state: {} };
  const composed = composeMiddleware<Record<string, unknown>>([
    async (c, next) => {
      c.response = { status: 200, body: "first" };
      await next();
    },
    async (c, next) => {
      c.response = { status: 204, body: null };
      await next();
    },
  ]);
  await composed(ctx, async () => {});
  assert.equal(ctx.response?.status, 204);
  assert.equal(ctx.response?.body, null);
});

test("composeMiddleware awaits async work performed before next()", async () => {
  const calls: string[] = [];
  const composed = composeMiddleware<Record<string, unknown>>([
    async (_c, next) => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      calls.push("before");
      await next();
    },
  ]);
  await composed({ request: {}, state: {} }, async () => {
    calls.push("terminal");
  });
  assert.deepEqual(calls, ["before", "terminal"]);
});

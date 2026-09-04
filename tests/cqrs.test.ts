import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createRegistry,
  dispatch,
  listCommandTypes,
  listQueryTypes,
  query,
  registerCommand,
  registerQuery,
  type Command,
  type Query,
} from "../lib/cqrs-pure.ts";

type IncrementPayload = { id: string; by: number };
type GetValueParams = { id: string };

// In-memory state used by the handlers. The dispatcher is pure; the
// handlers own their state and would normally wrap a database call.
const counts: Record<string, number> = {};

test("registerCommand adds a handler and listCommandTypes reports it", () => {
  const registry = registerCommand(
    createRegistry(),
    "increment",
    (cmd: Command<"increment">) => {
      const p = cmd.payload as IncrementPayload;
      counts[p.id] = (counts[p.id] ?? 0) + p.by;
      return { ok: true, affectedId: p.id };
    },
  );
  assert.deepEqual(listCommandTypes(registry), ["increment"]);
});

test("dispatch routes a command to its handler and returns the result", async () => {
  const registry = registerCommand(
    createRegistry(),
    "increment",
    (cmd: Command<"increment">) => {
      const p = cmd.payload as IncrementPayload;
      counts[p.id] = (counts[p.id] ?? 0) + p.by;
      return { ok: true, affectedId: p.id, events: [{ type: "incremented", payload: p }] };
    },
  );
  const result = await dispatch(registry, {
    type: "increment",
    payload: { id: "a", by: 5 },
    correlationId: "c-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.affectedId, "a");
  assert.deepEqual(result.events, [{ type: "incremented", payload: { id: "a", by: 5 } }]);
  assert.equal(counts["a"], 5);
});

test("dispatch returns an error result when no handler is registered", async () => {
  const registry = createRegistry();
  const result = await dispatch(registry, { type: "unknown", payload: null });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /No handler registered for command "unknown"/);
});

test("dispatch catches thrown errors and returns them as CommandResult.error", async () => {
  const registry = registerCommand(createRegistry(), "boom", () => {
    throw new Error("kaboom");
  });
  const result = await dispatch(registry, { type: "boom", payload: null });
  assert.equal(result.ok, false);
  assert.equal(result.error, "kaboom");
});

test("registerQuery adds a handler and listQueryTypes reports it", () => {
  const registry = registerQuery(
    createRegistry(),
    "getValue",
    (q: Query<"getValue">) => {
      const p = q.params as GetValueParams;
      return { ok: true, data: counts[p.id] ?? 0 };
    },
  );
  assert.deepEqual(listQueryTypes(registry), ["getValue"]);
});

test("query routes a query to its handler and returns the data", async () => {
  const registry = registerQuery(
    createRegistry(),
    "getValue",
    (q: Query<"getValue">) => {
      const p = q.params as GetValueParams;
      return { ok: true, data: counts[p.id] ?? 0 };
    },
  );
  // Pre-populate state.
  counts["b"] = 42;
  const result = await query(registry, { type: "getValue", params: { id: "b" } });
  assert.equal(result.ok, true);
  assert.equal(result.data, 42);
});

test("query returns an error result when no handler is registered", async () => {
  const registry = createRegistry();
  const result = await query(registry, { type: "missing", params: null });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /No handler registered for query "missing"/);
});

test("registerCommand and registerQuery do not mutate the input registry", () => {
  const empty = createRegistry();
  registerCommand(empty, "noop", () => ({ ok: true }));
  registerQuery(empty, "noop-q", () => ({ ok: true, data: null }));
  assert.equal(empty.commands.size, 0);
  assert.equal(empty.queries.size, 0);
});

test("registerCommand overwrites a previously-registered handler for the same type", async () => {
  let r = createRegistry();
  r = registerCommand(r, "increment", () => ({ ok: true, affectedId: "v1" }));
  r = registerCommand(r, "increment", () => ({ ok: true, affectedId: "v2" }));
  const result = await dispatch(r, { type: "increment", payload: null });
  assert.equal(result.affectedId, "v2");
});

test("dispatch supports async handlers that return promises", async () => {
  const registry = registerCommand(createRegistry(), "async", async () => {
    // Yield to the microtask queue to prove async is supported.
    await Promise.resolve();
    return { ok: true, affectedId: "async-ok" };
  });
  const result = await dispatch(registry, { type: "async", payload: null });
  assert.equal(result.ok, true);
  assert.equal(result.affectedId, "async-ok");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appendEvent,
  applyEvent,
  createEventStore,
  getSnapshot,
  getStreamEvents,
  rebuildAggregate,
  replayEvents,
  type Event,
  type Snapshot,
} from "../lib/event-sourcing-pure.ts";

// Test aggregate: a counter that increments on "incremented" and doubles on
// "doubled". Pure reducer, no I/O.
type CounterState = { value: number };

function counterReducer(
  state: CounterState,
  event: Event<"incremented" | "doubled" | "reset">,
): CounterState {
  if (event.type === "incremented") {
    return { value: state.value + (event.payload as number) };
  }
  if (event.type === "doubled") {
    return { value: state.value * 2 };
  }
  if (event.type === "reset") {
    return { value: 0 };
  }
  return state;
}

const NOW = 1_700_000_000_000;

test("appendEvent assigns a monotonic eventSeq starting at 1", () => {
  const store = createEventStore();
  const r1 = appendEvent(store, {
    streamId: "c1",
    type: "incremented",
    payload: 1,
    timestampMs: NOW,
  });
  const r2 = appendEvent(r1.store, {
    streamId: "c1",
    type: "incremented",
    payload: 2,
    timestampMs: NOW + 1,
  });
  assert.equal(r1.event.eventSeq, 1);
  assert.equal(r2.event.eventSeq, 2);
  assert.equal(r2.store.events.length, 2);
});

test("appendEvent does not mutate the input store", () => {
  const store = createEventStore();
  const { store: next } = appendEvent(store, {
    streamId: "c1",
    type: "incremented",
    payload: 1,
    timestampMs: NOW,
  });
  assert.equal(store.events.length, 0);
  assert.equal(next.events.length, 1);
});

test("appendEvent honours an explicit eventSeq when provided", () => {
  const store = createEventStore();
  const { event } = appendEvent(store, {
    streamId: "c1",
    type: "incremented",
    payload: 1,
    timestampMs: NOW,
    eventSeq: 42,
  });
  assert.equal(event.eventSeq, 42);
});

test("applyEvent runs the reducer and returns the new state", () => {
  const event: Event<"incremented"> = {
    eventSeq: 1,
    streamId: "c1",
    type: "incremented",
    payload: 5,
    timestampMs: NOW,
  };
  const next = applyEvent({ value: 3 }, event, counterReducer);
  assert.deepEqual(next, { value: 8 });
});

test("replayEvents folds events from the initial state", () => {
  const events: Event<"incremented" | "doubled">[] = [
    { eventSeq: 1, streamId: "c1", type: "incremented", payload: 1, timestampMs: NOW },
    { eventSeq: 2, streamId: "c1", type: "incremented", payload: 2, timestampMs: NOW + 1 },
    { eventSeq: 3, streamId: "c1", type: "doubled", payload: null, timestampMs: NOW + 2 },
  ];
  const state = replayEvents({ value: 0 }, events, counterReducer);
  // 0 + 1 + 2 = 3, then *2 = 6
  assert.deepEqual(state, { value: 6 });
});

test("replayEvents accepts a fromSeq to resume replay", () => {
  const events: Event<"incremented">[] = [
    { eventSeq: 1, streamId: "c1", type: "incremented", payload: 1, timestampMs: NOW },
    { eventSeq: 2, streamId: "c1", type: "incremented", payload: 2, timestampMs: NOW + 1 },
    { eventSeq: 3, streamId: "c1", type: "incremented", payload: 3, timestampMs: NOW + 2 },
  ];
  // Skip the first two events.
  const state = replayEvents({ value: 0 }, events, counterReducer, 3);
  assert.deepEqual(state, { value: 3 });
});

test("replayEvents returns the initial state when events is empty", () => {
  const state = replayEvents({ value: 7 }, [], counterReducer);
  assert.deepEqual(state, { value: 7 });
});

test("getSnapshot records the last event sequence and state", () => {
  const events: Event<"incremented">[] = [
    { eventSeq: 1, streamId: "c1", type: "incremented", payload: 1, timestampMs: NOW },
    { eventSeq: 2, streamId: "c1", type: "incremented", payload: 2, timestampMs: NOW + 1 },
  ];
  const snap = getSnapshot("c1", { value: 3 }, events, NOW + 2);
  assert.equal(snap.streamId, "c1");
  assert.equal(snap.lastEventSeq, 2);
  assert.deepEqual(snap.state, { value: 3 });
  assert.equal(snap.takenAtMs, NOW + 2);
});

test("getSnapshot falls back to fallbackSeq when events is empty", () => {
  const snap = getSnapshot("c1", { value: 0 }, [], NOW, 17);
  assert.equal(snap.lastEventSeq, 17);
});

test("getStreamEvents filters the store by stream id", () => {
  let store = createEventStore();
  store = appendEvent(store, { streamId: "a", type: "incremented", payload: 1, timestampMs: NOW }).store;
  store = appendEvent(store, { streamId: "b", type: "incremented", payload: 1, timestampMs: NOW }).store;
  store = appendEvent(store, { streamId: "a", type: "incremented", payload: 1, timestampMs: NOW }).store;
  const aEvents = getStreamEvents(store, "a");
  const bEvents = getStreamEvents(store, "b");
  assert.equal(aEvents.length, 2);
  assert.equal(bEvents.length, 1);
  assert.equal(aEvents[0].eventSeq, 1);
  assert.equal(aEvents[1].eventSeq, 3);
});

test("rebuildAggregate replays only the matching stream", () => {
  let store = createEventStore();
  store = appendEvent(store, { streamId: "a", type: "incremented", payload: 1, timestampMs: NOW }).store;
  store = appendEvent(store, { streamId: "b", type: "incremented", payload: 100, timestampMs: NOW }).store;
  store = appendEvent(store, { streamId: "a", type: "doubled", payload: null, timestampMs: NOW }).store;
  const { state, lastEventSeq } = rebuildAggregate(
    store,
    "a",
    { value: 0 },
    counterReducer,
  );
  // 0 + 1 = 1, then *2 = 2. Stream "b" event ignored.
  assert.deepEqual(state, { value: 2 });
  assert.equal(lastEventSeq, 3);
});

test("rebuildAggregate resumes from a snapshot and applies only subsequent events", () => {
  let store = createEventStore();
  store = appendEvent(store, { streamId: "a", type: "incremented", payload: 1, timestampMs: NOW }).store;
  store = appendEvent(store, { streamId: "a", type: "incremented", payload: 2, timestampMs: NOW }).store;
  store = appendEvent(store, { streamId: "a", type: "incremented", payload: 3, timestampMs: NOW }).store;
  const snapshot: Snapshot<CounterState> = {
    streamId: "a",
    lastEventSeq: 1,
    state: { value: 1 },
    takenAtMs: NOW,
  };
  // Resume after seq 1 → apply events 2 and 3 only.
  const { state, lastEventSeq } = rebuildAggregate(
    store,
    "a",
    { value: 0 },
    counterReducer,
    snapshot,
  );
  // 1 (snapshot) + 2 + 3 = 6
  assert.deepEqual(state, { value: 6 });
  assert.equal(lastEventSeq, 3);
});

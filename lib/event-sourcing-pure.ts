/**
 * Pure event-sourcing primitives.
 *
 * The event store is an append-only log of typed events. Aggregates are
 * rebuilt by folding `applyEvent` over the event list starting from an
 * initial state. Snapshots are explicit (eventSeq + state) so callers can
 * persist them out-of-band and resume replay from `eventSeq + 1`.
 *
 * No I/O. Everything is a pure function of its inputs.
 */

export type EventType = string;

export interface Event<E extends EventType = EventType> {
  /** Monotonically increasing sequence number within a stream. */
  eventSeq: number;
  /** Stream id (aggregate id). */
  streamId: string;
  type: E;
  payload: unknown;
  /** Epoch milliseconds when the event was appended. */
  timestampMs: number;
}

export interface EventStore {
  events: Event[];
}

/**
 * Create an empty event store.
 */
export function createEventStore(): EventStore {
  return { events: [] };
}

/**
 * Append an event to the store. The caller supplies the eventSeq, streamId,
 * type, payload, and timestampMs — making the function pure and deterministic.
 *
 * Returns a new store; the input store is not mutated.
 */
export function appendEvent<E extends EventType>(
  store: EventStore,
  event: Omit<Event<E>, "eventSeq"> & { eventSeq?: number },
): { store: EventStore; event: Event<E> } {
  const nextSeq =
    event.eventSeq ??
    (store.events.length > 0
      ? store.events[store.events.length - 1].eventSeq + 1
      : 1);
  const fullEvent: Event<E> = {
    eventSeq: nextSeq,
    streamId: event.streamId,
    type: event.type,
    payload: event.payload,
    timestampMs: event.timestampMs,
  };
  return {
    store: { events: [...store.events, fullEvent] },
    event: fullEvent,
  };
}

/**
 * Apply a single event to an aggregate state using the supplied reducer.
 * The reducer must be pure: (state, event) -> newState.
 */
export function applyEvent<S, E extends EventType = EventType>(
  state: S,
  event: Event<E>,
  reducer: (state: S, event: Event<E>) => S,
): S {
  return reducer(state, event);
}

/**
 * Replay a list of events through a reducer starting from `initialState`.
 *
 *   - When `fromSeq` is provided, events with `eventSeq < fromSeq` are
 *     skipped. This is used to resume replay from a snapshot.
 *   - Events are applied in array order. Callers should pre-sort by
 *     `eventSeq` if order is not guaranteed.
 */
export function replayEvents<S, E extends EventType = EventType>(
  initialState: S,
  events: ReadonlyArray<Event<E>>,
  reducer: (state: S, event: Event<E>) => S,
  fromSeq: number = 0,
): S {
  let state = initialState;
  for (const event of events) {
    if (event.eventSeq < fromSeq) continue;
    state = reducer(state, event);
  }
  return state;
}

/**
 * A snapshot captures a point-in-time aggregate state plus the last
 * event sequence that contributed to it. Replaying events after
 * `lastEventSeq` rebuilds the current state from the snapshot.
 */
export interface Snapshot<S> {
  streamId: string;
  lastEventSeq: number;
  state: S;
  /** Epoch milliseconds when the snapshot was taken. */
  takenAtMs: number;
}

/**
 * Build a snapshot from the current state and the highest applied event
 * sequence. If `events` is non-empty, `lastEventSeq` defaults to the last
 * event's sequence; otherwise it falls back to `fallbackSeq` (default 0).
 */
export function getSnapshot<S, E extends EventType = EventType>(
  streamId: string,
  state: S,
  events: ReadonlyArray<Event<E>>,
  takenAtMs: number,
  fallbackSeq: number = 0,
): Snapshot<S> {
  const lastEventSeq =
    events.length > 0 ? events[events.length - 1].eventSeq : fallbackSeq;
  return {
    streamId,
    lastEventSeq,
    state,
    takenAtMs,
  };
}

/**
 * Filter the events in a store to those belonging to a single stream.
 */
export function getStreamEvents<E extends EventType = EventType>(
  store: EventStore,
  streamId: string,
): Event<E>[] {
  return store.events.filter((e) => e.streamId === streamId) as Event<E>[];
}

/**
 * Rebuild an aggregate by replaying only the events for a given stream,
 * optionally resuming after a snapshot.
 */
export function rebuildAggregate<S, E extends EventType = EventType>(
  store: EventStore,
  streamId: string,
  initialState: S,
  reducer: (state: S, event: Event<E>) => S,
  snapshot?: Snapshot<S>,
): { state: S; lastEventSeq: number } {
  const fromSeq = snapshot ? snapshot.lastEventSeq + 1 : 0;
  const startState = snapshot ? snapshot.state : initialState;
  const events = getStreamEvents<E>(store, streamId);
  const state = replayEvents(startState, events, reducer, fromSeq);
  const lastEventSeq =
    events.length > 0 ? events[events.length - 1].eventSeq : fromSeq - 1;
  return { state, lastEventSeq };
}

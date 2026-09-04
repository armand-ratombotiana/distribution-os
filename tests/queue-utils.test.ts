import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PriorityQueue,
  FifoQueue,
  LifoQueue,
  enqueue,
  dequeue,
  type QueueLike,
} from "../lib/queue-utils-pure.ts";

test("FifoQueue dequeues items in insertion order", () => {
  const q = new FifoQueue<number>();
  q.enqueue(1);
  q.enqueue(2);
  q.enqueue(3);
  assert.equal(q.size(), 3);
  assert.equal(q.dequeue(), 1);
  assert.equal(q.dequeue(), 2);
  assert.equal(q.dequeue(), 3);
  assert.equal(q.isEmpty(), true);
});

test("FifoQueue peek does not remove the head", () => {
  const q = new FifoQueue<string>();
  q.enqueue("a");
  q.enqueue("b");
  assert.equal(q.peek(), "a");
  assert.equal(q.size(), 2);
});

test("FifoQueue clear empties the queue", () => {
  const q = new FifoQueue<number>();
  q.enqueue(1);
  q.enqueue(2);
  q.clear();
  assert.equal(q.size(), 0);
  assert.equal(q.dequeue(), undefined);
});

test("LifoQueue dequeues the most recently inserted item first", () => {
  const q = new LifoQueue<number>();
  q.enqueue(1);
  q.enqueue(2);
  q.enqueue(3);
  assert.equal(q.dequeue(), 3);
  assert.equal(q.dequeue(), 2);
  assert.equal(q.dequeue(), 1);
  assert.equal(q.isEmpty(), true);
});

test("LifoQueue toArray returns items in LIFO order", () => {
  const q = new LifoQueue<string>();
  q.enqueue("a");
  q.enqueue("b");
  q.enqueue("c");
  assert.deepEqual(q.toArray(), ["c", "b", "a"]);
});

test("PriorityQueue with default comparator returns largest items first", () => {
  const pq = new PriorityQueue<number>();
  for (const n of [5, 1, 9, 3, 7]) pq.enqueue(n);
  assert.deepEqual(
    [pq.dequeue(), pq.dequeue(), pq.dequeue(), pq.dequeue(), pq.dequeue()],
    [9, 7, 5, 3, 1],
  );
});

test("PriorityQueue supports a custom comparator (min-heap)", () => {
  const pq = new PriorityQueue<number>((a, b) => b - a);
  for (const n of [5, 1, 9, 3, 7]) pq.enqueue(n);
  assert.deepEqual(
    [pq.dequeue(), pq.dequeue(), pq.dequeue(), pq.dequeue(), pq.dequeue()],
    [1, 3, 5, 7, 9],
  );
});

test("PriorityQueue handles objects with a comparator", () => {
  type Task = { priority: number; name: string };
  const pq = new PriorityQueue<Task>((a, b) => a.priority - b.priority);
  pq.enqueue({ priority: 1, name: "low" });
  pq.enqueue({ priority: 10, name: "high" });
  pq.enqueue({ priority: 5, name: "mid" });
  assert.equal(pq.dequeue()?.name, "high");
  assert.equal(pq.dequeue()?.name, "mid");
  assert.equal(pq.dequeue()?.name, "low");
});

test("PriorityQueue peek returns the top without removing it", () => {
  const pq = new PriorityQueue<number>();
  pq.enqueue(1);
  pq.enqueue(5);
  assert.equal(pq.peek(), 5);
  assert.equal(pq.size(), 2);
});

test("PriorityQueue clear empties the queue", () => {
  const pq = new PriorityQueue<number>();
  pq.enqueue(1);
  pq.enqueue(2);
  pq.clear();
  assert.equal(pq.isEmpty(), true);
  assert.equal(pq.dequeue(), undefined);
});

test("enqueue / dequeue helpers work on any queue-like object", () => {
  const q: QueueLike<number> = new FifoQueue();
  enqueue(q, 10);
  enqueue(q, 20);
  assert.equal(dequeue(q), 10);
  assert.equal(dequeue(q), 20);
  assert.equal(dequeue(q), undefined);
});

test("dequeue on an empty queue returns undefined (no throw)", () => {
  assert.equal(dequeue(new FifoQueue<number>()), undefined);
  assert.equal(dequeue(new LifoQueue<number>()), undefined);
  assert.equal(dequeue(new PriorityQueue<number>()), undefined);
});

test("All queues start empty and report size 0", () => {
  assert.equal(new FifoQueue().isEmpty(), true);
  assert.equal(new LifoQueue().isEmpty(), true);
  assert.equal(new PriorityQueue().isEmpty(), true);
  assert.equal(new FifoQueue().size(), 0);
});

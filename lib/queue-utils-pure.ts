/**
 * Pure queue data structures — PriorityQueue (binary max-heap with a custom
 * comparator), FifoQueue (array-backed), and LifoQueue (stack-backed).
 *
 * Also exports generic `enqueue` / `dequeue` helpers that operate on any
 * queue that exposes `enqueue` / `dequeue` methods.
 */

export interface QueueLike<T> {
  enqueue(item: T): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  size(): number;
  isEmpty(): boolean;
  clear(): void;
  toArray(): T[];
}

function defaultCompare<T>(a: T, b: T): number {
  if (a === b) return 0;
  if (a < b) return -1;
  return 1;
}

/**
 * Binary-heap-backed priority queue. Items with higher priority come out
 * first. The comparator returns a positive number when `a` should be
 * dequeued before `b`. Defaults to natural ordering (larger first → max-heap).
 */
export class PriorityQueue<T> implements QueueLike<T> {
  private readonly heap: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number = defaultCompare) {
    this.compare = compare;
  }

  enqueue(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  clear(): void {
    this.heap.length = 0;
  }

  toArray(): T[] {
    // Return a copy in an unspecified order; callers needing order should
    // repeatedly call dequeue().
    return this.heap.slice();
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) <= 0) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  private siftDown(index: number): void {
    const n = this.heap.length;
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let best = i;
      if (left < n && this.compare(this.heap[left], this.heap[best]) > 0) {
        best = left;
      }
      if (right < n && this.compare(this.heap[right], this.heap[best]) > 0) {
        best = right;
      }
      if (best === i) break;
      [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];
      i = best;
    }
  }
}

/** First-in, first-out queue backed by a plain array. */
export class FifoQueue<T> implements QueueLike<T> {
  private readonly items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items.length = 0;
  }

  toArray(): T[] {
    return this.items.slice();
  }
}

/** Last-in, first-out queue (a stack). */
export class LifoQueue<T> implements QueueLike<T> {
  private readonly items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items.length = 0;
  }

  toArray(): T[] {
    // LIFO order: most recently enqueued first.
    return this.items.slice().reverse();
  }
}

/** Adds an item to any queue that exposes `enqueue`. */
export function enqueue<T>(queue: Pick<QueueLike<T>, "enqueue">, item: T): void {
  queue.enqueue(item);
}

/** Removes and returns the next item from any queue that exposes `dequeue`. */
export function dequeue<T>(queue: Pick<QueueLike<T>, "dequeue">): T | undefined {
  return queue.dequeue();
}

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateBatchSize,
  chunkBatch,
  countBatches,
  DEFAULT_BATCH_CONFIG,
  processBatch,
  shouldBatch,
} from "../lib/batch-utils-pure.ts";

test("chunkBatch splits items into evenly-sized chunks", () => {
  const out = chunkBatch([1, 2, 3, 4, 5, 6], 2);
  assert.deepEqual(out, [[1, 2], [3, 4], [5, 6]]);
});

test("chunkBatch leaves the last chunk smaller when items don't divide evenly", () => {
  const out = chunkBatch([1, 2, 3, 4, 5], 2);
  assert.deepEqual(out, [[1, 2], [3, 4], [5]]);
  assert.equal(out[out.length - 1]!.length, 1);
});

test("chunkBatch returns an empty array for empty input and clamps batchSize to a minimum of 1", () => {
  assert.deepEqual(chunkBatch([], 5), []);
  // batchSize=0 or negative → clamped to 1 (one item per chunk).
  assert.deepEqual(chunkBatch([1, 2, 3], 0), [[1], [2], [3]]);
  assert.deepEqual(chunkBatch([1, 2, 3], -5), [[1], [2], [3]]);
});

test("processBatch applies fn to each chunk and returns results in input order", () => {
  const out = processBatch([1, 2, 3, 4, 5], 2, (chunk) => chunk.reduce((a, b) => a + b, 0));
  assert.deepEqual(out, [3, 7, 5]);
});

test("processBatch returns an empty array for empty input", () => {
  const out = processBatch([], 5, (chunk) => chunk.length);
  assert.deepEqual(out, []);
});

test("calculateBatchSize targets the desired number of batches", () => {
  // 100 items / 8 target batches = 12.5 → 12 per batch.
  assert.equal(calculateBatchSize(100, 50, 8), 12);
  // 100 items / 4 target batches = 25 per batch.
  assert.equal(calculateBatchSize(100, 100, 4), 25);
});

test("calculateBatchSize clamps to maxBatchSize and never goes below 1", () => {
  // 100 items, target 4 batches → 25, but maxBatchSize=10 → clamped to 10.
  assert.equal(calculateBatchSize(100, 10, 4), 10);
  // 4 items / 4 target batches = 1 per batch.
  assert.equal(calculateBatchSize(4, 100, 4), 1);
  // Non-positive / non-finite inputs yield 1 (safe single-item batch).
  assert.equal(calculateBatchSize(0, 10, 4), 1);
  assert.equal(calculateBatchSize(NaN, 10, 4), 1);
});

test("shouldBatch returns true only when itemCount is strictly greater than threshold", () => {
  assert.equal(shouldBatch(5, 4), true);
  assert.equal(shouldBatch(4, 4), false);
  assert.equal(shouldBatch(0, 4), false);
  assert.equal(shouldBatch(NaN, 4), false);
});

test("countBatches reports the expected number of batches", () => {
  assert.equal(countBatches(10, 3), 4); // 3 + 3 + 3 + 1
  assert.equal(countBatches(9, 3), 3); // 3 + 3 + 3
  assert.equal(countBatches(0, 3), 0);
  // batchSize=0 is clamped to 1 → 5 batches.
  assert.equal(countBatches(5, 0), 5);
});

test("DEFAULT_BATCH_CONFIG exposes sensible batch defaults", () => {
  assert.equal(DEFAULT_BATCH_CONFIG.maxBatchSize, 100);
  assert.equal(DEFAULT_BATCH_CONFIG.minBatchThreshold, 4);
  assert.equal(DEFAULT_BATCH_CONFIG.targetBatches, 8);
  assert.ok(DEFAULT_BATCH_CONFIG.maxBatchSize > DEFAULT_BATCH_CONFIG.minBatchThreshold);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_COMPRESSION_CONFIG,
  estimateCompressionRatio,
  getOptimalChunkSize,
  shouldCompress,
} from "../lib/compression-pure.ts";

test("estimateCompressionRatio returns 1 for short inputs (below 32 bytes)", () => {
  assert.equal(estimateCompressionRatio(""), 1);
  assert.equal(estimateCompressionRatio("a"), 1);
  assert.equal(estimateCompressionRatio("a".repeat(31)), 1);
});

test("estimateCompressionRatio returns a low ratio for highly repetitive text", () => {
  const repetitive = "a".repeat(1000);
  const ratio = estimateCompressionRatio(repetitive);
  assert.ok(ratio <= 0.5, `expected ratio <= 0.5, got ${ratio}`);
  assert.ok(ratio >= 0.05);
});

test("estimateCompressionRatio returns a high ratio for high-entropy text", () => {
  // 94 distinct printable chars uniformly distributed → high entropy.
  const diverse = Array.from(
    { length: 1000 },
    (_, i) => String.fromCharCode(33 + (i % 94)),
  ).join("");
  const ratio = estimateCompressionRatio(diverse);
  assert.ok(ratio > 0.5, `expected ratio > 0.5, got ${ratio}`);
});

test("shouldCompress returns false when the payload is too small", () => {
  assert.equal(
    shouldCompress("text/plain", 100, 0.5, DEFAULT_COMPRESSION_CONFIG),
    false,
  );
  assert.equal(
    shouldCompress("text/plain", 1023, 0.5, DEFAULT_COMPRESSION_CONFIG),
    false,
  );
});

test("shouldCompress returns false for non-compressible content types", () => {
  assert.equal(
    shouldCompress("image/png", 10_000, 0.5, DEFAULT_COMPRESSION_CONFIG),
    false,
  );
  assert.equal(
    shouldCompress("application/octet-stream", 10_000, 0.5, DEFAULT_COMPRESSION_CONFIG),
    false,
  );
  assert.equal(
    shouldCompress("video/mp4", 10_000, 0.5, DEFAULT_COMPRESSION_CONFIG),
    false,
  );
});

test("shouldCompress returns false when the ratio is above the threshold", () => {
  // Large enough, compressible content type, but ratio above 0.9 → skip.
  assert.equal(
    shouldCompress("text/plain", 10_000, 0.95, DEFAULT_COMPRESSION_CONFIG),
    false,
  );
  // Exactly at the threshold → still compresses.
  assert.equal(
    shouldCompress("text/plain", 10_000, 0.9, DEFAULT_COMPRESSION_CONFIG),
    true,
  );
});

test("shouldCompress returns true for a large compressible payload under the ratio cap", () => {
  assert.equal(
    shouldCompress("text/plain", 10_000, 0.3, DEFAULT_COMPRESSION_CONFIG),
    true,
  );
  assert.equal(
    shouldCompress("application/json", 5_000, 0.5, DEFAULT_COMPRESSION_CONFIG),
    true,
  );
  assert.equal(
    shouldCompress("text/html", 5_000, 0.5, DEFAULT_COMPRESSION_CONFIG),
    true,
  );
});

test("getOptimalChunkSize returns 0 for non-positive or non-finite inputs", () => {
  assert.equal(getOptimalChunkSize(0, 1024, 4), 0);
  assert.equal(getOptimalChunkSize(-1, 1024, 4), 0);
  assert.equal(getOptimalChunkSize(NaN, 1024, 4), 0);
  assert.equal(getOptimalChunkSize(1024, 0, 4), 0);
});

test("getOptimalChunkSize returns the largest power-of-two chunk under the cap", () => {
  // totalSize=10_000, target 4 chunks → target chunk = 2500. Largest power
  // of two ≤ 2500 is 2048.
  assert.equal(getOptimalChunkSize(10_000, 1_000_000, 4), 2048);
  // totalSize=16_000, target 4 → target = 4000 → largest pow2 = 4096 > 4000
  // → fall back to 2048.
  assert.equal(getOptimalChunkSize(16_000, 1_000_000, 4), 2048);
  // totalSize=1024, target 1 → target = 1024 → 1024.
  assert.equal(getOptimalChunkSize(1024, 1_000_000, 1), 1024);
});

test("getOptimalChunkSize respects the maxChunkSizeBytes limit", () => {
  // target chunk = 2500 but maxChunkSizeBytes = 1000 → cap = 1000, largest
  // pow2 = 512.
  assert.equal(getOptimalChunkSize(10_000, 1000, 4), 512);
  // maxChunkSizeBytes = 1 → cap = 1 → result = 1.
  assert.equal(getOptimalChunkSize(10_000, 1, 4), 1);
});

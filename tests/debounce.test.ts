import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateDelay,
  DEFAULT_DEBOUNCE_CONFIG,
  getBackoffDelay,
  nextExecuteAt,
  shouldExecute,
} from "../lib/debounce-pure.ts";

const NOW = 1_700_000_000_000;

test("shouldExecute returns true when never executed (lastExecutedMs=0)", () => {
  assert.equal(shouldExecute(0, NOW, 100), true);
  assert.equal(shouldExecute(0, 0, 100), true);
});

test("shouldExecute returns true once delayMs has elapsed since the last execution", () => {
  assert.equal(shouldExecute(NOW, NOW + 100, 100), true);
  assert.equal(shouldExecute(NOW, NOW + 99, 100), false);
  assert.equal(shouldExecute(NOW, NOW + 1000, 100), true);
});

test("shouldExecute returns false within the delay window", () => {
  assert.equal(shouldExecute(NOW, NOW, 100), false);
  assert.equal(shouldExecute(NOW, NOW + 50, 100), false);
});

test("shouldExecute returns false for non-finite or out-of-order timestamps", () => {
  assert.equal(shouldExecute(NOW, NaN, 100), false);
  assert.equal(shouldExecute(NaN, NOW, 100), false);
  assert.equal(shouldExecute(NOW + 100, NOW, 100), false); // clock went backwards
  assert.equal(shouldExecute(NOW, NOW + 50, NaN), false);
});

test("calculateDelay returns config.delayMs when no max-wait pressure is applied", () => {
  const cfg = { delayMs: 50, maxDelayMs: 2000 };
  assert.equal(calculateDelay(NOW, NOW + 100, cfg), 50);
  assert.equal(calculateDelay(NOW, NOW + 1900, cfg), 50);
});

test("calculateDelay shortens the delay as max-wait approaches", () => {
  const cfg = { delayMs: 50, maxDelayMs: 2000 };
  const firstPending = NOW + 100;
  // 2050 - 100 = 1950 elapsed; remaining = 50 → delay = min(50, 50) = 50.
  assert.equal(calculateDelay(firstPending, NOW + 2050, cfg), 50);
  // 2075 - 100 = 1975 elapsed; remaining = 25 → delay = min(50, 25) = 25.
  assert.equal(calculateDelay(firstPending, NOW + 2075, cfg), 25);
});

test("calculateDelay returns 0 once max-wait has fully elapsed", () => {
  const cfg = { delayMs: 50, maxDelayMs: 2000 };
  assert.equal(calculateDelay(NOW, NOW + 2100, cfg), 0);
  assert.equal(calculateDelay(NOW, NOW + 5000, cfg), 0);
});

test("getBackoffDelay grows exponentially and caps at maxMs", () => {
  assert.equal(getBackoffDelay(1, 1000, 30_000), 1000);
  assert.equal(getBackoffDelay(2, 1000, 30_000), 2000);
  assert.equal(getBackoffDelay(3, 1000, 30_000), 4000);
  assert.equal(getBackoffDelay(4, 1000, 30_000), 8000);
  // 2^6 * 1000 = 64000 → capped at 30000.
  assert.equal(getBackoffDelay(7, 1000, 30_000), 30_000);
});

test("getBackoffDelay clamps non-positive attempts and handles non-finite inputs", () => {
  assert.equal(getBackoffDelay(0, 1000, 30_000), 0);
  assert.equal(getBackoffDelay(-3, 1000, 30_000), 0);
  // Non-finite attempt returns baseMs (the safest default).
  assert.equal(getBackoffDelay(NaN, 1000, 30_000), 1000);
  // Non-finite baseMs propagates as NaN per the implementation contract.
  assert.ok(Number.isNaN(getBackoffDelay(2, NaN, 30_000)));
});

test("nextExecuteAt returns nowMs plus the calculated delay", () => {
  const cfg = DEFAULT_DEBOUNCE_CONFIG;
  // firstPendingMs = NOW, nowMs = NOW + 100 → delay = 250.
  assert.equal(nextExecuteAt(NOW, NOW + 100, cfg), NOW + 100 + 250);
  // firstPendingMs = NOW, nowMs = NOW + 2100 (past maxDelay) → delay = 0.
  assert.equal(nextExecuteAt(NOW, NOW + 2100, cfg), NOW + 2100);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateQueryCost,
  estimateRows,
  optimizeQuery,
  shouldUseIndex,
  type IndexInfo,
  type QueryPlan,
} from "../lib/query-optimizer-pure.ts";

const idxUserId: IndexInfo = { columns: ["user_id"], unique: true };
const idxOrgCreated: IndexInfo = { columns: ["org_id", "created_at"], unique: false };

test("shouldUseIndex returns true for equality on the leading index column", () => {
  assert.equal(shouldUseIndex({ column: "user_id", op: "=" }, [idxUserId]), true);
  assert.equal(shouldUseIndex({ column: "org_id", op: "=" }, [idxOrgCreated]), true);
  assert.equal(shouldUseIndex({ column: "org_id", op: "<" }, [idxOrgCreated]), true);
});

test("shouldUseIndex returns false when the filter column is not the leading column", () => {
  // created_at is the second column of idxOrgCreated → not usable as a seek.
  assert.equal(shouldUseIndex({ column: "created_at", op: "=" }, [idxOrgCreated]), false);
  assert.equal(shouldUseIndex({ column: "email", op: "=" }, [idxUserId]), false);
});

test("shouldUseIndex returns false for LIKE regardless of index", () => {
  assert.equal(
    shouldUseIndex({ column: "user_id", op: "like" }, [idxUserId]),
    false,
  );
});

test("shouldUseIndex returns false when no indexes exist", () => {
  assert.equal(shouldUseIndex({ column: "user_id", op: "=" }, []), false);
});

test("estimateRows multiplies selectivity across filters and clamps to the limit", () => {
  const plan: QueryPlan = {
    table: "t",
    tableRows: 10_000,
    filters: [{ column: "a", op: "=" }, { column: "b", op: "=" }],
  };
  // Two equality filters, each selectivity 0.01 → 10000 * 0.01 * 0.01 = 1.
  assert.equal(estimateRows(plan), 1);
  // When the natural row count is below the limit, the limit has no effect.
  const limited5: QueryPlan = { ...plan, limit: 5 };
  assert.equal(estimateRows(limited5), 1);
  // When the natural row count exceeds the limit, the result is clamped.
  const big: QueryPlan = { table: "t", tableRows: 10_000, filters: [] };
  assert.equal(estimateRows(big), 10_000);
  const bigLimited: QueryPlan = { ...big, limit: 100 };
  assert.equal(estimateRows(bigLimited), 100);
});

test("estimateRows respects an explicit selectivity override", () => {
  const plan: QueryPlan = {
    table: "t",
    tableRows: 1_000,
    filters: [{ column: "a", op: "=", selectivity: 0.5 }],
  };
  assert.equal(estimateRows(plan), 500);
});

test("calculateQueryCost reports O(rows) for a full table scan", () => {
  const plan: QueryPlan = {
    table: "t",
    tableRows: 10_000,
    filters: [{ column: "a", op: "like" }], // LIKE → can't use index
  };
  // No usable index → table_scan cost = tableRows.
  assert.equal(calculateQueryCost(plan, [idxUserId]), 10_000);
});

test("calculateQueryCost is cheaper for an index-friendly query", () => {
  const plan: QueryPlan = {
    table: "t",
    tableRows: 10_000,
    filters: [{ column: "user_id", op: "=" }],
  };
  const cost = calculateQueryCost(plan, [idxUserId]);
  // log2(10000) ≈ 13.3, plus matched rows (10000 * 0.01 = 100) ≈ 113.
  assert.ok(cost < 10_000, "index scan should be cheaper than table scan");
  assert.ok(cost > 100);
});

test("optimizeQuery returns a zero-cost plan for an empty table", () => {
  const plan: QueryPlan = {
    table: "t",
    tableRows: 0,
    filters: [{ column: "user_id", op: "=" }],
  };
  const opt = optimizeQuery(plan, [idxUserId]);
  assert.equal(opt.estimatedRows, 0);
  assert.equal(opt.estimatedCost, 0);
  assert.equal(opt.strategy, "table_scan");
  assert.equal(opt.useIndex, false);
});

test("optimizeQuery picks the index_scan strategy when an index matches", () => {
  const plan: QueryPlan = {
    table: "t",
    tableRows: 10_000,
    filters: [{ column: "user_id", op: "=" }],
  };
  const opt = optimizeQuery(plan, [idxUserId]);
  assert.equal(opt.useIndex, true);
  assert.equal(opt.strategy, "index_scan");
  assert.equal(opt.indexName, "idx_user_id");
  assert.equal(opt.estimatedRows, 100);
  assert.ok(opt.estimatedCost < 10_000);

  // Without a usable index, falls back to table_scan (or limit_scan).
  const noIdx = optimizeQuery(plan, []);
  assert.equal(noIdx.useIndex, false);
  assert.equal(noIdx.strategy, "table_scan");
  // With a limit, becomes a limit_scan.
  const limited = optimizeQuery({ ...plan, limit: 5 }, []);
  assert.equal(limited.strategy, "limit_scan");
});

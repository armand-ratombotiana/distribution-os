/**
 * Pure query optimizer.
 *
 * Estimates the cost of a logical query plan and picks an access path. No
 * D1, no I/O — every function is a pure function of its inputs.
 */

export interface QueryFilter {
  /** Column name being filtered. */
  column: string;
  /** Comparison operator. */
  op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "like";
  /** Estimated selectivity (0..1); defaults derived from op if absent. */
  selectivity?: number;
}

export interface QueryPlan {
  table: string;
  filters: QueryFilter[];
  /** Estimated row count of the table. */
  tableRows: number;
  limit?: number;
  orderBy?: string;
}

export interface IndexInfo {
  columns: string[];
  /** Whether the index is unique. */
  unique: boolean;
}

export interface OptimizedQuery {
  useIndex: boolean;
  indexName: string | null;
  estimatedRows: number;
  estimatedCost: number;
  strategy: "index_scan" | "table_scan" | "limit_scan";
}

/** Default per-operator selectivity estimates. */
const OP_SELECTIVITY: Record<QueryFilter["op"], number> = {
  "=": 0.01,
  "!=": 0.99,
  "<": 0.1,
  "<=": 0.1,
  ">": 0.1,
  ">=": 0.1,
  in: 0.05,
  like: 0.2,
};

/**
 * Decide whether a filter is "index-friendly". Equality and range clauses
 * on the leading column of an index can use it; LIKE never can (we can't
 * tell leading-prefix from trailing-wildcard from here, so we're
 * conservative).
 */
export function shouldUseIndex(
  filter: QueryFilter,
  indexes: ReadonlyArray<IndexInfo>,
): boolean {
  for (const idx of indexes) {
    if (idx.columns.length === 0) continue;
    if (idx.columns[0] !== filter.column) continue;
    if (filter.op === "like") return false;
    return true;
  }
  return false;
}

/**
 * Estimate the number of rows a plan will return after filtering.
 * Selectivities multiply; the result is clamped to `plan.limit` when one
 * is present.
 */
export function estimateRows(plan: QueryPlan): number {
  let selectivity = 1;
  for (const f of plan.filters) {
    const s = f.selectivity ?? OP_SELECTIVITY[f.op] ?? 0.1;
    selectivity *= Math.min(1, Math.max(0, s));
  }
  const rows = Math.max(0, Math.floor(plan.tableRows * selectivity));
  if (typeof plan.limit === "number" && plan.limit > 0) {
    return Math.min(rows, Math.floor(plan.limit));
  }
  return rows;
}

/**
 * Estimate the relative cost of executing a plan. Table scans cost
 * O(rows); index scans cost O(log(rows) + matched). LIMIT pushes the cost
 * down further. Returns 0 for an empty table.
 */
export function calculateQueryCost(
  plan: QueryPlan,
  indexes: ReadonlyArray<IndexInfo>,
): number {
  if (plan.tableRows <= 0) return 0;
  const matched = estimateRows(plan);
  const usesIndex = plan.filters.some((f) => shouldUseIndex(f, indexes));
  if (usesIndex) {
    const seekCost = Math.log2(Math.max(2, plan.tableRows));
    return Math.max(1, seekCost + matched);
  }
  const scanCost = plan.tableRows;
  if (
    typeof plan.limit === "number" &&
    plan.limit > 0 &&
    matched < plan.tableRows
  ) {
    return Math.min(scanCost, matched * 2);
  }
  return scanCost;
}

/**
 * Pick the best access path for a plan given the available indexes.
 */
export function optimizeQuery(
  plan: QueryPlan,
  indexes: ReadonlyArray<IndexInfo>,
): OptimizedQuery {
  if (plan.tableRows <= 0) {
    return {
      useIndex: false,
      indexName: null,
      estimatedRows: 0,
      estimatedCost: 0,
      strategy: "table_scan",
    };
  }
  const estimatedRows = estimateRows(plan);
  const estimatedCost = calculateQueryCost(plan, indexes);
  let indexName: string | null = null;
  let useIndex = false;
  for (const f of plan.filters) {
    if (!shouldUseIndex(f, indexes)) continue;
    const idx = indexes.find((i) => i.columns[0] === f.column);
    if (idx) {
      indexName = `idx_${f.column}`;
      useIndex = true;
      break;
    }
  }
  const strategy: OptimizedQuery["strategy"] = useIndex
    ? "index_scan"
    : typeof plan.limit === "number" && plan.limit > 0
      ? "limit_scan"
      : "table_scan";
  return {
    useIndex,
    indexName,
    estimatedRows,
    estimatedCost,
    strategy,
  };
}

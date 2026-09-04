/**
 * Pure batching utilities.
 *
 * Splits large collections into fixed-size batches for parallel or chunked
 * processing. No I/O, no D1, no globals.
 */

export interface BatchConfig {
  /** Maximum items per batch. */
  maxBatchSize: number;
  /** Minimum items to justify a batch (smaller inputs run inline). */
  minBatchThreshold: number;
  /** Target number of batches when computing an optimal size. */
  targetBatches: number;
}

/**
 * Default batching configuration: 100-item batches, batch when ≥ 4 items,
 * aim for 8 batches.
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 100,
  minBatchThreshold: 4,
  targetBatches: 8,
};

/**
 * Split `items` into chunks of size `batchSize`. The final chunk may be
 * smaller. Returns an empty array for an empty input. `batchSize` is
 * clamped to a minimum of 1; non-integer sizes are floored.
 */
export function chunkBatch<T>(
  items: ReadonlyArray<T>,
  batchSize: number,
): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const size = Math.max(1, Math.floor(batchSize));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Apply `fn` to each chunk and return the array of results in order. Pure:
 * `fn` is called exactly `chunks.length` times. Returns an empty array for
 * an empty input.
 */
export function processBatch<T, R>(
  items: ReadonlyArray<T>,
  batchSize: number,
  fn: (chunk: T[]) => R,
): R[] {
  const chunks = chunkBatch(items, batchSize);
  const out: R[] = [];
  for (const c of chunks) out.push(fn(c));
  return out;
}

/**
 * Compute an optimal batch size for `itemCount` items such that:
 *   - the number of batches is close to `targetBatches`,
 *   - the batch size never exceeds `maxBatchSize`,
 *   - the batch size is at least 1.
 *
 * Non-finite or non-positive inputs yield 1 (callers can still process a
 * single-item batch safely).
 */
export function calculateBatchSize(
  itemCount: number,
  maxBatchSize: number,
  targetBatches: number,
): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 1;
  if (!Number.isFinite(maxBatchSize) || maxBatchSize <= 0) return 1;
  if (!Number.isFinite(targetBatches) || targetBatches <= 0) return 1;
  const target = Math.floor(itemCount / Math.max(1, targetBatches));
  return Math.max(1, Math.min(Math.floor(maxBatchSize), target));
}

/**
 * Return `true` when `itemCount` is large enough to justify batching.
 * Inputs shorter than or equal to `threshold` should be processed inline.
 */
export function shouldBatch(
  itemCount: number,
  threshold: number,
): boolean {
  if (!Number.isFinite(itemCount) || !Number.isFinite(threshold)) return false;
  return itemCount > Math.max(0, threshold);
}

/**
 * Count the number of batches that {@link chunkBatch} would produce.
 */
export function countBatches(itemCount: number, batchSize: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0;
  const size = Math.max(1, Math.floor(batchSize));
  return Math.ceil(itemCount / size);
}

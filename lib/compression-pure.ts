/**
 * Pure compression-planning helpers.
 *
 * Decides whether a payload is worth compressing and how to chunk it for
 * parallel compression. No actual compression is performed here.
 */

export interface CompressionConfig {
  /** Minimum payload size to consider compressing. */
  minSizeBytes: number;
  /** Compression ratio above which compression is NOT worthwhile. */
  maxRatio: number;
  /** Maximum chunk size for parallel compression. */
  maxChunkSizeBytes: number;
}

/**
 * Default compression config: 1 KiB minimum, skip if ratio > 0.9, 1 MiB
 * max chunk.
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  minSizeBytes: 1024,
  maxRatio: 0.9,
  maxChunkSizeBytes: 1024 * 1024,
};

const HIGH_COMPRESSIBILITY_HINTS = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-www-form-urlencoded",
  "application/ld+json",
  "application/atom+xml",
  "application/rss+xml",
  "application/xhtml+xml",
  "application/graphql",
];

/**
 * Estimate the compression ratio for `input` (0..1, where 0.1 means the
 * compressed output is ~10% of the original). Uses a Shannon-entropy
 * heuristic: low entropy → high compressibility. Strings shorter than 32
 * bytes are assumed incompressible (ratio = 1).
 */
export function estimateCompressionRatio(input: string): number {
  if (typeof input !== "string" || input.length < 32) return 1;
  const freq = new Map<number, number>();
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i) & 0xff;
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }
  let entropy = 0;
  const n = input.length;
  for (const count of freq.values()) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }
  // Theoretical lower bound is entropy/8 bytes per symbol.
  const theoretical = entropy / 8;
  // Real-world compressors typically achieve ~1.3x of the theoretical bound.
  const estimated = Math.min(1, Math.max(0.05, theoretical * 1.3));
  return estimated;
}

/**
 * Decide whether a payload should be compressed. Requires:
 *   - size >= config.minSizeBytes
 *   - content type is compressible (text-like)
 *   - estimated ratio is at or below config.maxRatio
 */
export function shouldCompress(
  contentType: string,
  sizeBytes: number,
  ratio: number,
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): boolean {
  if (!Number.isFinite(sizeBytes) || sizeBytes < config.minSizeBytes) return false;
  const ct = (contentType ?? "").toLowerCase();
  const compressible = HIGH_COMPRESSIBILITY_HINTS.some((h) =>
    ct.startsWith(h),
  );
  if (!compressible) return false;
  if (!Number.isFinite(ratio) || ratio > config.maxRatio) return false;
  return true;
}

/**
 * Compute the optimal chunk size for parallel compression of a payload of
 * `totalSizeBytes`. Picks the largest power-of-two chunk that:
 *   - is at most `maxChunkSizeBytes`
 *   - yields at least 1 chunk and at most `targetChunks` chunks
 *
 * Returns 0 for non-positive or non-finite inputs.
 */
export function getOptimalChunkSize(
  totalSizeBytes: number,
  maxChunkSizeBytes: number,
  targetChunks: number = 4,
): number {
  if (!Number.isFinite(totalSizeBytes) || totalSizeBytes <= 0) return 0;
  if (!Number.isFinite(maxChunkSizeBytes) || maxChunkSizeBytes <= 0) return 0;
  if (!Number.isFinite(targetChunks) || targetChunks <= 0) targetChunks = 4;
  const max = Math.floor(maxChunkSizeBytes);
  const target = Math.max(1, Math.floor(totalSizeBytes / targetChunks));
  const cap = Math.min(max, target);
  if (cap < 1) return 1;
  let p = 1;
  while (p * 2 <= cap) p *= 2;
  return p;
}

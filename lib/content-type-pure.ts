/**
 * Pure content-type utilities.
 *
 * Provides extension → MIME-type lookup, a compressibility predicate, and an
 * `Accept` header parser. No I/O, no globals, safe to use in workers, servers,
 * and tests.
 */

/** Maps common file extensions to their canonical content type. */
export const EXTENSION_CONTENT_TYPES: Readonly<Record<string, string>> = {
  // Text
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  cjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  // Audio / video
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  // Other
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  wasm: "application/wasm",
};

const COMPRESSIBLE_TYPES: ReadonlySet<string> = new Set([
  "text/html",
  "text/css",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/javascript",
  "application/json",
  "application/xml",
  "application/wasm",
  "image/svg+xml",
]);

/**
 * Returns the canonical content type for a file extension, or `null` when the
 * extension is not recognized. The input may include a leading dot and is
 * matched case-insensitively.
 */
export function getContentTypeForExtension(ext: string): string | null {
  if (typeof ext !== "string") return null;
  const normalized = ext.toLowerCase().replace(/^\./, "");
  return EXTENSION_CONTENT_TYPES[normalized] ?? null;
}

/**
 * Returns true when responses of the given content type are typically worth
 * compressing. Recognizes the common text-based MIME types as well as the
 * `+json` and `+xml` structured-syntax suffixes. Already-compressed types
 * (images, video, audio, `application/gzip`) return false.
 */
export function isCompressible(contentType: string): boolean {
  if (typeof contentType !== "string") return false;
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (mime === "") return false;
  if (COMPRESSIBLE_TYPES.has(mime)) return true;
  if (mime.startsWith("text/")) return true;
  if (mime.endsWith("+json") || mime.endsWith("+xml")) return true;
  return false;
}

/** A single media range parsed from an `Accept` header. */
export type AcceptType = {
  type: string;
  q: number;
};

/**
 * Parses an HTTP `Accept` header into a list of media ranges sorted by quality
 * (descending). The `type` field is lowercased; the `q` value defaults to 1
 * and is clamped to [0, 1]. Entries with `q=0` are dropped.
 */
export function parseAcceptHeader(header: string): AcceptType[] {
  if (typeof header !== "string" || header.trim() === "") return [];
  return header
    .split(",")
    .map((part) => part.trim())
    .filter((p) => p !== "")
    .map((part) => {
      const [typeRaw, ...params] = part.split(";").map((s) => s.trim());
      let q = 1;
      for (const p of params) {
        if (p.toLowerCase().startsWith("q=")) {
          const v = Number(p.slice(2));
          if (Number.isFinite(v)) q = v;
        }
      }
      if (q < 0) q = 0;
      if (q > 1) q = 1;
      return { type: typeRaw.toLowerCase(), q };
    })
    .filter((a) => a.q > 0)
    .sort((a, b) => b.q - a.q);
}

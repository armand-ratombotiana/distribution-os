/**
 * Pure encoding helpers. All functions are synchronous and have no
 * platform-specific dependencies — TextEncoder / TextDecoder are available
 * in Node 18+ and in the Workers runtime.
 */

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encodes a UTF-8 string into bytes (Uint8Array). */
export function utf8Encode(input: string): Uint8Array {
  if (typeof input !== "string") {
    throw new TypeError(`utf8Encode expects a string, received ${typeof input}`);
  }
  return TEXT_ENCODER.encode(input);
}

/** Decodes a byte array into a UTF-8 string. */
export function utf8Decode(input: Uint8Array | ArrayBuffer | number[]): string {
  if (input == null) {
    throw new TypeError("utf8Decode expects a byte source");
  }
  const bytes = input instanceof Uint8Array
    ? input
    : Array.isArray(input)
      ? Uint8Array.from(input)
      : new Uint8Array(input);
  return TEXT_DECODER.decode(bytes);
}

/** URL-encodes a string (RFC 3986, same as encodeURIComponent). */
export function urlEncode(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`urlEncode expects a string, received ${typeof input}`);
  }
  return encodeURIComponent(input);
}

/** URL-decodes a string (same as decodeURIComponent). Throws on invalid %. */
export function urlDecode(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`urlDecode expects a string, received ${typeof input}`);
  }
  return decodeURIComponent(input);
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_DECODE_RE = /&(?:amp|lt|gt|quot|#39);/g;
const HTML_DECODE_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Escapes the five significant HTML characters (& < > " '). */
export function htmlEncode(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`htmlEncode expects a string, received ${typeof input}`);
  }
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Reverses the escapes produced by htmlEncode. */
export function htmlDecode(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`htmlDecode expects a string, received ${typeof input}`);
  }
  return input.replace(HTML_DECODE_RE, (entity) => HTML_DECODE_MAP[entity]);
}

/** Standard base64 encoding using the alphabet `+/=`. */
export function base64Encode(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? utf8Encode(input) : input;
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output +=
      BASE64_CHARS[(triplet >> 18) & 0x3f] +
      BASE64_CHARS[(triplet >> 12) & 0x3f] +
      (i + 1 < bytes.length
        ? BASE64_CHARS[(triplet >> 6) & 0x3f]
        : "=") +
      (i + 2 < bytes.length ? BASE64_CHARS[triplet & 0x3f] : "=");
  }
  return output;
}

const BASE64_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < BASE64_CHARS.length; i += 1) {
    map[BASE64_CHARS[i]] = i;
  }
  return map;
})();

/** Decodes a standard base64 string back into a UTF-8 string. */
export function base64Decode(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`base64Decode expects a string, received ${typeof input}`);
  }
  const cleaned = input.replace(/[^A-Za-z0-9+/=]/g, "");
  if (cleaned.length % 4 !== 0) {
    throw new Error(`Invalid base64 length: ${cleaned.length}`);
  }
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const c0 = BASE64_LOOKUP[cleaned[i]] ?? 0;
    const c1 = BASE64_LOOKUP[cleaned[i + 1]] ?? 0;
    const c2 = cleaned[i + 2] === "=" ? 0 : (BASE64_LOOKUP[cleaned[i + 2]] ?? 0);
    const c3 = cleaned[i + 3] === "=" ? 0 : (BASE64_LOOKUP[cleaned[i + 3]] ?? 0);
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes.push((triplet >> 16) & 0xff);
    if (cleaned[i + 2] !== "=") bytes.push((triplet >> 8) & 0xff);
    if (cleaned[i + 3] !== "=") bytes.push(triplet & 0xff);
  }
  return utf8Decode(Uint8Array.from(bytes));
}

const B64URL_STRIP_PADDING = /=+$/;

/** URL-safe base64 encoding: uses `-_` instead of `+/` and omits padding. */
export function base64UrlEncode(input: string | Uint8Array): string {
  return base64Encode(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(B64URL_STRIP_PADDING, "");
}

/** Decodes a URL-safe (unpadded) base64 string. */
export function base64UrlDecode(input: string): string {
  if (typeof input !== "string") {
    throw new TypeError(
      `base64UrlDecode expects a string, received ${typeof input}`,
    );
  }
  let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  return base64Decode(normalized);
}

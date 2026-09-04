/**
 * Pure cryptographic helper functions built on Node's `node:crypto`
 * module. All functions are deterministic given their inputs except
 * `generateRandomBytes` and `generateUuid`, which by design produce
 * fresh random output on every call.
 *
 * No network or D1 dependencies. Safe for unit testing.
 */

import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

/**
 * Generate `length` cryptographically-secure random bytes and return
 * them as a lowercase hex string.
 *
 *   generateRandomBytes(16) // "9f8e7d6c..." (32 hex chars)
 */
export function generateRandomBytes(length: number): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("generateRandomBytes: length must be a positive integer");
  }
  return randomBytes(length).toString("hex");
}

/**
 * Generate a canonical RFC 4122 v4 UUID string.
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Compute the SHA-256 digest of `input` and return it as a lowercase
 * hex string. The input is interpreted as UTF-8.
 */
export function hashString(input: string): string {
  if (typeof input !== "string") {
    throw new Error("hashString: input must be a string");
  }
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Compute the HMAC-SHA256 of `payload` under `secret`. Both inputs are
 * interpreted as UTF-8 strings; the returned digest is hex-encoded.
 */
export function hmacSha256(secret: string, payload: string): string {
  if (typeof secret !== "string" || typeof payload !== "string") {
    throw new Error("hmacSha256: secret and payload must be strings");
  }
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Base64-encode a UTF-8 string.
 */
export function base64Encode(input: string): string {
  if (typeof input !== "string") {
    throw new Error("base64Encode: input must be a string");
  }
  return Buffer.from(input, "utf8").toString("base64");
}

/**
 * Base64-decode a string back to its original UTF-8 representation.
 * Throws when the input is not valid base64.
 */
export function base64Decode(input: string): string {
  if (typeof input !== "string") {
    throw new Error("base64Decode: input must be a string");
  }
  return Buffer.from(input, "base64").toString("utf8");
}

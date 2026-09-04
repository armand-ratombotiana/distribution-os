/**
 * Pure WebSocket message helpers.
 *
 * Provides a small, JSON-based envelope for WebSocket frames: a `type`
 * discriminator (`text` / `binary` / `ping` / `pong` / `close`) plus optional
 * `data`, `code`, and `reason` fields. `parseMessage` accepts either a JSON
 * envelope string or plain text; `buildMessage` always serializes to a JSON
 * string. No I/O, no globals, safe to use in workers, servers, and tests.
 */

export type WebSocketMessageType =
  | "text"
  | "binary"
  | "ping"
  | "pong"
  | "close";

/** A normalized WebSocket frame. */
export type WebSocketMessage = {
  type: WebSocketMessageType;
  data?: string;
  code?: number;
  reason?: string;
};

const VALID_TYPES: ReadonlySet<string> = new Set([
  "text",
  "binary",
  "ping",
  "pong",
  "close",
]);

/**
 * Parses an incoming WebSocket frame payload into a normalized
 * {@link WebSocketMessage}. Accepts either a JSON envelope string (with a
 * `type` field) or a plain text string (treated as `type: "text"`).
 *
 * Returns `null` for an empty input, malformed JSON, or an envelope whose
 * `type` is missing or not one of the known values.
 */
export function parseMessage(raw: string): WebSocketMessage | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Try JSON first.
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { type: "text", data: raw };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { type: "text", data: raw };
    }
    const obj = parsed as Record<string, unknown>;
    const type = obj.type;
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
      return null;
    }
    const message: WebSocketMessage = { type: type as WebSocketMessageType };
    if (typeof obj.data === "string") message.data = obj.data;
    if (typeof obj.code === "number") message.code = obj.code;
    if (typeof obj.reason === "string") message.reason = obj.reason;
    return message;
  }
  // Not JSON — plain text frame.
  return { type: "text", data: raw };
}

/**
 * Serializes a {@link WebSocketMessage} into a JSON string suitable for
 * sending over a WebSocket text frame. Only the fields actually present on
 * the message are included in the output.
 */
export function buildMessage(message: WebSocketMessage): string {
  const obj: Record<string, unknown> = { type: message.type };
  if (message.data !== undefined) obj.data = message.data;
  if (message.code !== undefined) obj.code = message.code;
  if (message.reason !== undefined) obj.reason = message.reason;
  return JSON.stringify(obj);
}

/** True when the message is a `ping` control frame. */
export function isPingMessage(message: WebSocketMessage): boolean {
  return message?.type === "ping";
}

/** True when the message is a `close` control frame. */
export function isCloseMessage(message: WebSocketMessage): boolean {
  return message?.type === "close";
}

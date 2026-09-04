import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseMessage,
  buildMessage,
  isPingMessage,
  isCloseMessage,
  type WebSocketMessage,
} from "../lib/websocket-helpers-pure.ts";

test("parseMessage parses a JSON envelope with a type and data field", () => {
  const msg = parseMessage(JSON.stringify({ type: "text", data: "hello" }));
  assert.deepEqual(msg, { type: "text", data: "hello" });
});

test("parseMessage treats non-JSON input as a plain text frame", () => {
  const msg = parseMessage("plain text message");
  assert.deepEqual(msg, { type: "text", data: "plain text message" });
});

test("parseMessage returns null for an empty or whitespace-only string", () => {
  assert.equal(parseMessage(""), null);
  assert.equal(parseMessage("   "), null);
});

test("parseMessage returns null when the envelope type is missing or invalid", () => {
  assert.equal(parseMessage(JSON.stringify({ data: "no type" })), null);
  assert.equal(parseMessage(JSON.stringify({ type: "bogus" })), null);
});

test("parseMessage preserves code and reason fields for close messages", () => {
  const msg = parseMessage(
    JSON.stringify({ type: "close", code: 1000, reason: "normal" }),
  );
  assert.deepEqual(msg, { type: "close", code: 1000, reason: "normal" });
});

test("buildMessage serializes a text message to a JSON envelope", () => {
  const out = buildMessage({ type: "text", data: "hi" });
  assert.deepEqual(JSON.parse(out), { type: "text", data: "hi" });
});

test("buildMessage includes code and reason for close messages", () => {
  const out = buildMessage({ type: "close", code: 1001, reason: "going away" });
  assert.deepEqual(JSON.parse(out), {
    type: "close",
    code: 1001,
    reason: "going away",
  });
});

test("isPingMessage returns true only for ping messages", () => {
  assert.equal(isPingMessage({ type: "ping" }), true);
  assert.equal(isPingMessage({ type: "text", data: "x" } as WebSocketMessage), false);
  assert.equal(isPingMessage({ type: "close" } as WebSocketMessage), false);
});

test("isCloseMessage returns true only for close messages", () => {
  assert.equal(isCloseMessage({ type: "close" }), true);
  assert.equal(isCloseMessage({ type: "ping" } as WebSocketMessage), false);
  assert.equal(isCloseMessage({ type: "text", data: "x" } as WebSocketMessage), false);
});

test("parseMessage and buildMessage round-trip a ping control frame", () => {
  const original = buildMessage({ type: "ping" });
  const reparsed = parseMessage(original);
  assert.deepEqual(reparsed, { type: "ping" });
});

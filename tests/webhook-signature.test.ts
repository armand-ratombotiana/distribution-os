import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildWebhookDedupKey,
  classifyWebhookEvent,
  computeHmacSha256,
  isDuplicateEvent,
  parseStripeSignature,
  STRIPE_TOLERANCE_SECONDS,
  timingSafeEqual,
  verifyStripeSignature,
} from "../lib/webhook-signature-pure.ts";

// Reference values used across the verify tests.
const SECRET = "whsec_test_secret";
const TIMESTAMP = 1_234_567_890;
const BODY = JSON.stringify({
  id: "evt_1",
  type: "payment_intent.succeeded",
});
const GOOD_SIG = computeHmacSha256(SECRET, `${TIMESTAMP}.${BODY}`);
const GOOD_HEADER = `t=${TIMESTAMP},v1=${GOOD_SIG}`;

test("STRIPE_TOLERANCE_SECONDS is 300 (5 minutes)", () => {
  assert.equal(STRIPE_TOLERANCE_SECONDS, 300);
});

test("parseStripeSignature parses a well-formed header", () => {
  const parsed = parseStripeSignature(GOOD_HEADER);
  assert.ok(parsed);
  assert.equal(parsed.timestamp, TIMESTAMP);
  assert.equal(parsed.signatures.length, 1);
  assert.equal(parsed.signatures[0], GOOD_SIG);
});

test("parseStripeSignature preserves every v1 signature in order", () => {
  const header = `t=${TIMESTAMP},v1=aaa,v1=bbb,v1=ccc`;
  const parsed = parseStripeSignature(header);
  assert.ok(parsed);
  assert.equal(parsed.timestamp, TIMESTAMP);
  assert.deepEqual(parsed.signatures, ["aaa", "bbb", "ccc"]);
});

test("parseStripeSignature returns null when no v1 signature is present", () => {
  assert.equal(parseStripeSignature(`t=${TIMESTAMP}`), null);
});

test("parseStripeSignature returns null for empty or malformed input", () => {
  assert.equal(parseStripeSignature(""), null);
  assert.equal(parseStripeSignature(null), null);
  assert.equal(parseStripeSignature(undefined), null);
  assert.equal(parseStripeSignature("garbage"), null);
  assert.equal(parseStripeSignature("t=notanumber,v1=abc"), null);
  assert.equal(parseStripeSignature("v1=abc"), null);
});

test("parseStripeSignature tolerates whitespace and unknown keys", () => {
  const header = ` t=${TIMESTAMP} , v1=abc , v0=legacy ,foo=bar `;
  const parsed = parseStripeSignature(header);
  assert.ok(parsed);
  assert.equal(parsed.timestamp, TIMESTAMP);
  assert.equal(parsed.signatures.length, 1);
  assert.equal(parsed.signatures[0], "abc");
});

test("computeHmacSha256 matches a known RFC 4231 test vector", () => {
  // HMAC-SHA256("key", "The quick brown fox jumps over the lazy dog")
  const expected = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";
  assert.equal(
    computeHmacSha256("key", "The quick brown fox jumps over the lazy dog"),
    expected,
  );
});

test("computeHmacSha256 is deterministic for identical inputs", () => {
  const a = computeHmacSha256(SECRET, BODY);
  const b = computeHmacSha256(SECRET, BODY);
  assert.equal(a, b);
  // Different secret or payload yields a different digest.
  assert.notEqual(computeHmacSha256(SECRET + "x", BODY), a);
  assert.notEqual(computeHmacSha256(SECRET, BODY + " "), a);
});

test("timingSafeEqual returns true for equal strings and false for different content", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abcdef", "abcdez"), false);
});

test("timingSafeEqual returns false (not throws) for different-length inputs", () => {
  assert.equal(timingSafeEqual("abc", "abcd"), false);
  assert.equal(timingSafeEqual("", "a"), false);
  assert.equal(timingSafeEqual("a", ""), false);
  assert.equal(timingSafeEqual("", ""), true);
});

test("verifyStripeSignature succeeds for a freshly signed payload", () => {
  const result = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP);
  assert.equal(result.valid, true);
  assert.equal(result.timestamp, TIMESTAMP);
  assert.equal(result.expectedSignature, GOOD_SIG);
  assert.equal(result.reason, undefined);
});

test("verifyStripeSignature fails for a tampered payload", () => {
  const tamperedBody = BODY.replace("evt_1", "evt_2");
  const result = verifyStripeSignature(tamperedBody, GOOD_HEADER, SECRET, TIMESTAMP);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "signature_mismatch");
  assert.equal(result.timestamp, TIMESTAMP);
});

test("verifyStripeSignature rejects headers outside the tolerance window", () => {
  // 10 minutes in the future → future_dated.
  const future = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP - 600);
  assert.equal(future.valid, false);
  assert.equal(future.reason, "future_dated");

  // 10 minutes in the past → expired.
  const expired = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP + 600);
  assert.equal(expired.valid, false);
  assert.equal(expired.reason, "expired");

  // 4 minutes off (within 300s tolerance) should still verify.
  const within = verifyStripeSignature(BODY, GOOD_HEADER, SECRET, TIMESTAMP + 240);
  assert.equal(within.valid, true);
});

test("isDuplicateEvent + buildWebhookDedupKey detect redeliveries", () => {
  const key = buildWebhookDedupKey("stripe", "evt_1");
  assert.equal(key, "wh:stripe:evt_1");

  const seen = new Set<string>([key]);
  assert.equal(isDuplicateEvent("wh:stripe:evt_1", seen), true);
  assert.equal(isDuplicateEvent("wh:stripe:evt_2", seen), false);

  const seenArr = ["wh:stripe:evt_1"];
  assert.equal(isDuplicateEvent("wh:stripe:evt_1", seenArr), true);
  assert.equal(isDuplicateEvent("wh:stripe:evt_2", seenArr), false);

  // Empty eventId never counts as a duplicate.
  assert.equal(isDuplicateEvent("", seen), false);
});

test("classifyWebhookEvent maps common Stripe event types to classes", () => {
  assert.equal(classifyWebhookEvent("payment_intent.succeeded"), "payment");
  assert.equal(classifyWebhookEvent("payment_method.attached"), "payment");
  assert.equal(classifyWebhookEvent("charge.succeeded"), "payment");
  assert.equal(classifyWebhookEvent("charge.refunded"), "refund");
  assert.equal(classifyWebhookEvent("charge.dispute.created"), "dispute");
  assert.equal(classifyWebhookEvent("customer.subscription.created"), "subscription");
  assert.equal(classifyWebhookEvent("customer.subscription.deleted"), "subscription");
  assert.equal(classifyWebhookEvent("customer.updated"), "customer");
  assert.equal(classifyWebhookEvent("invoice.paid"), "invoice");
  assert.equal(classifyWebhookEvent("account.updated"), "other");
  assert.equal(classifyWebhookEvent(""), "other");
});

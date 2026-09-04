import assert from "node:assert/strict";
import test from "node:test";

import {
  validateDraft,
  extractHook,
  formatForPlatform,
  getPlatformLimits,
  type ContentDraft,
} from "../lib/content-generation-pure.ts";

const validDraft: ContentDraft = {
  id: "d1",
  headline: "Launch week is here",
  body: "We are shipping. Read on for details. Sign up early for perks.",
  cta: "Sign up now",
  platforms: ["twitter", "linkedin"],
};

test("extractHook returns the explicit hook field when present", () => {
  const d = { ...validDraft, hook: "Stop scrolling. This matters." };
  assert.equal(extractHook(d), "Stop scrolling. This matters.");
});

test("extractHook falls back to the first sentence of the body when no hook is set", () => {
  assert.equal(extractHook(validDraft), "We are shipping.");
});

test("extractHook returns the empty string when body and hook are both empty", () => {
  assert.equal(
    extractHook({ id: "x", headline: "h", body: "", platforms: ["blog"] }),
    "",
  );
  assert.equal(extractHook(null as unknown as ContentDraft), "");
});

test("validateDraft accepts a well-formed draft", () => {
  const res = validateDraft(validDraft);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, []);
});

test("validateDraft flags missing id, headline, body, and platforms, and rejects non-object input", () => {
  const res = validateDraft({ id: "", headline: "   ", body: "", platforms: [] } as unknown as ContentDraft);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("id must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("headline must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("body must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("platforms must be a non-empty array")));

  const nonObject = validateDraft(null as unknown as ContentDraft);
  assert.equal(nonObject.valid, false);
  assert.ok(nonObject.errors.some((e) => e.includes("draft must be an object")));
});

test("validateDraft flags unknown platform values", () => {
  const res = validateDraft({
    id: "x",
    headline: "h",
    body: "b",
    platforms: ["twitter", "tiktok" as never],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("unknown platform")));
});

test("validateDraft flags a headline longer than the smallest platform's headline limit", () => {
  // smallest headline limit across twitter/linkedin is 220 (linkedin)
  const longHeadline = "h".repeat(221);
  const res = validateDraft({
    id: "x",
    headline: longHeadline,
    body: "b",
    platforms: ["twitter", "linkedin"],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("exceeds smallest platform limit")));
});

test("formatForPlatform combines headline, body, and CTA with blank-line separators", () => {
  const out = formatForPlatform(validDraft, "linkedin");
  assert.equal(out, "Launch week is here\n\nWe are shipping. Read on for details. Sign up early for perks.\n\nSign up now");
});

test("formatForPlatform truncates body to fit the twitter 280-char limit", () => {
  const long = "x".repeat(500);
  const d: ContentDraft = {
    id: "x",
    headline: "h",
    body: long,
    platforms: ["twitter"],
  };
  const out = formatForPlatform(d, "twitter");
  assert.ok(out.length <= 280, `expected <=280, got ${out.length}`);
  assert.ok(out.endsWith("…"));
  assert.ok(out.startsWith("h\n\n"));
});

test("formatForPlatform returns empty string for unknown platforms and bad input", () => {
  assert.equal(formatForPlatform(validDraft, "tiktok" as never), "");
  assert.equal(formatForPlatform(null as unknown as ContentDraft, "twitter"), "");
});

test("formatForPlatform drops the CTA when there is no body budget left", () => {
  // headline alone uses up the twitter budget (280 chars)
  const d: ContentDraft = {
    id: "x",
    headline: "h".repeat(280),
    body: "body text here",
    cta: "click me",
    platforms: ["twitter"],
  };
  const out = formatForPlatform(d, "twitter");
  assert.ok(out.length <= 280);
  assert.ok(!out.includes("click me"));
  assert.ok(!out.includes("body text here"));
});

test("getPlatformLimits returns limits for known platforms and null for unknown", () => {
  assert.deepEqual(getPlatformLimits("twitter"), { body: 280, headline: 280 });
  assert.deepEqual(getPlatformLimits("blog"), { body: 50000, headline: 120 });
  assert.equal(getPlatformLimits("tiktok" as never), null);
});

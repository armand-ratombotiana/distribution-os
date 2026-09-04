import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateA11yId,
  getStatusLabel,
  getStatusColor,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  getKeyboardShortcuts,
  getAnnouncementMessage,
  shouldAnnounce,
  getScreenReaderText,
} from "../lib/accessibility-pure.js";

test("generateA11yId produces unique ids on subsequent calls", () => {
  const a = generateA11yId();
  const b = generateA11yId();
  assert.notEqual(a, b);
  assert.match(a, /^a11y-/);
});

test("generateA11yId uses the supplied prefix", () => {
  const id = generateA11yId("field");
  assert.match(id, /^field-/);
});

test("getStatusLabel returns a human-readable label for a known status", () => {
  assert.equal(getStatusLabel("success"), "Success");
  assert.equal(getStatusLabel("loading"), "Loading");
});

test("getStatusColor returns a hex color for a known status", () => {
  assert.match(getStatusColor("error"), /^#[0-9a-f]{6}$/i);
  assert.equal(getStatusColor("info"), "#2563eb");
});

test("getContrastRatio returns 1 for identical colors and 21 for black/white", () => {
  assert.equal(getContrastRatio("#000000", "#000000"), 1);
  const ratio = getContrastRatio("#000000", "#ffffff");
  assert.ok(Math.abs(ratio - 21) < 0.001, `expected ~21, got ${ratio}`);
});

test("meetsWCAGAA returns true for ratio >= 4.5 on normal text", () => {
  assert.equal(meetsWCAGAA(4.5), true);
  assert.equal(meetsWCAGAA(4.4), false);
});

test("meetsWCAGAAA returns true for ratio >= 7 on normal text", () => {
  assert.equal(meetsWCAGAAA(7), true);
  assert.equal(meetsWCAGAAA(6.9), false);
});

test("meetsWCAGAA accepts a lower ratio (>=3) for large text", () => {
  assert.equal(meetsWCAGAA(3, true), true);
  assert.equal(meetsWCAGAA(2.9, true), false);
});

test("getKeyboardShortcuts returns a list with key and description entries", () => {
  const shortcuts = getKeyboardShortcuts();
  assert.ok(Array.isArray(shortcuts));
  assert.ok(shortcuts.length >= 4);
  assert.ok(shortcuts.every((s) => typeof s.key === "string" && typeof s.description === "string"));
});

test("getAnnouncementMessage returns the label and optional context", () => {
  assert.equal(getAnnouncementMessage("success"), "Success");
  assert.equal(getAnnouncementMessage("error", "missing field"), "Error: missing field");
});

test("shouldAnnounce returns false only for the idle status", () => {
  assert.equal(shouldAnnounce("idle"), false);
  assert.equal(shouldAnnounce("success"), true);
  assert.equal(shouldAnnounce("loading"), true);
});

test("getScreenReaderText joins non-empty parts with a comma separator", () => {
  assert.equal(getScreenReaderText("Step 1", null, "of 3", ""), "Step 1, of 3");
});

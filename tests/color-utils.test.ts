import { test } from "node:test";
import assert from "node:assert/strict";

import {
  hexToRgb,
  rgbToHex,
  lighten,
  darken,
  mix,
  getContrast,
  isLight,
  isDark,
  relativeLuminance,
} from "../lib/color-utils-pure.ts";

test("hexToRgb parses 3-digit hex shorthand", () => {
  assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb("0a0"), { r: 0, g: 170, b: 0 });
});

test("hexToRgb parses 6-digit hex with or without leading hash", () => {
  assert.deepEqual(hexToRgb("#ff8800"), { r: 255, g: 136, b: 0 });
  assert.deepEqual(hexToRgb("00ff88"), { r: 0, g: 255, b: 136 });
});

test("hexToRgb throws on invalid input", () => {
  assert.throws(() => hexToRgb("#zzz"), /Invalid hex color/);
  assert.throws(() => hexToRgb("12345"), /Invalid hex color/);
  // @ts-expect-error testing runtime guard
  assert.throws(() => hexToRgb(42), /expects a string/);
});

test("rgbToHex clamps out-of-range channels and pads short values", () => {
  assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), "#000000");
  assert.equal(rgbToHex({ r: 255, g: 255, b: 255 }), "#ffffff");
  assert.equal(rgbToHex({ r: 300, g: -5, b: 16 }), "#ff0010");
});

test("rgbToHex is the inverse of hexToRgb for valid colors", () => {
  const colors = ["#000000", "#ffffff", "#ff8800", "#3a7bd5"];
  for (const c of colors) {
    assert.equal(rgbToHex(hexToRgb(c)), c);
  }
});

test("lighten moves a color toward white", () => {
  assert.equal(lighten("#000000", 1), "#ffffff");
  assert.equal(lighten("#000000", 0), "#000000");
  // Halfway between #000000 and #ffffff in linear space
  assert.equal(lighten("#000000", 0.5), "#808080");
});

test("darken moves a color toward black", () => {
  assert.equal(darken("#ffffff", 1), "#000000");
  assert.equal(darken("#ffffff", 0), "#ffffff");
});

test("mix blends two colors linearly by ratio", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#ff0000", "#0000ff", 0), "#ff0000");
  assert.equal(mix("#ff0000", "#0000ff", 1), "#0000ff");
  // 50/50 red+blue → purple-ish #800080
  assert.equal(mix("#ff0000", "#0000ff", 0.5), "#800080");
});

test("mix clamps ratios outside [0,1]", () => {
  assert.equal(mix("#000000", "#ffffff", -1), "#000000");
  assert.equal(mix("#000000", "#ffffff", 2), "#ffffff");
});

test("getContrast returns 21 for black-on-white and ~1 for identical colors", () => {
  assert.ok(Math.abs(getContrast("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(getContrast("#123456", "#123456") - 1) < 0.001);
});

test("getContrast is symmetric in its arguments", () => {
  const a = getContrast("#ff8800", "#0033cc");
  const b = getContrast("#0033cc", "#ff8800");
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("isLight and isDark classify white and black correctly", () => {
  assert.equal(isLight("#ffffff"), true);
  assert.equal(isDark("#ffffff"), false);
  assert.equal(isLight("#000000"), false);
  assert.equal(isDark("#000000"), true);
});

test("isLight / isDark split at mid-gray", () => {
  // #808080 has luminance ~0.216 (below 0.5) → dark
  assert.equal(isDark("#808080"), true);
  assert.equal(isLight("#808080"), false);
  // #eeeeee is bright enough to count as light
  assert.equal(isLight("#eeeeee"), true);
});

test("relativeLuminance returns 0 for black and 1 for white", () => {
  assert.ok(Math.abs(relativeLuminance("#000000") - 0) < 1e-6);
  assert.ok(Math.abs(relativeLuminance("#ffffff") - 1) < 1e-6);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  wordCount,
  readingTime,
  countSyllables,
  extractKeywords,
  sentimentScore,
  fleschKincaid,
} from "../lib/text-analysis-pure.ts";

test("wordCount counts words, sentences, and characters", () => {
  const result = wordCount("Hello world. This is a test!");
  assert.equal(result.words, 6);
  assert.equal(result.sentences, 2);
  assert.equal(result.characters, "Hello world. This is a test!".length);
});

test("wordCount returns zeros for empty or non-string input", () => {
  assert.deepEqual(wordCount(""), { words: 0, sentences: 0, characters: 0 });
  // @ts-expect-error runtime guard
  assert.deepEqual(wordCount(null), { words: 0, sentences: 0, characters: 0 });
});

test("wordCount handles punctuation and contractions", () => {
  const result = wordCount("Don't go — I'm here.");
  assert.equal(result.words, 4);
});

test("readingTime returns minutes at 200 wpm by default", () => {
  // 400 words at 200 wpm → 2 minutes.
  const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
  assert.ok(Math.abs(readingTime(text) - 2) < 1e-6);
});

test("readingTime respects a custom wordsPerMinute value", () => {
  const text = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
  assert.equal(readingTime(text, 100), 1);
});

test("readingTime throws on non-positive wordsPerMinute", () => {
  assert.throws(() => readingTime("hi", 0), /wordsPerMinute/);
  assert.throws(() => readingTime("hi", -5), /wordsPerMinute/);
});

test("countSyllables counts vowel groups and trims silent e", () => {
  assert.equal(countSyllables("hello"), 2);
  assert.equal(countSyllables("world"), 1);
  assert.equal(countSyllables("apple"), 2); // 'le' restoration
  assert.equal(countSyllables("the"), 1);
  assert.equal(countSyllables("queue"), 1);
  assert.equal(countSyllables(""), 0);
});

test("extractKeywords returns the top N non-stop words by frequency", () => {
  const text =
    "the quick brown fox jumps over the lazy dog. the fox was quick and brown.";
  const kw = extractKeywords(text, 3);
  // All three of brown / fox / quick appear twice; ties broken alphabetically.
  assert.deepEqual(kw, ["brown", "fox", "quick"]);
  assert.equal(kw.length, 3);
});

test("extractKeywords returns [] for empty input", () => {
  assert.deepEqual(extractKeywords(""), []);
  assert.deepEqual(extractKeywords("the a an of to"), []);
});

test("sentimentScore is positive for happy text and negative for sad text", () => {
  assert.ok(sentimentScore("This is wonderful and amazing, I love it!") > 0);
  assert.ok(sentimentScore("This is terrible and awful, I hate it.") < 0);
  assert.equal(sentimentScore("The cat sat on the mat."), 0);
});

test("sentimentScore returns 0 for empty input", () => {
  assert.equal(sentimentScore(""), 0);
});

test("fleschKincaid returns 0 for empty input", () => {
  assert.equal(fleschKincaid(""), 0);
});

test("fleschKincaid produces a higher grade level for denser text", () => {
  const simple = "The cat sat. The dog ran. I am happy.";
  const dense =
    "Notwithstanding the multifaceted methodological considerations, " +
    "researchers systematically evaluated heterogeneous phenomena " +
    "circumscribing institutional paradigms.";
  assert.ok(fleschKincaid(dense) > fleschKincaid(simple));
});

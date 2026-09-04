/**
 * Pure text-analysis helpers — word counts, reading-time estimates,
 * keyword extraction, a tiny lexicon-based sentiment score, and a
 * Flesch–Kincaid grade-level calculator.
 *
 * All functions are deterministic and depend only on their inputs.
 */

const WORD_RE = /\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu;
const SENTENCE_RE = /[^.!?]+[.!?]+/g;
const SYL_VOWEL_GROUP_RE = /[aeiouy]+/gi;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on",
  "at", "by", "for", "with", "as", "is", "are", "was", "were", "be", "been",
  "being", "this", "that", "these", "those", "it", "its", "i", "you", "he",
  "she", "we", "they", "them", "his", "her", "their", "our", "your", "my",
  "me", "him", "us", "from", "into", "over", "under", "again", "further",
  "once", "here", "there", "all", "any", "both", "each", "few", "more",
  "most", "other", "some", "such", "no", "not", "only", "own", "same", "so",
  "than", "too", "very", "can", "will", "just", "should", "now",
]);

const POSITIVE_WORDS = new Set([
  "good", "great", "excellent", "amazing", "wonderful", "fantastic", "happy",
  "joy", "love", "best", "awesome", "beautiful", "brilliant", "perfect",
  "positive", "success", "win", "winning", "delightful", "pleasant", "nice",
  "superb", "outstanding", "favorable", "beneficial", "impressive",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "terrible", "awful", "horrible", "hate", "worst", "poor", "sad",
  "angry", "wrong", "fail", "failure", "broken", "ugly", "negative", "loss",
  "lose", "losing", "disappointing", "unpleasant", "nasty", "inferior",
  "dreadful", "unfavorable", "harmful", "weak",
]);

export interface WordCountResult {
  words: number;
  sentences: number;
  characters: number;
}

/** Returns counts of words, sentences, and characters for a body of text. */
export function wordCount(text: string): WordCountResult {
  if (typeof text !== "string" || text.length === 0) {
    return { words: 0, sentences: 0, characters: 0 };
  }
  const words = text.match(WORD_RE) ?? [];
  const sentences = text.match(SENTENCE_RE) ?? [];
  return {
    words: words.length,
    sentences: sentences.length === 0 ? (words.length > 0 ? 1 : 0) : sentences.length,
    characters: text.length,
  };
}

/** Estimates reading time in minutes at `wordsPerMinute` (default 200). */
export function readingTime(text: string, wordsPerMinute = 200): number {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) {
    throw new Error("readingTime: wordsPerMinute must be a positive number");
  }
  const { words } = wordCount(text);
  return words / wordsPerMinute;
}

/** Counts syllables in a single word using a vowel-group heuristic. */
export function countSyllables(word: string): number {
  if (typeof word !== "string" || word.length === 0) return 0;
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  const groups = cleaned.match(SYL_VOWEL_GROUP_RE) ?? [];
  let count = groups.length;
  if (count > 0 && cleaned.endsWith("e")) count -= 1;
  if (count > 0 && cleaned.endsWith("le") && cleaned.length > 2) {
    const before = cleaned[cleaned.length - 3];
    if (before && !"aeiouy".includes(before)) count += 1;
  }
  return Math.max(1, count);
}

/** Returns the top N most-frequent non-stop words, lowercased. */
export function extractKeywords(text: string, topN = 5): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const matches = text.toLowerCase().match(WORD_RE) ?? [];
  const freq: Record<string, number> = {};
  for (const raw of matches) {
    const w = raw.toLowerCase();
    if (STOP_WORDS.has(w) || w.length < 3) continue;
    freq[w] = (freq[w] ?? 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w);
}

/**
 * Returns a sentiment score in the range [-1, 1]: positive text > 0,
 * negative text < 0, neutral = 0. Uses a small lexicon.
 */
export function sentimentScore(text: string): number {
  if (typeof text !== "string" || text.length === 0) return 0;
  const matches = text.toLowerCase().match(WORD_RE) ?? [];
  if (matches.length === 0) return 0;
  let positive = 0;
  let negative = 0;
  for (const w of matches) {
    const word = w.toLowerCase();
    if (POSITIVE_WORDS.has(word)) positive += 1;
    if (NEGATIVE_WORDS.has(word)) negative += 1;
  }
  return (positive - negative) / matches.length;
}

/**
 * Computes the Flesch–Kincaid grade level for `text`.
 * Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 */
export function fleschKincaid(text: string): number {
  if (typeof text !== "string" || text.length === 0) return 0;
  const { words, sentences } = wordCount(text);
  if (words === 0 || sentences === 0) return 0;
  const matches = text.match(WORD_RE) ?? [];
  const syllables = matches.reduce((sum, w) => sum + countSyllables(w), 0);
  const score =
    0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.round(score * 10) / 10;
}

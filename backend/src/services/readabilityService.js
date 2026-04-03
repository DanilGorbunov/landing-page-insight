/**
 * Simple Flesch-Kincaid readability analysis from markdown text.
 * No external dependencies needed — pure algorithmic.
 */

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/**
 * Analyze readability of text content.
 * @param {string} text - raw or markdown text
 * @returns {{ gradeLevel: number, readingEase: number, wordCount: number, sentenceCount: number, avgSentenceLength: number, avgSyllablesPerWord: number }}
 */
export function analyzeReadability(text) {
  if (!text || typeof text !== "string") {
    return { gradeLevel: null, readingEase: null, wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 };
  }

  const cleaned = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_~`>|]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 2);
  const words = cleaned.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z]/g, "").length > 0);

  if (words.length === 0 || sentences.length === 0) {
    return { gradeLevel: null, readingEase: null, wordCount: 0, sentenceCount: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 };
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const readingEase = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
  const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

  return {
    gradeLevel: Math.round(Math.max(0, gradeLevel) * 10) / 10,
    readingEase: Math.round(Math.max(0, Math.min(100, readingEase)) * 10) / 10,
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
  };
}

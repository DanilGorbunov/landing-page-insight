import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract domain from URL (strip protocol and trailing slash). */
export function getDomain(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Parse "X/10" score from report text. */
export function parseScoreFromReport(report: string | undefined): number | null {
  if (!report) return null;
  const m = report.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  return m ? parseFloat(m[1], 10) : null;
}

/** Compute competitor overall score as average of parsed section scores from analysis text. */
export function getCompetitorOverallScore(analysis: Record<string, string> | undefined): number | null {
  if (!analysis || typeof analysis !== "object") return null;
  const values = Object.values(analysis);
  if (values.length === 0) return null;
  const scores = values.map((t) => parseScoreFromReport(t)).filter((n): n is number => n != null);
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

const NEGATIVE_WORDS = /\b(no |missing|lacks?|generic|not |without|weak|poor|avoid)\b/i;
/** Turn section analysis text into short bullet points with pass/fail for card UI. */
export function analysisToBullets(text: string | undefined, maxPoints = 4): { pass: boolean; text: string }[] {
  if (!text || !text.trim()) return [];
  const segments = text
    .split(/\n+|\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
  return segments.slice(0, maxPoints).map((s) => ({
    pass: !NEGATIVE_WORDS.test(s),
    text: s.length > 120 ? s.slice(0, 117) + "…" : s,
  }));
}

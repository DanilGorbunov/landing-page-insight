import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract domain from URL (strip protocol and trailing slash). */
export function getDomain(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Return true if string is a valid http or https URL with a real-looking host (domain with dot or localhost). */
export function isValidHttpUrl(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host !== "localhost" && !host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Normalize input to full URL (add https if no protocol). Only http/https allowed. */
export function normalizeInputUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

/** Remove Markdown-style formatting chars from text so they don't show as raw symbols (e.g. **bold** → bold). */
export function stripMarkdownFormatting(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/#{1,6}\s/g, "")
    .trim()
    .replace(/\s{2,}/g, " ");
}

/** Drop lines that look like JSON/array snippets (e.g. model leaked structured output). */
export function filterInsightLines(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .split(/\n+/)
    .filter((line) => !line.includes("["))
    .join("\n")
    .trim();
}

/** Strip boilerplate prefixes from report text used in Overview summary preview. */
export function cleanReportSummaryText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/^Competitive Analysis:.*?Executive Summary\s*/is, "")
    .replace(/^Executive Summary\s*/i, "")
    .replace(/Overall score:.*?\n/i, "")
    .trim();
}

/** Default score when none can be parsed (always show a rating). */
export const DEFAULT_SCORE = 5.5;

/** Ensure we always have a number for display (ratings are mandatory). */
export function ensureScore(score: number | null | undefined): number {
  if (score != null && !Number.isNaN(score)) return Math.min(10, Math.max(0, score));
  return DEFAULT_SCORE;
}

/** Parse "X/10" or "X.Y/10" score from report/section text. Uses first match. */
export function parseScoreFromReport(report: string | undefined): number | null {
  if (!report) return null;
  const m = report.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  return m ? parseFloat(m[1], 10) : null;
}

/** Section keys used by backend analysis. */
export const SECTION_KEYS = [
  "hero",
  "value proposition",
  "features",
  "social proof",
  "CTA",
] as const;

/** Turn live numeric section scores into text parseable by parseSectionScores (for radar during progressive UI). */
export function liveSectionScoresToAnalysisText(
  sectionScores: Record<string, number | null | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SECTION_KEYS) {
    const v = sectionScores[key];
    out[key] = typeof v === "number" && !Number.isNaN(v) ? `Score: ${v}/10` : "";
  }
  return out;
}

export type SectionScoreKey = "hero" | "value_prop" | "features" | "social_proof" | "cta";

const SECTION_TO_RADAR: Record<(typeof SECTION_KEYS)[number], SectionScoreKey> = {
  hero: "hero",
  "value proposition": "value_prop",
  features: "features",
  "social proof": "social_proof",
  CTA: "cta",
};

/** Parse per-section scores from analysis. Returns null for a section if not found. Only include site in radar if all 5 are numbers. */
export function parseSectionScores(
  analysis: Record<string, string> | undefined
): Record<SectionScoreKey, number | null> | null {
  if (!analysis || typeof analysis !== "object") return null;
  const out: Record<SectionScoreKey, number | null> = {
    hero: null,
    value_prop: null,
    features: null,
    social_proof: null,
    cta: null,
  };
  for (const key of SECTION_KEYS) {
    const text = analysis[key];
    const n = parseScoreFromReport(text);
    const radarKey = SECTION_TO_RADAR[key];
    out[radarKey] = n != null && !Number.isNaN(n) ? Math.min(10, Math.max(0, n)) : null;
  }
  return out;
}

/** True if scores object has all 5 numeric scores (no null). */
export function hasFullSectionScores(
  scores: Record<SectionScoreKey, number | null> | null
): scores is Record<SectionScoreKey, number> {
  if (!scores) return false;
  return SECTION_KEYS.every((k) => {
    const v = scores[SECTION_TO_RADAR[k]];
    return typeof v === "number" && !Number.isNaN(v);
  });
}

/** Compute overall score as average of parsed section scores from analysis text. */
export function getCompetitorOverallScore(analysis: Record<string, string> | undefined): number | null {
  if (!analysis || typeof analysis !== "object") return null;
  const values = Object.values(analysis);
  if (values.length === 0) return null;
  const scores = values.map((t) => parseScoreFromReport(t)).filter((n): n is number => n != null);
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/** Infer score 0–10 from pass/fail bullets when no "X/10" in text. Average pass ratio across sections. */
export function inferScoreFromAnalysis(analysis: Record<string, string> | undefined): number | null {
  if (!analysis || typeof analysis !== "object") return null;
  const values = Object.values(analysis).filter((t) => t?.trim());
  if (values.length === 0) return null;
  const ratios: number[] = [];
  for (const text of values) {
    const bullets = analysisToBullets(text, 10);
    if (bullets.length === 0) continue;
    const passCount = bullets.filter((b) => b.pass).length;
    ratios.push(passCount / bullets.length);
  }
  if (ratios.length === 0) return null;
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.round(avg * 10 * 10) / 10; // 0–10, one decimal
}

const NEGATIVE_WORDS = /\b(no |missing|lacks?|generic|not |without|weak|poor|avoid)\b/i;
/** Turn section analysis text into short bullet points with pass/fail for card UI. */
export function analysisToBullets(text: string | undefined, maxPoints = 4): { pass: boolean; text: string }[] {
  if (!text || !text.trim()) return [];
  const segments = text
    .split(/\n+|\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
    .filter((s) => !s.includes("["));
  return segments
    .slice(0, maxPoints)
    .map((s) => {
      const cleaned = stripMarkdownFormatting(s);
      return {
        pass: !NEGATIVE_WORDS.test(cleaned),
        text: cleaned.length > 120 ? cleaned.slice(0, 117) + "…" : cleaned,
      };
    })
    .filter((b) => !b.text.includes("["));
}

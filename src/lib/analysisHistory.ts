import type { AnalysisResult } from "@/lib/api";
import { getDomain, parseScoreFromReport, getCompetitorOverallScore, DEFAULT_SCORE } from "@/lib/utils";

const STORAGE_KEY = "ll_history";
const MAX_ENTRIES = 10;
const TTL_MS = 60 * 60 * 1000; // 1 hour

export type { AnalysisResult };

export interface HistoryEntry {
  id: string;
  domain: string;
  score: number | undefined;
  analyzedAt: string;
  expiresAt: number;
  result: AnalysisResult;
}

export function saveToHistory(url: string, result: AnalysisResult): void {
  cleanExpired();
  const domain = getDomain(url);
  const history = getHistory();
  const score =
    result.synthesis?.overall_score ??
    parseScoreFromReport(result.report) ??
    getCompetitorOverallScore(result.userAnalysis) ??
    DEFAULT_SCORE;
  const entry: HistoryEntry = {
    id: String(result.jobId ?? Date.now()),
    domain,
    score,
    analyzedAt: new Date().toISOString(),
    expiresAt: Date.now() + TTL_MS,
    result,
  };
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getHistory(): HistoryEntry[] {
  cleanExpired();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function cleanExpired(): void {
  const history = getHistoryRaw();
  const now = Date.now();
  const fresh = history.filter((e) => e.expiresAt > now);
  if (fresh.length !== history.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }
}

function getHistoryRaw(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getHistoryCount(): number {
  return getHistory().length;
}

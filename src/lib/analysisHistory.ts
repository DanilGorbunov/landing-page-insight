import type { AnalysisResult } from "@/lib/api";
import { getDomain, parseScoreFromReport, getCompetitorOverallScore, DEFAULT_SCORE } from "@/lib/utils";

const STORAGE_KEY = "ll_history";
/** After full / extended report unlock — history entries do not expire (local demo). */
export const HISTORY_FULL_UNLOCK_KEY = "ll_history_full_unlock";
const MAX_ENTRIES = 10;
const TTL_MS = 60 * 60 * 1000; // 1 hour (free users)
/** Far-future expiry for “permanent” rows (JSON-safe). */
const PERMANENT_EXPIRES_AT = 8640000000000000;

export type { AnalysisResult };

export interface HistoryEntry {
  id: string;
  domain: string;
  score: number | undefined;
  analyzedAt: string;
  expiresAt: number;
  result: AnalysisResult;
}

export function hasFullInsightsHistoryUnlock(): boolean {
  try {
    return localStorage.getItem(HISTORY_FULL_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Call after demo checkout or when opening the extended report — domains in History no longer expire.
 * Migrates existing rows to non-expiring.
 */
export function enableFullInsightsHistoryPersistence(): void {
  try {
    localStorage.setItem(HISTORY_FULL_UNLOCK_KEY, "1");
    const history = getHistoryRaw();
    if (history.length === 0) return;
    const migrated = history.map((e) => ({ ...e, expiresAt: PERMANENT_EXPIRES_AT }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  } catch {
    /* ignore quota / private mode */
  }
}

export function saveToHistory(url: string, result: AnalysisResult): void {
  cleanExpired();
  const domain = getDomain(url);
  const history = getHistory();
  const persistent = hasFullInsightsHistoryUnlock();
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
    expiresAt: persistent ? PERMANENT_EXPIRES_AT : Date.now() + TTL_MS,
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
  if (hasFullInsightsHistoryUnlock()) return;
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

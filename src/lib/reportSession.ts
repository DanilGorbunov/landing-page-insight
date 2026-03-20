import type { AnalysisResult } from "@/types/api";
import type { HistoryEntry } from "@/lib/analysisHistory";

export const REPORT_RETURN_KEY = "landinglens_report_return";
export const FULL_INSIGHTS_KEY = "landinglens_full_insights";
/** Last demo-checkout plan info (localStorage) — reused when opening History → full insights. */
export const FULL_INSIGHTS_UNLOCK_META_KEY = "ll_full_insights_unlock_meta";

export interface ReportReturnPayload {
  url?: string;
  result?: AnalysisResult | null;
  savedEntry?: HistoryEntry | null;
}

export interface FullInsightsPayload {
  url: string;
  result: AnalysisResult | null;
  planId: string;
  planName: string;
  paidAt: string;
}

export function readReportReturnPayload(): ReportReturnPayload | null {
  try {
    const raw = sessionStorage.getItem(REPORT_RETURN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReportReturnPayload;
  } catch {
    return null;
  }
}

export function writeFullInsightsPayload(data: FullInsightsPayload): void {
  sessionStorage.setItem(FULL_INSIGHTS_KEY, JSON.stringify(data));
}

export function readFullInsightsPayload(): FullInsightsPayload | null {
  try {
    const raw = sessionStorage.getItem(FULL_INSIGHTS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FullInsightsPayload;
  } catch {
    return null;
  }
}

export interface FullInsightsUnlockMeta {
  planId: string;
  planName: string;
  paidAt: string;
}

export function writeFullInsightsUnlockMeta(meta: FullInsightsUnlockMeta): void {
  try {
    localStorage.setItem(FULL_INSIGHTS_UNLOCK_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function readFullInsightsUnlockMeta(): FullInsightsUnlockMeta | null {
  try {
    const raw = localStorage.getItem(FULL_INSIGHTS_UNLOCK_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FullInsightsUnlockMeta;
  } catch {
    return null;
  }
}

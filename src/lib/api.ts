import { VITE_API_BASE_URL } from "@/lib/env";
import { API_TIMEOUT_MS, MAX_COMPETITORS } from "@/lib/constants";
import type { HistoryEntry } from "@/lib/analysisHistory";
import type { AnalysisResult, CriticalGap, JobProgressEntry, JobLiveState, JobStatus } from "@/types/api";

export type { AnalysisResult, CriticalGap, JobProgressEntry, JobLiveState, JobStatus } from "@/types/api";

const API_BASE = VITE_API_BASE_URL;

export function getApiBase(): string {
  return API_BASE;
}

const DEFAULT_FETCH_OPTIONS: RequestInit = {
  headers: { "Content-Type": "application/json" },
};

function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = API_TIMEOUT_MS, ...init } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

export async function startAnalysis(
  url: string,
  competitorUrls?: string[]
): Promise<{ jobId: string; live?: JobLiveState }> {
  const urlToCall = `${API_BASE}/api/analyze`;
  const body: { url: string; competitors?: string[] } = { url };
  const valid = competitorUrls?.filter((u) => u?.trim()).slice(0, MAX_COMPETITORS) ?? [];
  if (valid.length > 0) body.competitors = valid;
  const res = await fetchWithTimeout(urlToCall, {
    method: "POST",
    ...DEFAULT_FETCH_OPTIONS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "Backend not found (404). On Vercel: set VITE_API_BASE_URL to your Railway backend URL in Project → Settings → Environment Variables, then redeploy."
      );
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Analysis failed: ${res.status}`);
  }
  return res.json();
}

export function getStreamUrl(jobId: string): string {
  return `${API_BASE}/api/analyze/stream/${jobId}`;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetchWithTimeout(`${API_BASE}/api/analyze/job/${jobId}`, DEFAULT_FETCH_OPTIONS);
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

const PERMANENT_EXPIRES_AT = 8640000000000000;

/** Latest completed comparisons from the API (global feed). Empty if backend missing or error. */
export async function fetchRecentComparisonsFromApi(limit = 3): Promise<HistoryEntry[]> {
  if (!API_BASE) return [];
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/recent-comparisons?limit=${limit}`, {
      ...DEFAULT_FETCH_OPTIONS,
      method: "GET",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      id: string;
      domain: string;
      score: number | null;
      analyzedAt: string;
      result: AnalysisResult;
    }[];
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      score: r.score == null ? undefined : Number(r.score),
      analyzedAt: r.analyzedAt,
      expiresAt: PERMANENT_EXPIRES_AT,
      result: r.result,
      source: "server" as const,
    }));
  } catch {
    return [];
  }
}

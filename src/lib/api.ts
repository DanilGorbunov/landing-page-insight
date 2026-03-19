import { VITE_API_BASE_URL } from "@/lib/env";
import { API_TIMEOUT_MS, MAX_COMPETITORS } from "@/lib/constants";
import type { AnalysisResult, CriticalGap, JobProgressEntry, JobStatus } from "@/types/api";

export type { AnalysisResult, CriticalGap, JobProgressEntry, JobStatus } from "@/types/api";

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
): Promise<{ jobId: string }> {
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

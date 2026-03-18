// In production (Vercel) set VITE_API_BASE_URL to your Railway backend URL, e.g. https://your-app.up.railway.app
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim() || "http://localhost:3000";

export interface CriticalGap {
  priority: "P1" | "P2";
  area: string;
  problem: string;
  recommendation: string;
  competitor: string;
  confidence: "High" | "Medium" | "Low";
}

export interface AnalysisResult {
  report: string;
  userAnalysis: Record<string, string>;
  competitors: Array<{
    url: string;
    analysis: Record<string, string>;
    screenshotUrl?: string | null;
  }>;
  targetScreenshotUrl?: string | null;
  synthesis?: { overall_score?: number };
  /** Critical gaps from current analysis only; part of cached result, never stored separately */
  gaps?: CriticalGap[];
}

export function getApiBase(): string {
  return API_BASE;
}

export async function startAnalysis(
  url: string,
  competitorUrls?: string[]
): Promise<{ jobId: string }> {
  const urlToCall = `${API_BASE}/api/analyze`;
  const body: { url: string; competitors?: string[] } = { url };
  const valid = competitorUrls?.filter((u) => u?.trim()).slice(0, 3) ?? [];
  if (valid.length > 0) body.competitors = valid;
  const res = await fetch(urlToCall, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export interface JobProgressEntry {
  step?: string;
  message?: string;
  index?: number;
  total?: number;
  competitors?: string[];
}

export interface JobStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: JobProgressEntry[];
  result?: AnalysisResult | null;
  error?: string | null;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/analyze/job/${jobId}`);
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

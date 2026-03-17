// In production (Vercel) set VITE_API_BASE_URL to your Railway backend URL, e.g. https://your-app.up.railway.app
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim() || "http://localhost:3000";

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
}

export function getApiBase(): string {
  return API_BASE;
}

export async function startAnalysis(url: string): Promise<{ jobId: string }> {
  const urlToCall = `${API_BASE}/api/analyze`;
  const res = await fetch(urlToCall, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
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

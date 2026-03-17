const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

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

export async function startAnalysis(url: string): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Analysis failed: ${res.status}`);
  }
  return res.json();
}

export function getStreamUrl(jobId: string): string {
  return `${API_BASE}/api/analyze/stream/${jobId}`;
}

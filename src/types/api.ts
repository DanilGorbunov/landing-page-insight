/**
 * Single source of truth for API response and payload types.
 * Re-exported by @/lib/api for convenience.
 */

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
  gaps?: CriticalGap[];
  /** Set by frontend when saving to history; not returned by API. */
  jobId?: string;
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

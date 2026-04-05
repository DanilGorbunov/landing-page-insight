import type { AnalysisResult } from "@/types/api";

export type InsightConfidence = "High" | "Medium" | "Low";

/**
 * High = screenshot + substantial analysis text + ≥1 competitor.
 * Medium = any two. Low = one or none.
 */
export function insightConfidenceFromResult(result: AnalysisResult): InsightConfidence {
  const shot = !!result.targetScreenshotUrl;
  const text = !!(
    result.userAnalysis &&
    Object.values(result.userAnalysis).some((v) => typeof v === "string" && v.trim().length > 40)
  );
  const comps = (result.competitors?.length ?? 0) >= 1;
  const n = [shot, text, comps].filter(Boolean).length;
  if (n >= 3) return "High";
  if (n === 2) return "Medium";
  return "Low";
}

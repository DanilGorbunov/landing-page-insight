import type { AnalysisResult } from "@/types/api";
import { getDomain } from "@/lib/utils";

function sameCompetitorSite(a: string, b: string): boolean {
  const da = getDomain(a);
  const db = getDomain(b);
  if (da && db && da === db) return true;
  return a.trim() === b.trim();
}

/** Returns a copy of the report with one competitor removed (by URL or domain). */
export function analysisResultWithoutCompetitor(
  result: AnalysisResult,
  competitorUrl: string
): AnalysisResult {
  const next: AnalysisResult = { ...result };
  next.competitors = (result.competitors ?? []).filter((c) => !sameCompetitorSite(c.url, competitorUrl));

  if (result.performance?.competitors?.length) {
    next.performance = {
      ...result.performance,
      competitors: result.performance.competitors.filter((c) => !sameCompetitorSite(c.url, competitorUrl)),
    };
  }

  if (result.readability?.competitors?.length) {
    next.readability = {
      ...result.readability,
      competitors: result.readability.competitors.filter((c) => !sameCompetitorSite(c.url, competitorUrl)),
    };
  }

  if (result.competitiveEdge?.length) {
    const filtered = result.competitiveEdge.filter((e) => !sameCompetitorSite(e.competitor, competitorUrl));
    next.competitiveEdge = filtered.length > 0 ? filtered : undefined;
  }

  if (result.gaps?.length) {
    const filtered = result.gaps.filter((g) => {
      if (g.competitorUrl && sameCompetitorSite(g.competitorUrl, competitorUrl)) return false;
      if (g.competitor && sameCompetitorSite(g.competitor, competitorUrl)) return false;
      return true;
    });
    next.gaps = filtered.length > 0 ? filtered : undefined;
  }

  return next;
}

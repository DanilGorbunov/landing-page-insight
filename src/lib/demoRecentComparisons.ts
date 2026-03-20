import type { HistoryEntry } from "@/lib/analysisHistory";
import type { AnalysisResult } from "@/lib/api";

const SECTION_TEXT =
  "Sample insight — run your own analysis on the homepage to see a real AI audit with live competitor data.";

function sections(): Record<string, string> {
  return {
    hero: SECTION_TEXT,
    "value proposition": SECTION_TEXT,
    features: SECTION_TEXT,
    "social proof": SECTION_TEXT,
    CTA: SECTION_TEXT,
  };
}

function makeCompetitors(n: number): AnalysisResult["competitors"] {
  return Array.from({ length: n }, (_, i) => ({
    url: `https://example-competitor-${i + 1}.com`,
    analysis: sections(),
    screenshotUrl: null,
  }));
}

function makeDemoEntry(opts: {
  id: string;
  domain: string;
  score: number;
  competitorCount: number;
}): HistoryEntry {
  const result: AnalysisResult = {
    report: `## ${opts.domain}\n\n_This is a sample comparison card._ Use **Analyze** with your URL to generate a real report and competitor benchmarks.`,
    userAnalysis: sections(),
    competitors: makeCompetitors(opts.competitorCount),
    targetScreenshotUrl: null,
    synthesis: { overall_score: opts.score },
    gaps: [],
    jobId: opts.id,
  };
  return {
    id: opts.id,
    domain: opts.domain,
    score: opts.score,
    analyzedAt: new Date().toISOString(),
    expiresAt: 8640000000000000,
    result,
    source: "demo",
  };
}

/** Shown on the home screen when local history is empty and the API has no rows yet. */
export function getDefaultRecentComparisons(): HistoryEntry[] {
  return [
    makeDemoEntry({ id: "demo-apple", domain: "apple.com", score: 5.5, competitorCount: 3 }),
    makeDemoEntry({ id: "demo-apollo", domain: "apollo.io", score: 7.0, competitorCount: 3 }),
    makeDemoEntry({ id: "demo-otto", domain: "otto.de", score: 3.3, competitorCount: 2 }),
  ];
}

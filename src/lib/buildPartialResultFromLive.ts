import type { AnalysisResult, JobLiveState, LiveSectionKey } from "@/types/api";

const SECTION_ORDER = ["hero", "value proposition", "features", "social proof", "CTA"] as const;

function sectionScoresToAnalysisText(scores: Record<LiveSectionKey, number | null>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const key of SECTION_ORDER) {
    const v = scores[key as LiveSectionKey];
    if (v != null) o[key] = `Score: ${v}/10.`;
    else o[key] = "Analyzing…";
  }
  return o;
}

/** Build an AnalysisResult-shaped object from live job state for progressive Compare UI. */
export function buildPartialResultFromLive(
  live: JobLiveState | null,
  userUrl: string,
  jobId: string
): AnalysisResult {
  const emptyUser = Object.fromEntries(SECTION_ORDER.map((k) => [k, "Analyzing…"]));
  if (!live?.sites?.length) {
    return {
      report: "",
      userAnalysis: emptyUser,
      competitors: [],
      targetScreenshotUrl: null,
      synthesis: {},
      gaps: [],
      jobId,
    };
  }
  const userSite = live.sites.find((s) => s.isUser);
  const competitors = live.sites.filter((s) => !s.isUser);
  const ua = userSite ? sectionScoresToAnalysisText(userSite.sectionScores) : emptyUser;
  const synth =
    live.synthesis?.overallScore != null ? { overall_score: live.synthesis.overallScore } : {};
  return {
    report: live.synthesis?.partialReport ?? "",
    userAnalysis: ua,
    competitors: competitors.map((c) => ({
      url: c.url,
      screenshotUrl: c.screenshotUrl,
      analysis: sectionScoresToAnalysisText(c.sectionScores),
    })),
    targetScreenshotUrl: userSite?.screenshotUrl ?? null,
    synthesis: synth,
    gaps: live.synthesis?.gaps?.length ? live.synthesis.gaps : [],
    jobId,
  };
}

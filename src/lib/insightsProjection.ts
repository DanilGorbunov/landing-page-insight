import type { SectionScoreKey } from "@/lib/utils";

/** Mirrors backend synthesis weights for user overall. */
const SECTION_WEIGHTS: Record<SectionScoreKey, number> = {
  hero: 0.25,
  value_prop: 0.2,
  features: 0.1,
  social_proof: 0.2,
  cta: 0.25,
};

/**
 * Weighted overall from five section scores (null sections skipped).
 */
export function weightedOverallFromSections(scores: Record<SectionScoreKey, number | null>): number | null {
  let sum = 0;
  let wSum = 0;
  for (const [k, w] of Object.entries(SECTION_WEIGHTS) as [SectionScoreKey, number][]) {
    const v = scores[k];
    if (v == null || Number.isNaN(v)) continue;
    sum += v * w;
    wSum += w;
  }
  if (wSum === 0) return null;
  return Math.round((sum / wSum) * 10) / 10;
}

export interface RatingProjection {
  current: number;
  days30: number;
  days90: number;
  summary: string;
}

/**
 * Heuristic “what if you ship improvements” curve — demo only, not financial advice.
 */
/**
 * Per-section illustrative score after improvements (same headroom idea as overall forecast).
 * @param factor — 0.35 ≈ short horizon, 0.65 ≈ ~90d (match {@link projectRatings})
 */
export function projectSectionScore(sectionScore: number, factor = 0.65): number {
  const s = Math.min(10, Math.max(0, sectionScore));
  const headroom = 10 - s;
  return Math.min(10, Math.round((s + headroom * factor) * 10) / 10);
}

export function projectRatings(currentOverall: number): RatingProjection {
  const clamped = Math.min(10, Math.max(0, currentOverall));
  const headroom = 10 - clamped;
  const days30 = Math.min(10, Math.round((clamped + headroom * 0.35) * 10) / 10);
  const days90 = Math.min(10, Math.round((clamped + headroom * 0.65) * 10) / 10);
  const summary =
    headroom < 0.5
      ? "You are already near the top of our rubric; focus on micro-conversion tests."
      : `If critical gaps are addressed, typical lift lands around +${(days30 - clamped).toFixed(1)} pts in ~30 days and +${(days90 - clamped).toFixed(1)} pts over ~90 days in comparable cases (illustrative).`;
  return { current: clamped, days30, days90, summary };
}

import type { AnalysisResult } from "@/types/api";
import {
  deriveHeroSubMetrics,
  deriveCopyAnalysis,
  deriveBehavioralUx,
  type SectionOrderKey,
} from "@/lib/compareDecisionMetrics";
import { parseScoreFromReport } from "@/lib/utils";

export interface ScoreBreakdownRow {
  label: string;
  value: number;
}

export interface ScoreBreakdownPayload {
  rows: ScoreBreakdownRow[];
  overall: number | null;
  explanation: string | null;
  hasSubScores: boolean;
}

function specificityExplanation(valueSpecificity: number, heroText: string): string | null {
  if (valueSpecificity >= 6.5) return null;
  if (heroText.length < 40) return "Specificity is low because the visible copy is very short — add measurable outcomes or concrete proof.";
  if (!/\d|%|\$|save|cut|faster|minutes|hours/i.test(heroText)) {
    return "Specificity is low because the headline lacks measurable outcomes and concrete numbers visitors can trust.";
  }
  return "Specificity is low compared to best-in-class — tighten claims with metrics, time saved, or proof points.";
}

/**
 * Build rubric rows for the score methodology popover. Uses derived sub-metrics when section text exists.
 */
export function buildSectionScoreBreakdown(
  sectionKey: SectionOrderKey,
  overall: number | null,
  result: AnalysisResult
): ScoreBreakdownPayload {
  const text = result.userAnalysis?.[sectionKey] ?? "";
  const parsed = parseScoreFromReport(text);
  const ux = result.uxSignals ?? undefined;
  const heroText = result.userAnalysis?.hero ?? "";

  if (sectionKey === "hero") {
    const heroScore = parsed ?? overall;
    const sub = deriveHeroSubMetrics(heroScore, text || heroText, ux);
    const rows: ScoreBreakdownRow[] = [
      { label: "Clarity", value: sub.clarity },
      { label: "Specificity", value: sub.valueSpecificity },
      { label: "Visual strength", value: sub.visualHierarchy },
      { label: "CTA prominence", value: sub.ctaVisibility },
    ];
    return {
      rows,
      overall: overall ?? heroScore,
      explanation: specificityExplanation(sub.valueSpecificity, text || heroText),
      hasSubScores: true,
    };
  }

  const copy = deriveCopyAnalysis(text || heroText);
  const beh = deriveBehavioralUx(ux, overall);
  const base = parsed ?? overall ?? 6;
  const sub = deriveHeroSubMetrics(base, text, ux);

  const rows: ScoreBreakdownRow[] = [
    { label: "Clarity", value: Math.min(10, Math.max(0, copy.clarity + (base - 6) * 0.15)) },
    { label: "Specificity", value: Math.min(10, Math.max(0, copy.specificity + (base - 6) * 0.15)) },
    { label: "Visual strength", value: Math.min(10, Math.max(0, beh.visualHierarchyScore + (base - 6) * 0.1)) },
    { label: "CTA prominence", value: sub.ctaVisibility },
  ];

  return {
    rows: rows.map((r) => ({ ...r, value: Math.round(r.value * 10) / 10 })),
    overall,
    explanation:
      copy.specificity < 6
        ? "Specificity is low because this section reads generic — tie claims to outcomes users care about."
        : null,
    hasSubScores: text.length > 20,
  };
}

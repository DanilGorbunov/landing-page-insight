/**
 * Data for AI annotation dots on Compare screenshots (SIMULATE tab).
 * Uses existing AnalysisResult + SimulateImprovementItem only — no API calls.
 */
import type { AnalysisResult, CriticalGap, UxImprovementHint } from "@/types/api";
import { inferSectionKeyFromGapArea, type SectionOrderKey } from "@/lib/compareDecisionMetrics";
import type { SimulateImprovementItem } from "@/lib/simulateWhatIf";
import { getSimulateOverlayPercentRect, SECTION_ORDER } from "@/lib/simulateWhatIf";

export type SimulateAiLabelRow = {
  id: string;
  sectionKey: SectionOrderKey;
  sectionLabel: string;
  score: number;
  oneLine: string;
  whatISee: string;
  competitorLine: string;
  suggestedCopy: string;
  estAfter: number;
  /** Anchor position (% of screenshot width / height). */
  topPct: number;
  leftPct: number;
};

function matchesUxSection(h: UxImprovementHint, key: SectionOrderKey): boolean {
  const s = h.section.toLowerCase();
  if (key === "hero") return s.includes("hero");
  if (key === "value proposition") return s.includes("value") || s.includes("prop");
  if (key === "features") return s.includes("feature");
  if (key === "social proof") return s.includes("social") || s.includes("proof") || s.includes("testimonial");
  if (key === "CTA") return s.includes("cta") || s.includes("call");
  return false;
}

function gapForSection(gaps: CriticalGap[] | undefined, key: SectionOrderKey): CriticalGap | undefined {
  return gaps?.find((g) => inferSectionKeyFromGapArea(g.area) === key);
}

function copySuggestionForSection(result: AnalysisResult, key: SectionOrderKey): string {
  const labels = [key, key === "value proposition" ? "value" : "", key === "social proof" ? "social" : ""].filter(Boolean);
  for (const cs of result.copySuggestions ?? []) {
    const sec = cs.section.toLowerCase();
    if (labels.some((l) => l && sec.includes(String(l).toLowerCase().slice(0, 6)))) {
      const s = cs.suggestions?.[0]?.trim();
      if (s) return s;
    }
  }
  return "";
}

function buildWhatISee(
  result: AnalysisResult,
  key: SectionOrderKey,
  gap: CriticalGap | undefined,
  ux: UxImprovementHint | undefined,
  fallbackSummary: string
): string {
  if (gap?.problem?.trim()) return gap.problem.trim();
  if (ux?.issue?.trim()) return ux.issue.trim();
  if (ux?.hint?.trim()) return ux.hint.trim();
  return fallbackSummary.slice(0, 400);
}

function buildCompetitorLine(
  result: AnalysisResult,
  gap: CriticalGap | undefined,
  ux: UxImprovementHint | undefined,
  vsDomain: string | null
): string {
  const g = gap?.competitor?.trim() || gap?.competitorAction?.trim() || ux?.reference?.trim() || "";
  if (g) {
    const dom = vsDomain ? ` (${vsDomain})` : "";
    return g.endsWith(".") ? `${g}${dom}` : `${g}${dom}.`;
  }
  if (vsDomain) return `Compare with how ${vsDomain} handles this section above the fold.`;
  return "";
}

/**
 * Dot anchor within section zone (full scroll height): corners / edges per spec.
 */
export function getDotPositionPercent(
  sectionKey: SectionOrderKey,
  ctaAnnotation: { top: number; height: number } | null
): { topPct: number; leftPct: number } {
  const zone = getSimulateOverlayPercentRect(sectionKey, ctaAnnotation ? { top: ctaAnnotation.top, height: ctaAnnotation.height } : null);
  const t0 = zone.top;
  const h = Math.max(zone.height, 4);
  switch (sectionKey) {
    case "hero":
      return { topPct: t0 + h * 0.1, leftPct: 88 };
    case "value proposition":
      return { topPct: t0 + h * 0.1, leftPct: 10 };
    case "features":
      return { topPct: t0 + h * 0.12, leftPct: 88 };
    case "social proof":
      return { topPct: t0 + h * 0.38, leftPct: 10 };
    case "CTA":
      return { topPct: t0 + h * 0.42, leftPct: 90 };
    default:
      return { topPct: t0, leftPct: 50 };
  }
}

const MAX_LABELS = 8;

/**
 * One dot per core section (5) plus optional UX hints up to 8 total — all scores (red / amber / green).
 */
export function buildSimulateAiLabelRows(
  result: AnalysisResult,
  simulateItems: SimulateImprovementItem[],
  args: {
    scoresBySection: Record<string, number | null>;
    summariesBySection: Record<string, string>;
    vsDomain: string | null;
    ctaAnnotation: { top: number; height: number } | null;
  }
): SimulateAiLabelRow[] {
  const byKey = new Map<SectionOrderKey, SimulateImprovementItem>();
  for (const it of simulateItems) {
    const prev = byKey.get(it.sectionKey);
    if (!prev || it.points > prev.points) byKey.set(it.sectionKey, it);
  }

  const uxHints = result.uxHints ?? [];
  const rows: SimulateAiLabelRow[] = [];

  for (const sectionKey of SECTION_ORDER) {
    const item = byKey.get(sectionKey);
    if (!item) continue; // requires fillMissingSectionSimulateItems upstream
    const raw = args.scoresBySection[sectionKey];
    const sc = raw != null ? raw : 7;
    const gap = gapForSection(result.gaps, sectionKey);
    const ux = uxHints.find((h) => matchesUxSection(h, sectionKey));
    const summary = args.summariesBySection[sectionKey] ?? "";
    const whatISee = buildWhatISee(result, sectionKey, gap, ux, summary);
    const competitorLine = buildCompetitorLine(result, gap, ux, args.vsDomain);
    let suggested = copySuggestionForSection(result, sectionKey);
    if (!suggested && gap?.recommendation?.trim()) {
      const r = gap.recommendation.trim();
      suggested = r.length > 220 ? `${r.slice(0, 217)}…` : r;
    }
    if (!suggested && ux?.hint?.trim()) suggested = ux.hint.trim();

    const estAfter = Math.round(Math.min(10, sc + item.points) * 10) / 10;
    const oneLine =
      summary.length > 56 ? `${summary.replace(/\s+/g, " ").trim().slice(0, 53)}…` : summary.replace(/\s+/g, " ").trim() || "Section analysis";

    const { topPct, leftPct } = getDotPositionPercent(sectionKey, args.ctaAnnotation);

    rows.push({
      id: item.id,
      sectionKey,
      sectionLabel: item.sectionLabel,
      score: sc,
      oneLine,
      whatISee,
      competitorLine,
      suggestedCopy: suggested,
      estAfter,
      topPct,
      leftPct,
    });
  }

  return rows.slice(0, MAX_LABELS);
}

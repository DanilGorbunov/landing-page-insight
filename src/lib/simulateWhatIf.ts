/**
 * What-if Simulator: checklist items + overlay zones for Compare screenshots.
 */
import type { AnalysisResult, CriticalGap } from "@/types/api";
import type { GapRankItem } from "@/lib/compareDecisionMetrics";
import { inferSectionKeyFromGapArea, type SectionOrderKey } from "@/lib/compareDecisionMetrics";
import { parseScoreFromReport } from "@/lib/utils";

export const SECTION_ORDER: SectionOrderKey[] = ["hero", "value proposition", "features", "social proof", "CTA"];

const GAP_RANK_LABEL_TO_KEY: Record<string, SectionOrderKey> = {
  "Hero & messaging": "hero",
  "Value clarity": "value proposition",
  Features: "features",
  "Social proof": "social proof",
  "CTA strength": "CTA",
};

export type SimulateEffort = "Low" | "Med" | "High";

export type SimulateImprovementItem = {
  id: string;
  sectionKey: SectionOrderKey;
  /** Short label for checklist row */
  sectionLabel: string;
  /** One-line fix */
  oneLineFix: string;
  /** Estimated overall score lift if applied (0–10 scale), in points */
  points: number;
  effort: SimulateEffort;
};

const SECTION_LABEL: Record<SectionOrderKey, string> = {
  hero: "Hero",
  "value proposition": "Value Prop",
  features: "Features",
  "social proof": "Social Proof",
  CTA: "CTA",
};

/** Vertical bands for green “add this” overlays (% of screenshot height). CTA prefers annotation bounds when provided. */
export function getSimulateOverlayPercentRect(
  sectionKey: SectionOrderKey,
  ctaAnnotation?: { top: number; height: number } | null
): { top: number; height: number } {
  if (sectionKey === "CTA" && ctaAnnotation) {
    return { top: ctaAnnotation.top, height: Math.max(8, ctaAnnotation.height) };
  }
  switch (sectionKey) {
    case "hero":
      return { top: 0, height: 25 };
    case "value proposition":
      return { top: 25, height: 20 };
    case "features":
      return { top: 40, height: 25 };
    case "social proof":
      return { top: 80, height: 20 };
    case "CTA":
      return { top: 70, height: 20 };
    default:
      return { top: 0, height: 20 };
  }
}

function clampPoints(n: number): number {
  return Math.round(Math.min(2.5, Math.max(0.2, n)) * 10) / 10;
}

function effortFromGap(g: CriticalGap, key: SectionOrderKey): SimulateEffort {
  if (g.priority === "P2") return "Low";
  if (key === "hero" || key === "CTA") return "High";
  if (key === "value proposition") return "Med";
  return "Med";
}

function pointsFromGap(g: CriticalGap, gapVsBest: number | null): number {
  const base = g.priority === "P1" ? 1.05 : 0.5;
  const conf = g.confidence === "High" ? 0.4 : g.confidence === "Medium" ? 0.2 : 0.05;
  const gapBoost =
    gapVsBest != null && gapVsBest > 0 ? Math.min(1.1, gapVsBest * 0.28) : 0.25;
  return clampPoints(base + conf + gapBoost);
}

function rankLabelToKey(label: string): SectionOrderKey | null {
  return GAP_RANK_LABEL_TO_KEY[label] ?? null;
}

function syntheticFixFromGapRank(gi: GapRankItem): string {
  const tail = gi.gapVsBest >= 0.5 ? `Lift toward ${gi.bestScore.toFixed(1)}/10 benchmark.` : "Tighten proof and specificity.";
  return `Close the gap on ${gi.label.toLowerCase()} — ${tail}`;
}

/**
 * Build simulator rows from gaps + section-level competitive gaps. Sorted by impact (points) descending.
 */
export function buildSimulateItems(result: AnalysisResult, gapItems: GapRankItem[]): SimulateImprovementItem[] {
  const bySection = new Map<SectionOrderKey, SimulateImprovementItem>();

  const gapVsByKey = (key: SectionOrderKey): number | null => {
    const gi = gapItems.find((g) => rankLabelToKey(g.label) === key);
    return gi ? gi.gapVsBest : null;
  };

  for (const g of result.gaps ?? []) {
    const key = inferSectionKeyFromGapArea(g.area) ?? "hero";
    const fix = (g.recommendation?.trim() || g.problem?.trim() || "Address this gap.").replace(/\s+/g, " ");
    const oneLine = fix.length > 140 ? `${fix.slice(0, 137)}…` : fix;
    const pts = pointsFromGap(g, gapVsByKey(key));
    const candidate: SimulateImprovementItem = {
      id: `gap-${key}-${g.priority}-${hashStr(g.area + g.problem).slice(0, 8)}`,
      sectionKey: key,
      sectionLabel: SECTION_LABEL[key],
      oneLineFix: oneLine,
      points: pts,
      effort: effortFromGap(g, key),
    };
    const prev = bySection.get(key);
    if (!prev || candidate.points > prev.points) bySection.set(key, candidate);
  }

  for (const gi of gapItems) {
    const key = rankLabelToKey(gi.label);
    if (!key || bySection.has(key)) continue;
    const pts = clampPoints(0.45 + gi.gapVsBest * 0.42);
    bySection.set(key, {
      id: `rank-${key}-${hashStr(gi.label).slice(0, 8)}`,
      sectionKey: key,
      sectionLabel: SECTION_LABEL[key],
      oneLineFix: syntheticFixFromGapRank(gi),
      points: pts,
      effort: gi.gapVsBest >= 1.2 ? "High" : gi.gapVsBest >= 0.5 ? "Med" : "Low",
    });
  }

  for (const key of SECTION_ORDER) {
    if (bySection.has(key)) continue;
    const text = result.userAnalysis?.[key] ?? "";
    const scoreMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    const approx = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    if (approx != null && approx < 6.5) {
      bySection.set(key, {
        id: `section-${key}-low`,
        sectionKey: key,
        sectionLabel: SECTION_LABEL[key],
        oneLineFix: `Strengthen ${SECTION_LABEL[key].toLowerCase()} — score ${approx.toFixed(1)}/10 vs benchmark.`,
        points: clampPoints(1.2 + (6.5 - approx) * 0.15),
        effort: key === "hero" || key === "CTA" ? "High" : "Med",
      });
    }
  }

  const list = [...bySection.values()].sort((a, b) => b.points - a.points);
  return list.length > 0
    ? list
    : [
        {
          id: "fallback-hero",
          sectionKey: "hero",
          sectionLabel: "Hero",
          oneLineFix: "Sharpen headline and primary promise above the fold.",
          points: 1.0,
          effort: "Med",
        },
      ];
}

/**
 * Ensures each core section has a simulator row so AI dots can toggle “Add to plan” for every zone (incl. strong scores).
 */
export function fillMissingSectionSimulateItems(items: SimulateImprovementItem[], result: AnalysisResult): SimulateImprovementItem[] {
  const seen = new Set(items.map((i) => i.sectionKey));
  const extra: SimulateImprovementItem[] = [];
  for (const key of SECTION_ORDER) {
    if (seen.has(key)) continue;
    const raw = result.userAnalysis?.[key] ?? "";
    const approx = parseScoreFromReport(raw);
    const strong = approx != null && approx >= 8;
    extra.push({
      id: `maintain-${key}-${hashStr(key + raw).slice(0, 8)}`,
      sectionKey: key,
      sectionLabel: SECTION_LABEL[key],
      oneLineFix: strong
        ? `Keep ${SECTION_LABEL[key]} performing — benchmark-aligned.`
        : `Tune ${SECTION_LABEL[key]} vs competitors — clarity and proof.`,
      points: strong ? 0.15 : approx != null && approx < 6 ? 0.9 : 0.45,
      effort: key === "hero" || key === "CTA" ? "Med" : "Low",
    });
    seen.add(key);
  }
  return [...items, ...extra].sort((a, b) => b.points - a.points);
}

function hashStr(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h).toString(36);
}

/** Diminishing returns on stacked improvements (overlap). Order = checklist order (impact-sorted list). */
export function diminishingMultiplier(index: number): number {
  if (index <= 0) return 1;
  if (index === 1) return 0.85;
  if (index === 2) return 0.7;
  return 0.5;
}

/** Raw sum of stated points (no diminishing) — for reference only. */
export function sumCheckedPoints(items: SimulateImprovementItem[], checked: Record<string, boolean>): number {
  let t = 0;
  for (const it of items) {
    if (checked[it.id]) t += it.points;
  }
  return Math.round(t * 10) / 10;
}

/** Effective gain with diminishing returns; preserves `items` order (first checked row = 100%). */
export function sumCheckedPointsWithDiminishing(items: SimulateImprovementItem[], checked: Record<string, boolean>): number {
  const checkedInOrder = items.filter((it) => checked[it.id]);
  let t = 0;
  checkedInOrder.forEach((it, i) => {
    t += it.points * diminishingMultiplier(i);
  });
  return Math.round(t * 10) / 10;
}

export function projectOverallScore(base: number | null, gain: number): number {
  const b = base ?? 5;
  return Math.round(Math.min(10, b + gain) * 10) / 10;
}

/**
 * Hard ceiling: never above best competitor + 1.0, and never above 10/10 (full rubric).
 * When there are no competitors, the rubric max (10) applies.
 */
export function applyProjectedCeiling(
  rawProjected: number,
  competitorScores: number[]
): { projected: number; wasCapped: boolean } {
  const comps = competitorScores.filter((n): n is number => n != null && !Number.isNaN(n));
  const topComp = comps.length > 0 ? Math.max(...comps) : null;
  const ceiling = topComp != null ? Math.min(topComp + 1.0, 10) : 10;
  const projected = Math.round(Math.min(rawProjected, ceiling) * 10) / 10;
  const wasCapped = projected + 1e-9 < rawProjected;
  return { projected, wasCapped };
}

export function computeSimulateProjection(
  base: number | null,
  items: SimulateImprovementItem[],
  checked: Record<string, boolean>,
  competitorScores: number[]
): {
  projected: number;
  /** Sum of stated × diminishing (before 10 / ceiling caps). */
  diminishingGain: number;
  wasCapped: boolean;
  /** Actual lift shown as +X (after all caps). */
  netLift: number;
} {
  const b = base ?? 5;
  const diminishingGain = sumCheckedPointsWithDiminishing(items, checked);
  const rawProjected = projectOverallScore(base, diminishingGain);
  const { projected, wasCapped } = applyProjectedCeiling(rawProjected, competitorScores);
  const netLift = Math.round((projected - b) * 10) / 10;
  return { projected, diminishingGain, wasCapped, netLift };
}

/** Rank among you + competitors (higher score is better). `isTop` = no competitor strictly above you. */
export function simulateRankAfterScore(
  projectedYou: number,
  competitorScores: number[]
): { rank: number; total: number; isTop: boolean } {
  const comps = competitorScores.filter((n): n is number => n != null && !Number.isNaN(n));
  const all = [projectedYou, ...comps];
  const strictlyGreater = all.filter((s) => s > projectedYou + 1e-6).length;
  const rank = strictlyGreater + 1;
  return { rank, total: all.length, isTop: strictlyGreater === 0 };
}

/** Low-effort rows: diminishing returns in list order among Low items only; same ceiling as main simulator. */
export function quickWinsSummary(
  items: SimulateImprovementItem[],
  base: number | null,
  competitorScores: number[]
): { lowCount: number; lowSum: number; rankLine: string } {
  const lows = items.filter((i) => i.effort === "Low");
  let lowSumDim = 0;
  lows.forEach((it, i) => {
    lowSumDim += it.points * diminishingMultiplier(i);
  });
  lowSumDim = Math.round(lowSumDim * 10) / 10;
  const rawProjected = projectOverallScore(base, lowSumDim);
  const { projected } = applyProjectedCeiling(rawProjected, competitorScores);
  const { rank, isTop } = simulateRankAfterScore(projected, competitorScores);
  const net = Math.round((projected - (base ?? 5)) * 10) / 10;
  const rankLine =
    lows.length === 0
      ? "No low-effort items in this list — toggle Med/High fixes to preview impact."
      : `Low effort fixes: ${lows.length} item${lows.length === 1 ? "" : "s"} → ~+${net.toFixed(1)} pts → Rank #${rank}${isTop ? " 🏆" : ""}`;
  return { lowCount: lows.length, lowSum: lowSumDim, rankLine };
}

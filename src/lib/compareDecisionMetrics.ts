/**
 * Derives "decision dashboard" metrics from existing AnalysisResult fields.
 * When the API does not emit sub-scores, we deterministically spread from section text + UX signals.
 */
import type { AnalysisResult, JobLiveState, UxSignals } from "@/types/api";
import { buildPartialResultFromLive } from "@/lib/buildPartialResultFromLive";
import { getDomain, parseScoreFromReport, ensureScore } from "@/lib/utils";

const SECTION_ORDER = ["hero", "value proposition", "features", "social proof", "CTA"] as const;
export type SectionOrderKey = (typeof SECTION_ORDER)[number];

/** Map a gap `area` string to analysis section keys for copy/score lookups. */
export function inferSectionKeyFromGapArea(area: string): SectionOrderKey | null {
  const h = area.toLowerCase();
  if (h.includes("hero") || h.includes("headline") || h.includes("above the fold")) return "hero";
  if (h.includes("value") || h.includes("proposition")) return "value proposition";
  if (h.includes("feature")) return "features";
  if (h.includes("social") || h.includes("proof") || h.includes("testimonial")) return "social proof";
  if (h.includes("cta") || h.includes("call to action")) return "CTA";
  return null;
}

export interface HeroSubMetrics {
  clarity: number;
  valueSpecificity: number;
  emotionalHook: number;
  visualHierarchy: number;
  ctaVisibility: number;
}

export interface ConversionLayer {
  risk: "LOW" | "MEDIUM" | "HIGH";
  lossLowPct: number;
  lossHighPct: number;
  mainIssue: string;
  frictionScore: number;
  cognitiveLoad: "Low" | "Medium" | "High";
}

export interface BehavioralUx {
  attentionFlow: string;
  leadsToCta: "Strong" | "Mixed" | "Weak";
  visualHierarchyScore: number;
  scanability: number;
  informationDensity: number;
}

export interface CopyAnalysisMetrics {
  clarity: number;
  specificity: number;
  emotionalLanguage: number;
  powerWordHits: number;
  lengthEfficiency: number;
}

export interface GapRankItem {
  label: string;
  gapVsBest: number;
  userScore: number;
  bestScore: number;
}

export interface CompetitorWinNarrative {
  competitorLabel: string;
  winsBecause: string[];
  youLoseBecause: string[];
}

function clamp10(n: number): number {
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function jitter(seed: number, i: number, spread = 2.5): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * spread;
}

export function deriveHeroSubMetrics(
  heroScore: number | null,
  heroText: string,
  ux: UxSignals | null | undefined
): HeroSubMetrics {
  const base = heroScore ?? 5;
  const seed = hashSeed(heroText.slice(0, 400) || "hero");

  let vhAdj = 0;
  if (ux?.visualHierarchy === "strong") vhAdj = 1.2;
  else if (ux?.visualHierarchy === "moderate") vhAdj = 0.3;
  else if (ux?.visualHierarchy === "weak") vhAdj = -1.4;

  let ctaAdj = 0;
  if (ux?.ctaProminence === "dominant") ctaAdj = 1.5;
  else if (ux?.ctaProminence === "visible") ctaAdj = 0.2;
  else if (ux?.ctaProminence === "buried") ctaAdj = -1.8;

  const clarity = clamp10(base + jitter(seed, 1) * 0.8 + (heroText.length > 80 ? 0.4 : -0.3));
  const valueSpecificity = clamp10(base + jitter(seed, 2) - (/\$|€|£|\d+%|free|save/i.test(heroText) ? -0.5 : 0.4));
  const emotionalHook = clamp10(base + jitter(seed, 3) - (!/!|you|your|love|fast|today/i.test(heroText) ? 0.5 : -0.3));
  const visualHierarchy = clamp10(base + jitter(seed, 4) * 0.6 + vhAdj);
  const ctaVisibility = clamp10(base + jitter(seed, 5) * 0.6 + ctaAdj);

  return {
    clarity,
    valueSpecificity,
    emotionalHook,
    visualHierarchy,
    ctaVisibility,
  };
}

export function deriveConversionLayer(
  overall: number | null,
  gaps: AnalysisResult["gaps"],
  heroText: string
): ConversionLayer {
  const o = overall ?? 5;
  const lossLow = Math.max(0, Math.round((10 - o) * 1.1));
  const lossHigh = Math.max(lossLow, Math.round((10 - o) * 1.9));
  const risk: ConversionLayer["risk"] = o >= 7.5 ? "LOW" : o >= 5.5 ? "MEDIUM" : "HIGH";
  const p1 = gaps?.find((g) => g.priority === "P1");
  const mainIssue = p1?.problem ?? (heroText.length < 40 ? "Limited visible value messaging in the hero." : "Value proposition could be clearer above the fold.");

  const frictionScore = clamp10(10 - o + jitter(hashSeed(heroText), 9, 1.2));

  let cognitiveLoad: ConversionLayer["cognitiveLoad"] = "Medium";
  if (o >= 7 && frictionScore <= 4) cognitiveLoad = "Low";
  else if (o < 5 || frictionScore >= 7.5) cognitiveLoad = "High";

  return {
    risk,
    lossLowPct: lossLow,
    lossHighPct: lossHigh,
    mainIssue,
    frictionScore,
    cognitiveLoad,
  };
}

export function deriveBehavioralUx(ux: UxSignals | null | undefined, overall: number | null): BehavioralUx {
  const o = overall ?? 5;
  const seed = hashSeed(JSON.stringify(ux ?? {}));

  let leads: BehavioralUx["leadsToCta"] = "Mixed";
  if (ux?.ctaProminence === "dominant" && ux?.visualHierarchy !== "weak") leads = "Strong";
  else if (ux?.ctaProminence === "buried" || ux?.visualHierarchy === "weak") leads = "Weak";

  const scan =
    ux?.whitespaceBalance === "spacious" ? 8 + jitter(seed, 10, 0.8) : ux?.whitespaceBalance === "cramped" ? 4 + jitter(seed, 10, 0.8) : 6 + jitter(seed, 10, 0.8);

  const density =
    ux?.whitespaceBalance === "cramped" ? 8.5 + jitter(seed, 11, 0.5) : ux?.whitespaceBalance === "spacious" ? 3 + jitter(seed, 11, 0.5) : 5.5 + jitter(seed, 11, 0.5);

  let vh = 6 + jitter(seed, 12, 1);
  if (ux?.visualHierarchy === "strong") vh += 2;
  else if (ux?.visualHierarchy === "weak") vh -= 2;

  const attentionFlow =
    leads === "Strong"
      ? "Eye path moves headline → supporting line → primary CTA with strong contrast."
      : leads === "Weak"
        ? "Multiple competing focal points; CTA competes with navigation and promos."
        : "Headline holds attention; secondary elements split focus before the CTA.";

  return {
    attentionFlow,
    leadsToCta: leads,
    visualHierarchyScore: clamp10(vh),
    scanability: clamp10(scan),
    informationDensity: clamp10(density),
  };
}

const POWER_WORDS = new Set(
  "free save now instant today guarantee proven trusted millions fast easy new limited hurry exclusive bonus unlock join start".split(" ")
);

export function deriveCopyAnalysis(heroText: string): CopyAnalysisMetrics {
  const words = heroText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const hits = words.filter((w) => POWER_WORDS.has(w)).length;
  const len = heroText.length;
  const clarity = clamp10(6 + (len > 60 && len < 400 ? 1.5 : -1) + jitter(hashSeed(heroText), 20, 1));
  const specificity = clamp10(5 + (/\$|\d+%|\d+\s*(day|hour|min)/i.test(heroText) ? 2 : -0.5) + jitter(hashSeed(heroText), 21, 1));
  const emotionalLanguage = clamp10(5 + (/you|your|love|feel|happy|excited/i.test(heroText) ? 1.2 : -0.3) + jitter(hashSeed(heroText), 22, 1));
  const lengthEfficiency = clamp10(len > 20 && len < 350 ? 7.5 : len >= 500 ? 4 : 6);

  return {
    clarity,
    specificity,
    emotionalLanguage,
    powerWordHits: hits,
    lengthEfficiency,
  };
}

export function rankSites(
  scores: Array<{ label: string; score: number | null }>,
  userLabel = "You"
): { rank: number; total: number } | null {
  const valid = scores.filter((s): s is { label: string; score: number } => s.score != null);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex((s) => s.label === userLabel);
  const rank = idx >= 0 ? idx + 1 : sorted.length;
  return { rank, total: sorted.length };
}

/** Biggest gaps: user vs best competitor per section (positive gap = competitor ahead). */
export function biggestGaps(
  userBySection: Record<SectionOrderKey, number | null>,
  competitors: Array<{ label: string; bySection: Record<SectionOrderKey, number | null> }>
): GapRankItem[] {
  const labels: Record<SectionOrderKey, string> = {
    hero: "Hero & messaging",
    "value proposition": "Value clarity",
    features: "Features",
    "social proof": "Social proof",
    CTA: "CTA strength",
  };

  const items: GapRankItem[] = [];

  for (const key of SECTION_ORDER) {
    const u = userBySection[key];
    if (u == null) continue;
    let best = u;
    for (const c of competitors) {
      const sc = c.bySection[key];
      if (sc != null) best = Math.max(best, sc);
    }
    const gapVsBest = Math.round((best - u) * 10) / 10;
    if (gapVsBest > 0.05) {
      items.push({ label: labels[key], gapVsBest, userScore: u, bestScore: best });
    }
  }

  return items.sort((a, b) => b.gapVsBest - a.gapVsBest).slice(0, 5);
}

export function buildCompetitorWinNarrative(
  result: AnalysisResult,
  primaryCompetitorDomain: string
): CompetitorWinNarrative | null {
  const hint = primaryCompetitorDomain.split(".")[0]?.toLowerCase() ?? "";
  const entry =
    result.competitiveEdge?.find((e) => e.competitor.toLowerCase().includes(hint)) ?? result.competitiveEdge?.[0];
  if (!entry?.advantages?.length) return null;

  const adv = entry.advantages[0];
  const winsBecause = [
    adv.theirApproach,
    ...entry.advantages.slice(1, 3).map((a) => a.theirApproach),
  ].filter(Boolean);

  const youLoseBecause = [adv.yourWeakness, ...entry.advantages.slice(1, 2).map((a) => a.yourWeakness)].filter(Boolean);

  return {
    competitorLabel: entry.competitor,
    winsBecause: winsBecause.slice(0, 3),
    youLoseBecause: youLoseBecause.slice(0, 3),
  };
}

export function dataCoveragePct(screenshotUrl: string | null, analysisText: string): number {
  let p = 40;
  if (screenshotUrl) p += 35;
  if (analysisText.length > 120) p += 15;
  if (analysisText.length > 400) p += 10;
  return Math.min(100, p);
}

export function confidenceExplanation(confidence: "High" | "Medium" | "Low" | undefined): string {
  switch (confidence) {
    case "High":
      return "Multiple aligned signals (screenshot + section text + competitive context).";
    case "Medium":
      return "Inferred from visible UI and model text; validate with analytics.";
    default:
      return "Partial view — scores are directional until you add traffic and test data.";
  }
}

export function sectionImpact(score: number | null): "Critical" | "High" | "Medium" | "Low" {
  if (score == null) return "Medium";
  if (score < 3.5) return "Critical";
  if (score < 5.5) return "High";
  if (score < 7) return "Medium";
  return "Low";
}

export function abVariantsFromResult(result: AnalysisResult): string[] {
  const fromCopy = (result.copySuggestions ?? []).flatMap((c) => c.suggestions ?? []).slice(0, 2);
  const gaps = result.gaps?.[0];
  const synthetic: string[] = [];
  if (fromCopy.length < 3) {
    synthetic.push("Everything you need — delivered fast, with clear pricing.");
    synthetic.push("Millions of products under $10 — delivered tomorrow.");
  }
  if (gaps && fromCopy.length + synthetic.length < 3 && gaps.recommendation) {
    const r = gaps.recommendation;
    synthetic.push(`Lead with "${gaps.area}": ${r.slice(0, 80)}${r.length > 80 ? "…" : ""}`);
  }
  return [...fromCopy, ...synthetic].filter(Boolean).slice(0, 3);
}

export function stealTopThree(result: AnalysisResult, competitorDomain: string): string[] {
  const hint = competitorDomain.split(".")[0]?.toLowerCase() ?? "";
  const entry = result.competitiveEdge?.find((e) => e.competitor.toLowerCase().includes(hint)) ?? result.competitiveEdge?.[0];
  const items = entry?.advantages?.map((a) => a.stealThis) ?? [];
  if (items.length >= 3) return items.slice(0, 3);
  const fallback = (result.competitiveEdge ?? []).flatMap((e) => e.advantages.map((a) => a.stealThis));
  return [...items, ...fallback].filter(Boolean).slice(0, 3);
}

/** Rank / overall / losing — same logic as Compare screenshot strip (for dashboard header). */
export interface CompareHeaderStats {
  userScore: number | null;
  rank: number | null;
  totalRanked: number;
  losing: boolean;
}

export function compareDecisionHeaderStats(result: AnalysisResult): CompareHeaderStats {
  const ua = result.userAnalysis ?? {};
  const us = SECTION_ORDER.map((k) => parseScoreFromReport(ua[k])).filter((n): n is number => n != null);
  const uavg = us.length ? Math.round((us.reduce((a, b) => a + b, 0) / us.length) * 10) / 10 : null;
  const userOverall: number | null =
    result.synthesis?.overall_score != null ? ensureScore(result.synthesis.overall_score) : uavg;

  const siteScores: { label: string; score: number | null }[] = [{ label: "You", score: userOverall }];
  for (const comp of result.competitors ?? []) {
    const ca = comp.analysis ?? {};
    const cs = SECTION_ORDER.map((k) => parseScoreFromReport(ca[k])).filter((n): n is number => n != null);
    const cavg = cs.length ? Math.round((cs.reduce((a, b) => a + b, 0) / cs.length) * 10) / 10 : null;
    siteScores.push({ label: getDomain(comp.url), score: cavg });
  }

  const rankInfo = rankSites(siteScores, "You");
  const losing = rankInfo != null && rankInfo.rank > 1 && siteScores.length > 1;

  return {
    userScore: userOverall,
    rank: rankInfo?.rank ?? null,
    totalRanked: rankInfo?.total ?? 0,
    losing,
  };
}

/** Same scoring as Compare screenshot strip — for dashboard header site tabs. */
export interface CompareSiteTab {
  url: string;
  domain: string;
  isUser: boolean;
  overallScore: number | null;
  /** Competitor slot not yet resolved (analyzing flow). */
  loading?: boolean;
}

export function compareSitesList(result: AnalysisResult, userUrl: string): CompareSiteTab[] {
  const list: CompareSiteTab[] = [];
  const ua = result.userAnalysis ?? {};
  const us = SECTION_ORDER.map((k) => parseScoreFromReport(ua[k])).filter((n): n is number => n != null);
  const uavg = us.length ? Math.round((us.reduce((a, b) => a + b, 0) / us.length) * 10) / 10 : null;
  /** Match `ScreenshotCompare` site strip so header tabs and Δ match the canvas. */
  const userOverall: number | null = result.synthesis?.overall_score ?? uavg;
  list.push({ url: userUrl, domain: getDomain(userUrl), isUser: true, overallScore: userOverall });
  for (const comp of result.competitors ?? []) {
    const ca = comp.analysis ?? {};
    const cs = SECTION_ORDER.map((k) => parseScoreFromReport(ca[k])).filter((n): n is number => n != null);
    const cavg = cs.length ? Math.round((cs.reduce((a, b) => a + b, 0) / cs.length) * 10) / 10 : null;
    list.push({ url: comp.url, domain: getDomain(comp.url), isUser: false, overallScore: cavg });
  }
  return list;
}

/** Up to 3 competitor slots with “Finding…” placeholders while the job runs. */
export function compareSitesWhileAnalyzing(
  live: JobLiveState | null,
  userUrl: string,
  jobId: string
): CompareSiteTab[] {
  const partial = buildPartialResultFromLive(live, userUrl, jobId);
  const tabs = compareSitesList(partial, userUrl);
  const nComp = tabs.filter((t) => !t.isUser).length;
  const out: CompareSiteTab[] = [...tabs];
  for (let i = nComp; i < 3; i++) {
    out.push({
      url: `__pending__:${i}`,
      domain: "Finding…",
      isUser: false,
      overallScore: null,
      loading: true,
    });
  }
  return out;
}

/** Minor / Moderate / Severe from estimated loss band. */
export function businessImpactTier(conversion: ConversionLayer): "Minor" | "Moderate" | "Severe" {
  const h = conversion.lossHighPct;
  if (h <= 6) return "Minor";
  if (h <= 14) return "Moderate";
  return "Severe";
}

/** One line explaining rank vs risk vs $ band (header). */
export function headerUnifiedLine(losing: boolean, conversion: ConversionLayer): string {
  const tier = businessImpactTier(conversion);
  if (losing && conversion.risk === "LOW") {
    return `Behind on rank — ${tier} revenue drag (−${conversion.lossLowPct}–${conversion.lossHighPct}%), but conversion risk is ${conversion.risk.toLowerCase()} for now.`;
  }
  if (losing) {
    return `Behind competitors — ${tier} estimated impact (−${conversion.lossLowPct}–${conversion.lossHighPct}%), conversion risk ${conversion.risk}.`;
  }
  return `Competitive position OK — ${tier} drag if issues remain (−${conversion.lossLowPct}–${conversion.lossHighPct}%).`;
}

export function conversionRiskWhyBut(
  conversion: ConversionLayer,
  result: AnalysisResult
): { why: string[]; but: string } {
  const why: string[] = [];
  if (conversion.risk === "LOW") {
    why.push("Audit suggests CTAs and trust are not the primary bottleneck.");
    if ((result.ctaTrust?.ctas?.length ?? 0) > 0) why.push("At least one primary CTA is identified.");
  } else if (conversion.risk === "MEDIUM") {
    why.push("Several sections drag the score; friction may be costing conversions.");
  } else {
    why.push("High-friction pattern — visitors likely bounce before acting.");
  }
  const but =
    conversion.mainIssue.length > 100 ? `${conversion.mainIssue.slice(0, 97)}…` : conversion.mainIssue;
  return { why, but };
}

/** Clean model text for tooltips and the right-hand detail panel. */
export function annotationDisplayBody(text: string): string {
  if (!text.trim()) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^\s*[-•]\s*/gm, "• ")
    .replace(/\s+/g, " ")
    .trim();
}

export function annotationPreview(text: string, maxLen: number): string {
  const b = annotationDisplayBody(text);
  if (b.length <= maxLen) return b;
  return `${b.slice(0, maxLen).trim()}…`;
}

/** Short sentences for pin bullets and “watch” lists. */
export function annotationBulletPoints(text: string, maxBullets: number): string[] {
  const b = annotationDisplayBody(text);
  const parts = b.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.replace(/^•\s*/, "").trim();
    if (t.length > 8) out.push(t);
    if (out.length >= maxBullets) break;
  }
  if (out.length === 0 && b.length > 0) out.push(b.slice(0, Math.min(220, b.length)));
  return out.slice(0, maxBullets);
}

/**
 * Section deep-dive body below "Watch" bullets: skip the duplicated "What works" prose.
 * Returns text from the first improvement-focused heading onward, or empty if there is nothing left.
 */
export function annotationSectionDeepDiveBodyBelowWatch(fullText: string, watchPoints: string[]): string {
  const base = annotationDisplayBody(fullText);
  if (!base) return "";
  if (watchPoints.length === 0) return base;

  const splitRe =
    /\b(what\s+to\s+improve|what\s+to\s+fix|improvements?\s*:|gaps?\s*:|issues?\s*:|weaknesses?\s*:|risks?\s*:|recommendations?\s*:)/i;
  const m = base.match(splitRe);
  if (m != null && m.index != null && m.index >= 0) {
    return base.slice(m.index).trim();
  }

  // No second section — bullets already summarize the opening; avoid repeating the same block.
  return "";
}

/** Always-on insight above the fold (Problem → 3-second result). */
export function heroThreeSecondInsight(heroScore: number | null, mainIssue: string): { problem: string; result: string } {
  if (heroScore != null && heroScore < 6) {
    return {
      problem: "Hero does not communicate the offer clearly enough.",
      result: "Visitors may not understand what you sell within the first 3 seconds.",
    };
  }
  const first = mainIssue.split(/[.!?]/)[0]?.trim() || mainIssue;
  return {
    problem: first.length > 0 ? first : "Value proposition could be sharper above the fold.",
    result: "First-time visitors may hesitate before scrolling or clicking.",
  };
}

export type ActionPlanRow = { title: string; impact: "HIGH" | "MEDIUM" | "LOW"; source: string };

/** Top 3 prioritized actions: action plan first, then gaps. */
export function topActionPlanRows(result: AnalysisResult): ActionPlanRow[] {
  const out: ActionPlanRow[] = [];
  for (const a of result.actionPlan ?? []) {
    if (out.length >= 3) break;
    out.push({
      title: a.action,
      impact: a.impact === "High" ? "HIGH" : a.impact === "Medium" ? "MEDIUM" : "LOW",
      source: "plan",
    });
  }
  for (const g of result.gaps ?? []) {
    if (out.length >= 3) break;
    const title = (g.recommendation?.trim() || g.problem)?.trim() || g.area;
    if (!title || out.some((o) => o.title === title)) continue;
    out.push({
      title,
      impact: g.priority === "P1" ? "HIGH" : "MEDIUM",
      source: "gap",
    });
  }
  return out.slice(0, 3);
}

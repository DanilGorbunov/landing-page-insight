/**
 * Client-side lens views over existing AnalysisResult data only (no API calls).
 * When a metric is not present in the payload, rows show "Insufficient data".
 */
import { getDomain } from "@/lib/utils";
import type { AnalysisResult, UxSignals } from "@/types/api";
import type { BehavioralUx } from "@/lib/compareDecisionMetrics";
import { inferSectionKeyFromGapArea, type SectionOrderKey } from "@/lib/compareDecisionMetrics";

export const LENS_SECTION_ORDER: SectionOrderKey[] = [
  "hero",
  "value proposition",
  "features",
  "social proof",
  "CTA",
];

const SECTION_LABELS: Record<SectionOrderKey, string> = {
  hero: "Hero",
  "value proposition": "Value prop",
  features: "Features",
  "social proof": "Social proof",
  CTA: "CTA",
};

export type LensRowStatus = "ok" | "warn" | "bad" | "unknown";

export type VisualLensRow = { label: string; value: string; status: LensRowStatus };

export type VisualLensSectionModel = { id: string; title: string; rows: VisualLensRow[] };

function extractContrastRatios(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*:\s*1\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isNaN(v) && v > 0 && v < 30) out.push(v);
  }
  return out;
}

function wcagStatusForRatio(ratio: number): LensRowStatus {
  if (ratio >= 4.5) return "ok";
  if (ratio >= 3) return "warn";
  return "bad";
}

function mapUxContrast(q: UxSignals["contrastQuality"]): { value: string; status: LensRowStatus } {
  if (q == null) return { value: "Insufficient data", status: "unknown" };
  if (q === "good") return { value: "Good", status: "ok" };
  if (q === "needs_improvement") return { value: "Needs improvement", status: "warn" };
  return { value: "Poor", status: "bad" };
}

function scanTextBlob(result: AnalysisResult): string {
  return [
    result.report,
    ...Object.values(result.userAnalysis ?? {}),
    ...(result.gaps?.map((g) => `${g.problem} ${g.recommendation ?? ""} ${g.evidence ?? ""} ${g.area}`) ?? []),
  ].join("\n");
}

function pickCtaRatio(scanText: string, ratios: number[]): number | null {
  const lower = scanText.toLowerCase();
  for (const r of ratios) {
    const needle = `${r}`;
    let idx = 0;
    while (idx < lower.length) {
      const i = lower.indexOf(needle, idx);
      if (i < 0) break;
      const ctx = lower.slice(Math.max(0, i - 100), Math.min(lower.length, i + 100));
      if (/(cta|button|primary|link contrast)/i.test(ctx)) return r;
      idx = i + 1;
    }
  }
  return ratios.length >= 2 ? ratios[1] : null;
}

export function buildVisualLensSections(
  result: AnalysisResult,
  opts: { heroScore: number | null; behavioral: BehavioralUx }
): VisualLensSectionModel[] {
  const ux = result.uxSignals ?? null;
  const scanText = scanTextBlob(result);
  const ratios = extractContrastRatios(scanText);

  const typoRows: VisualLensRow[] = [];

  if (opts.heroScore != null) {
    const s = opts.heroScore;
    const status: LensRowStatus = s >= 7.5 ? "ok" : s >= 5 ? "warn" : "bad";
    const assess = s >= 7.5 ? "Good" : s >= 5 ? "Mixed" : "Weak";
    typoRows.push({
      label: "Hero typography (section score)",
      value: `${assess} — ${s.toFixed(1)}/10`,
      status,
    });
  } else {
    typoRows.push({ label: "Hero typography (section score)", value: "Insufficient data", status: "unknown" });
  }

  if (ratios.length > 0) {
    const r = ratios[0];
    typoRows.push({
      label: "Contrast ratio (from analysis text)",
      value: `${r}:1${r < 4.5 ? " — below WCAG AA for body text (min 4.5:1)" : " — meets WCAG AA for body text"}`,
      status: wcagStatusForRatio(r),
    });
  } else {
    const cq = mapUxContrast(ux?.contrastQuality ?? null);
    typoRows.push({
      label: "Body / text contrast (no ratio in text)",
      value: cq.value,
      status: cq.status,
    });
  }

  const fontFlag = ux?.accessibilityFlags?.find((f) => /font|typeface|typograph/i.test(f));
  if (fontFlag) {
    typoRows.push({ label: "Typography note (accessibility flags)", value: fontFlag, status: "warn" });
  } else {
    typoRows.push({ label: "Font consistency across sections", value: "Insufficient data", status: "unknown" });
  }

  const colorRows: VisualLensRow[] = [];

  const ctaR = pickCtaRatio(scanText, ratios);
  if (ctaR != null) {
    colorRows.push({
      label: "CTA / button contrast (from analysis text)",
      value: `${ctaR}:1${ctaR < 4.5 ? " — fails WCAG AA (min 4.5:1)" : " — meets WCAG AA"}`,
      status: wcagStatusForRatio(ctaR),
    });
  } else {
    colorRows.push({ label: "CTA button contrast ratio", value: "Insufficient data", status: "unknown" });
  }

  const cq = mapUxContrast(ux?.contrastQuality ?? null);
  colorRows.push({
    label: "Background / text contrast (audit signal)",
    value: cq.value,
    status: cq.status,
  });

  if (ux?.colorConsistency) {
    const map: Record<string, LensRowStatus> = {
      cohesive: "ok",
      mostly_consistent: "warn",
      inconsistent: "bad",
    };
    colorRows.push({
      label: "Color consistency",
      value: ux.colorConsistency.replace(/_/g, " "),
      status: map[ux.colorConsistency] ?? "unknown",
    });
  } else {
    colorRows.push({ label: "Color consistency", value: "Insufficient data", status: "unknown" });
  }

  const pu = result.performance?.user?.scores?.accessibility ?? null;
  const comp0 = result.competitors?.[0];
  const pc = comp0 ? result.performance?.competitors?.[0]?.scores?.accessibility ?? null : null;
  const compDomain = comp0 ? getDomain(comp0.url) : null;
  if (pu != null || pc != null) {
    colorRows.push({
      label: "Lighthouse accessibility (0–100)",
      value:
        pu != null && pc != null && compDomain
          ? `You ${pu} vs ${compDomain} ${pc}`
          : pu != null
            ? `You: ${pu}`
            : pc != null && compDomain
              ? `${compDomain}: ${pc}`
              : "Insufficient data",
      status: pu != null && pu < 90 ? "warn" : pc != null && pu != null && pc > pu ? "warn" : "ok",
    });
  }

  if (ratios.length > 0) {
    const worst = Math.min(...ratios);
    colorRows.push({
      label: "WCAG AA text contrast (4.5:1)",
      value: worst < 4.5 ? `Lowest ratio found in text: ${worst}:1` : `Lowest ratio found in text: ${worst}:1 (passes)`,
      status: worst < 4.5 ? "bad" : "ok",
    });
  }

  const vhRows: VisualLensRow[] = [];

  if (ux?.visualHierarchy) {
    const m: Record<string, { v: string; st: LensRowStatus }> = {
      strong: { v: "Strong", st: "ok" },
      moderate: { v: "Moderate", st: "warn" },
      weak: { v: "Weak", st: "bad" },
    };
    const x = m[ux.visualHierarchy];
    vhRows.push({ label: "Visual hierarchy (audit)", value: x.v, status: x.st });
  } else {
    vhRows.push({ label: "Visual hierarchy (audit)", value: "Insufficient data", status: "unknown" });
  }

  vhRows.push({
    label: "Attention flow",
    value: opts.behavioral.attentionFlow,
    status: opts.behavioral.leadsToCta === "Strong" ? "ok" : opts.behavioral.leadsToCta === "Weak" ? "bad" : "warn",
  });

  vhRows.push({
    label: "Competing focal points",
    value:
      opts.behavioral.leadsToCta === "Weak"
        ? "Multiple competing elements suggested (weak path to CTA)"
        : opts.behavioral.leadsToCta === "Strong"
          ? "Clear path toward primary CTA"
          : "Split focus before CTA",
    status: opts.behavioral.leadsToCta === "Weak" ? "warn" : "ok",
  });

  if (ux?.whitespaceBalance) {
    const st: Record<string, LensRowStatus> = {
      spacious: "ok",
      balanced: "warn",
      cramped: "bad",
    };
    vhRows.push({
      label: "Whitespace balance",
      value: ux.whitespaceBalance,
      status: st[ux.whitespaceBalance] ?? "unknown",
    });
  } else {
    vhRows.push({ label: "Whitespace balance", value: "Insufficient data", status: "unknown" });
  }

  const imgRows: VisualLensRow[] = [];

  const iq = ux?.imageQuality;
  if (iq) {
    const st: LensRowStatus = iq === "professional" ? "ok" : iq === "stock" ? "warn" : "bad";
    imgRows.push({
      label: "Hero / imagery quality (audit)",
      value: iq.replace(/_/g, " "),
      status: st,
    });
  } else {
    imgRows.push({ label: "Hero visual quality (audit)", value: "Insufficient data", status: "unknown" });
  }

  const userShot = !!result.targetScreenshotUrl;
  imgRows.push({
    label: "Product / hero screenshot in analysis",
    value: userShot ? "Screenshot URL present" : "No screenshot URL in result",
    status: userShot ? "ok" : "bad",
  });

  if (comp0) {
    const cd = getDomain(comp0.url);
    const cshot = !!comp0.screenshotUrl;
    imgRows.push({
      label: `vs ${cd} (captured screenshot)`,
      value: cshot ? `${cd} has a screenshot URL` : `No screenshot URL for ${cd}`,
      status: cshot ? "ok" : "warn",
    });
  }

  const rec =
    result.gaps?.find((g) => /image|screenshot|visual|hero photo|product shot/i.test(`${g.problem} ${g.area}`))?.recommendation?.trim() ??
    null;
  if (rec) {
    imgRows.push({
      label: "Recommendation (from gaps)",
      value: rec.length > 220 ? `${rec.slice(0, 217)}…` : rec,
      status: "warn",
    });
  } else if (iq === "none" || iq === "low_quality") {
    imgRows.push({
      label: "Recommendation",
      value: "Consider adding a clear product or outcome visual in the hero.",
      status: "warn",
    });
  }

  return [
    { id: "typography", title: "Typography", rows: typoRows },
    { id: "color", title: "Color & Contrast", rows: colorRows },
    { id: "hierarchy", title: "Visual Hierarchy", rows: vhRows },
    { id: "imagery", title: "Imagery & Visual Assets", rows: imgRows },
  ];
}

export type HotLensIssue = {
  sectionKey: SectionOrderKey;
  label: string;
  score: number;
  problem: string;
  priority: "P1" | "P2";
  competitorNote: string | null;
};

function firstLineProblem(text: string): string {
  const t = text.replace(/\*\*/g, "").trim();
  const one = t.split(/\n|\.(?=\s)/)[0]?.trim() ?? t;
  return one.length > 140 ? `${one.slice(0, 137)}…` : one;
}

export function buildHotLensIssues(
  result: AnalysisResult,
  annotations: Array<{ sectionKey: string; label: string; score: number | null; summary: string; fullText?: string }>
): HotLensIssue[] {
  const gaps = result.gaps ?? [];
  const hints = result.uxHints ?? [];

  const low = annotations
    .filter((a): a is typeof a & { score: number } => a.score != null && a.score < 7)
    .sort((a, b) => a.score - b.score);

  return low.map((a) => {
    const key = a.sectionKey as SectionOrderKey;
    const gap =
      gaps.find((g) => inferSectionKeyFromGapArea(g.area) === key) ??
      gaps.find((g) => g.area.toLowerCase().includes(key.split(" ")[0] ?? ""));
    const hint = hints.find((h) => h.section.toLowerCase().includes(key.split(" ")[0] ?? ""));

    const problem =
      gap?.problem?.trim() ||
      hint?.issue?.trim() ||
      (a.summary && a.summary !== "No data" ? firstLineProblem(a.summary) : "") ||
      firstLineProblem(a.fullText ?? "") ||
      "Section scores below the critical threshold.";

    let competitorNote: string | null = null;
    if (gap?.competitorAction?.trim()) competitorNote = gap.competitorAction.trim();
    else if (gap?.competitor?.trim() && gap?.problem) competitorNote = `${gap.competitor}: ${gap.problem}`;
    else if (gap?.competitor?.trim()) competitorNote = gap.competitor;

    const priority: "P1" | "P2" = gap?.priority === "P1" ? "P1" : "P2";

    return {
      sectionKey: key,
      label: a.label,
      score: a.score,
      problem,
      priority,
      competitorNote,
    };
  });
}

export type DeltaLensItem = {
  sectionKey: SectionOrderKey;
  label: string;
  gap: number;
  userScore: number;
  compScore: number;
  narrative: string | null;
};

export function buildDeltaLensItems(
  result: AnalysisResult,
  userBySection: Record<string, number | null>,
  compBySection: Record<string, number | null> | null,
  compDomain: string | null
): { summary: string | null; items: DeltaLensItem[] } {
  if (!compBySection || !compDomain) {
    return { summary: null, items: [] };
  }

  const hint = compDomain.split(".")[0]?.toLowerCase() ?? "";
  const edge =
    result.competitiveEdge?.find((e) => e.competitor.toLowerCase().includes(hint)) ?? result.competitiveEdge?.[0];

  const items: DeltaLensItem[] = [];

  for (const key of LENS_SECTION_ORDER) {
    const u = userBySection[key];
    const c = compBySection[key];
    if (u == null || c == null) continue;
    if (c <= u) continue;
    const gap = Math.round((c - u) * 10) / 10;

    let narrative: string | null = null;
    const adv =
      edge?.advantages?.find((x) =>
        [key, SECTION_LABELS[key]].some((frag) => frag && x.element.toLowerCase().includes(frag.toLowerCase()))
      ) ?? edge?.advantages?.[0];
    if (adv?.theirApproach) narrative = adv.theirApproach;
    else {
      const g = result.gaps?.find((x) => inferSectionKeyFromGapArea(x.area) === key);
      if (g?.competitorAction?.trim()) narrative = g.competitorAction.trim();
      else if (g?.evidence?.trim()) narrative = g.evidence.trim();
    }

    items.push({
      sectionKey: key,
      label: SECTION_LABELS[key],
      gap,
      userScore: u,
      compScore: c,
      narrative,
    });
  }

  items.sort((a, b) => b.gap - a.gap);

  if (items.length === 0) {
    return {
      summary: `Competitor ${compDomain} does not lead in any of the ${LENS_SECTION_ORDER.length} sections (with paired scores).`,
      items: [],
    };
  }

  const summary = `Competitor ${compDomain} beats you in ${items.length} of ${LENS_SECTION_ORDER.length} sections.`;

  return { summary, items };
}

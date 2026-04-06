/**
 * Toolbar context: VIEW + ANALYZE + LENS combinations drive screenshot overlays and right-panel copy.
 * Analyze + Lens use AND logic when both apply.
 */

export type ToolbarViewMode = "single" | "split" | "compare" | "slider";

/** Null = neutral (no analyze overlay); layer baseline is "compare" (no tint). */
export type ToolbarAnalyzeMode =
  | "attention"
  | "heatmap"
  | "copy"
  | "conversion"
  | "mobile"
  | "first5s"
  | "trust"
  | "readability"
  | null;

export type ToolbarZoneLens = "balanced" | "hot" | "delta";

export type ToolbarContext = {
  viewMode: ToolbarViewMode;
  analyzeMode: ToolbarAnalyzeMode;
  zoneLens: ToolbarZoneLens;
};

const ANALYZE_LABEL: Record<Exclude<ToolbarAnalyzeMode, null>, string> = {
  attention: "Attention",
  heatmap: "Gap heat",
  copy: "Copy",
  conversion: "Conversion",
  mobile: "Mobile",
  first5s: "First 5 seconds",
  trust: "Trust",
  readability: "Readability",
};

const LENS_LABEL: Record<Exclude<ToolbarZoneLens, "balanced">, string> = {
  hot: "HOT",
  delta: "Δ VS YOU",
};

/** Right panel title (below tabs). Single + balanced + no analyze → none. */
export function getRightPanelHeader(
  ctx: ToolbarContext,
  opts?: { hotSectionCount?: number }
): { title: string | null; subtitle?: string } {
  const { viewMode, analyzeMode, zoneLens } = ctx;
  const parts: string[] = [];

  if (viewMode === "single") {
    parts.push("Your site");
  } else if (viewMode === "split" || viewMode === "slider") {
    parts.push("You vs competitor");
  } else if (viewMode === "compare") {
    parts.push("Split · gap comparison");
  }

  if (analyzeMode === "attention") {
    return { title: "Attention Analysis", subtitle: "Eye path: headline → CTA → social proof · Visual hierarchy & above-fold focus" };
  }
  if (analyzeMode === "heatmap") {
    return { title: "Competitive Gap Analysis", subtitle: "Zones: red = they lead · green = you lead · grey = similar" };
  }
  if (analyzeMode === "copy") {
    return { title: "Copy Analysis", subtitle: "Headlines, CTAs, and value prop wording side by side" };
  }
  if (analyzeMode === "conversion") {
    return { title: "Conversion Analysis", subtitle: "CTAs, forms, proof, trust — scored per zone" };
  }
  if (analyzeMode === "mobile") {
    return { title: "Mobile Experience", subtitle: "Tap targets, type scale, fold, navigation" };
  }
  if (analyzeMode === "first5s") {
    return { title: "First 5 Seconds", subtitle: "What visitors see before scrolling" };
  }
  if (analyzeMode === "trust") {
    return { title: "Trust signals", subtitle: "Proof, security, credibility zones" };
  }
  if (analyzeMode === "readability") {
    return { title: "Readability", subtitle: "Scan-friendly blocks and hierarchy" };
  }

  if (zoneLens === "hot") {
    const n = opts?.hotSectionCount ?? 0;
    return {
      title: n > 0 ? `🔥 Critical Issues — ${n} problems found` : "🔥 Critical Issues",
      subtitle: n > 0 ? "Sections below 7.0 — worst first" : "All sections score 7.0 or above",
    };
  }
  if (zoneLens === "delta") {
    return { title: "Where competitors beat you", subtitle: "Sorted by biggest gap first" };
  }

  if (viewMode === "compare") {
    return { title: "Split view", subtitle: "Green = competitor stronger · Red = you stronger" };
  }

  if (parts.length && analyzeMode === null && zoneLens === "balanced") {
    return { title: null, subtitle: undefined };
  }

  return { title: parts[0] ?? null, subtitle: undefined };
}

export function formatToolbarContextForEmpty(ctx: ToolbarContext): string {
  const a = ctx.analyzeMode ? ANALYZE_LABEL[ctx.analyzeMode] : "";
  const z =
    ctx.zoneLens !== "balanced" ? LENS_LABEL[ctx.zoneLens as Exclude<ToolbarZoneLens, "balanced">] : "";
  if (a && z) return `${a} + ${z}`;
  if (a) return a;
  if (z) return z;
  return "this view";
}

/** AND: section must pass lens filter AND analyze filter when both narrow content. */
export function sectionPassesToolbarFilters(
  ctx: ToolbarContext,
  sectionKey: string,
  userScore: number | null,
  compScore: number | null,
  opts?: { hasVisualInsight?: boolean }
): boolean {
  const { analyzeMode, zoneLens } = ctx;
  const gap = userScore != null && compScore != null ? compScore - userScore : null;

  let lensOk = true;
  if (zoneLens === "hot") {
    lensOk = userScore != null && userScore < 7;
  } else if (zoneLens === "delta") {
    lensOk = gap != null && gap > 0;
  }

  let analyzeOk = true;
  if (analyzeMode === "attention") {
    analyzeOk = ["hero", "value proposition", "CTA"].includes(sectionKey);
  } else if (analyzeMode === "heatmap" || analyzeMode === "conversion") {
    analyzeOk = true;
  } else if (analyzeMode === "copy") {
    analyzeOk = ["hero", "value proposition", "CTA"].includes(sectionKey);
  } else if (analyzeMode === "mobile" || analyzeMode === "first5s") {
    analyzeOk = ["hero", "value proposition", "CTA", "features"].includes(sectionKey);
  } else if (analyzeMode === "trust") {
    analyzeOk = sectionKey === "social proof";
  } else if (analyzeMode === "readability") {
    analyzeOk = ["hero", "value proposition", "features"].includes(sectionKey);
  }

  return lensOk && analyzeOk;
}

export function countHotSections(scores: Array<number | null | undefined>): number {
  return scores.filter((s): s is number => s != null && s < 7).length;
}

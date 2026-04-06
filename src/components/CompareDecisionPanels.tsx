import { Fragment, useMemo, useState, useEffect, useRef } from "react";
import { cn, getDomain } from "@/lib/utils";
import { HeatmapOverlay } from "@/components/HeatmapOverlay";
import type { AttentionZone } from "@/types/attention";
import {
  type HeroSubMetrics,
  type ConversionLayer,
  type BehavioralUx,
  type CopyAnalysisMetrics,
  type GapRankItem,
  type CompetitorWinNarrative,
  type CompareSiteTab,
  confidenceExplanation,
  headerUnifiedLine,
  businessImpactTier,
  conversionRiskWhyBut,
  topActionPlanRows,
  type ActionPlanRow,
  annotationDisplayBody,
  inferSectionKeyFromGapArea,
  type SectionOrderKey,
} from "@/lib/compareDecisionMetrics";
import type { AnalysisResult } from "@/types/api";
import {
  type ToolbarContext,
  getRightPanelHeader,
  formatToolbarContextForEmpty,
} from "@/lib/compareToolbarContext";
import { buildSectionScoreBreakdown } from "@/lib/scoreBreakdown";
import { insightConfidenceFromResult } from "@/lib/insightConfidence";
import { buildHotLensIssues, buildDeltaLensItems, type DeltaLensItem } from "@/lib/lensPanelContent";
import { HotLensPanel, DeltaLensPanel } from "@/components/LensInsightPanels";
import { ScoreBreakdownPopover } from "@/components/ScoreBreakdownPopover";
import { CopyGeneratorBlock } from "@/components/CopyGeneratorBlock";
import { AttentionAnalysisPanel } from "@/components/AttentionAnalysisPanel";
import type { AttentionComparison, HeatmapAnalysis } from "@/types/attention";
import { BusinessImpactEstimate } from "@/components/BusinessImpactEstimate";
import { InsightConfidenceBadge } from "@/components/InsightConfidenceBadge";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Crown,
  Flame,
  LayoutDashboard,
  Lightbulb,
  Rocket,
  ScanEye,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";

function sColor(s: number) {
  if (s >= 7.5) return "text-primary";
  if (s >= 5) return "text-amber-500";
  return "text-red-500";
}

/** Your site overall score in Compare tabs: &lt;5 red, &lt;7 orange, else primary. */
function userSiteScoreClass(s: number) {
  if (s < 5) return "text-red-500";
  if (s < 7) return "text-amber-500";
  return "text-primary";
}

function riskBadge(r: ConversionLayer["risk"]) {
  const map = {
    LOW: "bg-primary/15 text-primary border-primary/30",
    MEDIUM: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    HIGH: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return map[r];
}

/** Status for Compare header: unified story + main issue (no conflicting one-liners). */
export function CompareHeaderStatus({
  userScore,
  rank,
  totalRanked,
  losing,
  conversion,
  mainIssue,
  variant = "header",
}: {
  userScore: number | null;
  rank: number | null;
  totalRanked: number;
  losing: boolean;
  conversion: ConversionLayer;
  mainIssue: string;
  variant?: "header" | "card" | "overview";
}) {
  const isHeader = variant === "header";
  const isOverview = variant === "overview";
  const tier = businessImpactTier(conversion);
  const showBusinessImpact = variant === "card";

  if (isOverview) {
    return (
      <div className="flex flex-col gap-2 w-full min-w-0 px-3 py-3 rounded-xl border border-border bg-card/80">
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {rank != null && totalRanked > 0 ? (
            <>
              Rank #{rank} of {totalRanked} · Overall {userScore != null ? userScore.toFixed(1) : "—"}/10
            </>
          ) : (
            <>Overall {userScore != null ? userScore.toFixed(1) : "—"}/10</>
          )}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          {losing ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 shrink-0">
              Behind on rank
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Leading / tied
            </span>
          )}
          <p className="text-[11px] text-foreground/90 leading-snug min-w-0 flex-1">{headerUnifiedLine(losing, conversion)}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2 min-w-0">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5 shrink-0",
              riskBadge(conversion.risk)
            )}
          >
            Risk: {conversion.risk}
          </span>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground min-w-0 flex-1 leading-snug break-words">
            <span className="font-semibold text-foreground">Main issue:</span> {mainIssue}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 sm:gap-2 w-full min-w-0",
        !isHeader && "px-4 py-3 border-b",
        !isHeader && (losing ? "border-red-500/20 bg-red-500/[0.06]" : "border-primary/15 bg-primary/[0.04]")
      )}
    >
      <p className={cn("text-[11px] sm:text-xs text-foreground/95 leading-snug", isHeader && "line-clamp-2 sm:line-clamp-none")}>
        {headerUnifiedLine(losing, conversion)}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {losing ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 shrink-0">
              Behind on rank
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Leading / tied
            </span>
          )}
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Overall <span className="font-bold text-foreground tabular-nums">{userScore != null ? userScore.toFixed(1) : "—"}</span>/10
            {rank != null && totalRanked > 0 && (
              <>
                {" "}
                · Rank <span className="font-semibold text-foreground">#{rank}</span> of {totalRanked}
              </>
            )}
            {" · "}
            <span className="text-foreground/90">Impact: {tier}</span>{" "}
            <span className="font-bold text-red-500 tabular-nums">(−{conversion.lossLowPct}–{conversion.lossHighPct}%)</span>
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-2 min-w-0 flex-1 basis-full sm:basis-auto">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5 shrink-0",
              riskBadge(conversion.risk)
            )}
          >
            Risk: {conversion.risk}
          </span>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground min-w-0 flex-1 leading-snug break-words">
            <span className="font-semibold text-foreground">Main issue:</span> {mainIssue}
          </p>
        </div>
      </div>
      {showBusinessImpact && <BusinessImpactEstimate conversion={conversion} />}
    </div>
  );
}

function tabAnalysisResult(result: AnalysisResult, site: CompareSiteTab): AnalysisResult {
  if (site.isUser) return result;
  const comp = result.competitors?.find((c) => getDomain(c.url) === site.domain);
  if (!comp) return result;
  return {
    ...result,
    userAnalysis: { ...(comp.analysis ?? {}) },
    targetScreenshotUrl: comp.screenshotUrl ?? null,
  };
}

/** Site tabs for Compare: header strip or sidebar submenu (your domain + competitors, Δ vs you). */
export function CompareHeaderSiteTabs({
  sites,
  activeIdx,
  onSelect,
  analysisResult,
  orientation = "horizontal",
  density = "default",
}: {
  sites: CompareSiteTab[];
  activeIdx: number;
  onSelect: (i: number) => void;
  /** When set, overall scores open methodology popovers (div tab avoids nested buttons). */
  analysisResult?: AnalysisResult | null;
  orientation?: "horizontal" | "vertical";
  /** Tighter padding for collapsed sidebar. */
  density?: "default" | "compact";
}) {
  const isVertical = orientation === "vertical";
  const compact = density === "compact";
  const userScore = sites.find((s) => s.isUser)?.overallScore ?? null;
  const scoreClass = (x: number | null) => {
    if (x == null) return "text-muted-foreground";
    return sColor(x);
  };

  const ScoreOrDash = ({ site, active }: { site: CompareSiteTab; active: boolean }) => {
    if (site.overallScore == null) return <span className="tabular-nums font-bold">—</span>;
    const scoreColorClass = site.isUser
      ? userSiteScoreClass(site.overallScore)
      : active
        ? "text-primary"
        : scoreClass(site.overallScore);
    if (analysisResult) {
      return (
        <ScoreBreakdownPopover
          sectionTitle="Score methodology"
          breakdown={buildSectionScoreBreakdown("hero", site.overallScore, tabAnalysisResult(analysisResult, site))}
        >
          <span className={cn("tabular-nums font-bold", compact && "text-[10px]", scoreColorClass)}>
            {site.overallScore.toFixed(1)}
          </span>
        </ScoreBreakdownPopover>
      );
    }
    return (
      <span className={cn("tabular-nums font-bold", compact && "text-[10px]", scoreColorClass)}>
        {site.overallScore.toFixed(1)}
      </span>
    );
  };

  const trendIcon = (delta: number) =>
    delta > 0 ? (
      <TrendingUp className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
    ) : delta < 0 ? (
      <TrendingDown className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
    ) : null;

  return (
    <div
      className={cn(
        isVertical
          ? "flex flex-col gap-1.5 w-full min-w-0 py-0.5"
          : "flex flex-1 min-w-0 items-center gap-1 overflow-x-auto py-0.5 scrollbar-hide"
      )}
    >
      {sites.map((s, i) => {
        const delta =
          !s.isUser && userScore != null && s.overallScore != null
            ? Math.round((s.overallScore - userScore) * 10) / 10
            : null;
        const active = i === activeIdx;
        return (
          <div
            key={s.url}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(i);
              }
            }}
            className={cn(
              "flex items-center rounded-lg border font-semibold transition-colors cursor-pointer select-none",
              compact ? "gap-1 px-1.5 py-1 text-[9px]" : "gap-1.5 px-2.5 py-1.5 text-[11px]",
              isVertical ? "w-full max-w-full min-w-0 flex-nowrap justify-between" : "shrink-0",
              active
                ? "border-primary bg-primary/15 text-primary shadow-sm"
                : "border-border bg-card/80 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {s.isUser ? (
              <>
                <span
                  className={cn(
                    "truncate text-left font-semibold text-foreground",
                    compact ? "text-[9px]" : "text-[11px]",
                    isVertical ? "min-w-0 flex-1 max-w-full" : "max-w-[128px]"
                  )}
                  title={s.domain}
                >
                  {s.domain}
                </span>
                <div className={cn("flex items-center shrink-0", isVertical && "ml-auto")}>
                  <ScoreOrDash site={s} active={active} />
                </div>
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "truncate text-left",
                    isVertical ? "min-w-0 flex-1 max-w-full" : "max-w-[128px]"
                  )}
                  title={s.domain}
                >
                  {s.domain}
                </span>
                <div className={cn("flex items-center gap-1 shrink-0", isVertical && "ml-auto")}>
                  {s.overallScore != null && <ScoreOrDash site={s} active={active} />}
                  {delta != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full font-bold tabular-nums border",
                        compact ? "px-1 py-0 text-[8px]" : "px-1.5 py-0.5 text-[10px]",
                        delta > 0
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : delta < 0
                            ? "border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-400"
                            : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {trendIcon(delta)}
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SiteLite {
  domain: string;
  isUser: boolean;
  overallScore: number | null;
}

/** Full section text opened from pin “More” — shown in the right column. */
export type SectionDeepDivePayload = {
  sectionKey: string;
  label: string;
  score: number | null;
  fullText: string;
  watchPoints: string[];
};

type DecisionPanelTab = "overview" | "insight" | "plan" | "impact" | "compete" | "scores";

const DECISION_PANEL_TABS: { id: DecisionPanelTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "insight", label: "Insight" },
  { id: "plan", label: "Plan" },
  { id: "impact", label: "Impact" },
  { id: "compete", label: "Compete" },
  { id: "scores", label: "Scores" },
];

export function DecisionActionPanel({
  result,
  activeSite,
  userSite,
  focusedKey,
  sectionLabel,
  metricsHeadlineScore,
  heroScore,
  heroSub,
  conversion,
  behavioral,
  copyMetrics,
  gapItems,
  winNarrative,
  stealThree,
  abVariants,
  fixMode,
  setFixMode,
  simplifyCEO,
  setSimplifyCEO,
  dataCoveragePct,
  gapConfidence,
  userOverall,
  competitorAhead,
  statusBanner,
  threeSecondInsight,
  sectionDeepDive,
  onCloseSectionDeepDive,
  focusPlanTick,
  toolbarContext,
  toolbarContextKey,
  hideCompetitorRefs,
  toolbarFilteredSectionCount,
  sectionDeltaVsCompetitor,
  vsDomain,
  hotSectionCount = 0,
  quickWin,
  onQuickWinDismiss,
  onQuickWinPlan,
  lensAnnotations = [],
  lensVs = null,
  attentionInsight = null,
}: {
  result: AnalysisResult;
  activeSite: SiteLite;
  userSite: SiteLite;
  focusedKey: string | null;
  sectionLabel: string;
  /** Score for the collapsible metrics header (active section or hero when none selected). */
  metricsHeadlineScore: number | null;
  heroScore: number | null;
  heroSub: HeroSubMetrics;
  conversion: ConversionLayer;
  behavioral: BehavioralUx;
  copyMetrics: CopyAnalysisMetrics;
  gapItems: GapRankItem[];
  winNarrative: CompetitorWinNarrative | null;
  stealThree: string[];
  abVariants: string[];
  fixMode: boolean;
  setFixMode: (v: boolean) => void;
  simplifyCEO: boolean;
  setSimplifyCEO: (v: boolean) => void;
  dataCoveragePct: number;
  gapConfidence: "High" | "Medium" | "Low" | undefined;
  userOverall: number | null;
  competitorAhead: boolean;
  statusBanner?: {
    userScore: number | null;
    rank: number | null;
    totalRanked: number;
    losing: boolean;
    conversion: ConversionLayer;
    mainIssue: string;
  } | null;
  /** Hero problem + 3-second visitor read (moved from center column). */
  threeSecondInsight: { problem: string; result: string };
  /** Pin “More” — full section analysis in the right column. */
  sectionDeepDive?: SectionDeepDivePayload | null;
  onCloseSectionDeepDive?: () => void;
  focusPlanTick?: number;
  toolbarContext: ToolbarContext;
  toolbarContextKey: string;
  /** Single view on your site — hide competitive copy in the panel. */
  hideCompetitorRefs?: boolean;
  /** Sections that pass current lens ∩ analyze filters (for empty state). */
  toolbarFilteredSectionCount: number;
  sectionDeltaVsCompetitor?: Record<string, number | null> | null;
  vsDomain?: string | null;
  hotSectionCount?: number;
  quickWin?: { label: string; fixOne: string; impact: number; sectionKey: string } | null;
  onQuickWinDismiss?: () => void;
  onQuickWinPlan?: () => void;
  /** Per-section rows for HOT / Δ lenses (your site annotations). */
  lensAnnotations?: Array<{
    sectionKey: string;
    label: string;
    score: number | null;
    summary: string;
    fullText?: string;
  }>;
  /** Active competitor for Δ lens (scores + domain). */
  lensVs?: { domain: string; bySection: Record<string, number | null> } | null;
  /** Claude Vision attention heatmap + comparison (Analyze → Attention). */
  attentionInsight?: {
    loading: boolean;
    error: boolean;
    comparison: AttentionComparison | null;
    your: HeatmapAnalysis | null;
    competitor: HeatmapAnalysis | null;
    competitorName: string;
    showUpgradePrompt: boolean;
    onDismissUpgrade: () => void;
  } | null;
}) {
  const [panelTab, setPanelTab] = useState<DecisionPanelTab>("overview");
  const [heroOpen, setHeroOpen] = useState(true);
  const [behaviorOpen, setBehaviorOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [sectionDivePulse, setSectionDivePulse] = useState(false);
  const lastPlanTickRef = useRef<number | null>(null);
  const prevFocusedKeyRef = useRef<string | null | undefined>(undefined);
  const panelScrollRef = useRef<HTMLDivElement>(null);

  const panelHeader = useMemo(
    () => getRightPanelHeader(toolbarContext, { hotSectionCount }),
    [toolbarContext, hotSectionCount]
  );
  const showFilterEmpty =
    toolbarFilteredSectionCount === 0 &&
    (toolbarContext.analyzeMode != null || toolbarContext.zoneLens !== "balanced");

  useEffect(() => {
    panelScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [toolbarContextKey]);

  useEffect(() => {
    if (sectionDeepDive) setPanelTab("insight");
  }, [sectionDeepDive?.sectionKey]);

  useEffect(() => {
    if (!sectionDeepDive) return;
    setSectionDivePulse(true);
    const id = `compare-section-dive-${sectionDeepDive.sectionKey}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    const t = window.setTimeout(() => setSectionDivePulse(false), 2000);
    return () => window.clearTimeout(t);
  }, [sectionDeepDive?.sectionKey]);

  useEffect(() => {
    if (prevFocusedKeyRef.current === undefined) {
      prevFocusedKeyRef.current = focusedKey;
      return;
    }
    if (focusedKey != null && focusedKey !== prevFocusedKeyRef.current) {
      setPanelTab("insight");
      requestAnimationFrame(() => {
        document.getElementById("compare-scroll-insight")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    prevFocusedKeyRef.current = focusedKey;
  }, [focusedKey]);

  useEffect(() => {
    if (focusPlanTick === undefined) return;
    if (lastPlanTickRef.current === focusPlanTick) return;
    if (focusPlanTick === 0) {
      lastPlanTickRef.current = 0;
      return;
    }
    lastPlanTickRef.current = focusPlanTick;
    setPanelTab("plan");
    requestAnimationFrame(() => {
      document.getElementById("compare-scroll-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusPlanTick]);

  const gaps = useMemo(() => {
    const raw = result.gaps ?? [];
    return fixMode ? raw.filter((g) => g.priority === "P1") : raw;
  }, [result.gaps, fixMode]);

  const ceoBullets = useMemo(() => {
    const p1 = result.gaps?.find((g) => g.priority === "P1");
    return [
      conversion.mainIssue,
      p1 ? `${p1.area}: ${p1.problem}` : "Clarify the primary promise in the first screen.",
      gapItems[0] ? `Close the gap on ${gapItems[0].label.toLowerCase()} before iterating minor tweaks.` : "Benchmark one competitor hero and match their clarity bar.",
    ];
  }, [result.gaps, conversion.mainIssue, gapItems]);

  const topPlan = useMemo(() => topActionPlanRows(result), [result]);
  const riskWhyBut = useMemo(() => conversionRiskWhyBut(conversion, result), [conversion, result]);
  const insightConf = useMemo(() => insightConfidenceFromResult(result), [result]);

  const hotLensIssues = useMemo(() => buildHotLensIssues(result, lensAnnotations), [result, lensAnnotations]);

  const deltaLensPack = useMemo(() => {
    if (!lensVs) return { summary: null as string | null, items: [] as DeltaLensItem[] };
    const userBy = Object.fromEntries(lensAnnotations.map((a) => [a.sectionKey, a.score])) as Record<string, number | null>;
    return buildDeltaLensItems(result, userBy, lensVs.bySection, lensVs.domain);
  }, [result, lensAnnotations, lensVs]);

  /** Balanced lens (or Analyze overlay): show standard problem + 3s insight. Visual/Hot/Delta replace with filtered views. */
  const defaultInsightProblemCard =
    toolbarContext.analyzeMode !== null || toolbarContext.zoneLens === "balanced";

  const verdictLine = useMemo(() => {
    if (focusedKey === "hero") {
      return heroScore != null && heroScore < 6
        ? "Hero underperforms — specificity and emotional pull lag."
        : "Hero is acceptable — tighten value specificity to lift conversion.";
    }
    if (competitorAhead && !activeSite.isUser) {
      return `${activeSite.domain} leads on visible execution in this view.`;
    }
    if (!competitorAhead || activeSite.isUser) {
      return "Focus on closing the biggest gap categories below — highest ROI.";
    }
    return "Review stealable patterns and test new hero copy.";
  }, [focusedKey, heroScore, competitorAhead, activeSite]);

  const copyLine = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const impactBadge = (row: ActionPlanRow["impact"]) =>
    row === "HIGH"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : row === "MEDIUM"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-slate-500/15 text-slate-600 dark:text-slate-400";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/95 backdrop-blur-sm overflow-hidden flex h-full min-h-0 max-h-full flex-col z-10",
        fixMode ? "border-primary/50 shadow-md shadow-primary/10" : "border-primary/25 shadow-lg shadow-black/15"
      )}
    >
      <div
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-2 py-2 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Compare sections"
      >
        {DECISION_PANEL_TABS.map(({ id, label }) => {
          const active = panelTab === id;
          const Icon =
            id === "overview"
              ? LayoutDashboard
              : id === "insight"
                ? Lightbulb
                : id === "plan"
                  ? Rocket
                  : id === "impact"
                    ? TrendingUp
                    : id === "compete"
                      ? Crown
                      : id === "scores"
                        ? BarChart3
                        : null;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPanelTab(id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors shrink-0",
                active
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              {label}
            </button>
          );
        })}
      </div>

      <div ref={panelScrollRef} className="p-3 overflow-y-auto text-xs space-y-3 flex-1 min-h-0">
        {(panelHeader.title || panelHeader.subtitle) && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 transition-opacity duration-150">
            {panelHeader.title && <p className="text-[11px] font-bold text-primary">{panelHeader.title}</p>}
            {panelHeader.subtitle && (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{panelHeader.subtitle}</p>
            )}
          </div>
        )}
        {attentionInsight && toolbarContext.analyzeMode === "attention" && (
          <AttentionAnalysisPanel
            loading={attentionInsight.loading}
            error={attentionInsight.error}
            your={attentionInsight.your}
            competitor={attentionInsight.competitor}
            comparison={attentionInsight.comparison}
            competitorName={attentionInsight.competitorName}
            showUpgradePrompt={attentionInsight.showUpgradePrompt}
            onDismissUpgrade={attentionInsight.onDismissUpgrade}
          />
        )}
        {showFilterEmpty && (
          <div className="rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[11px] text-foreground">
            No {formatToolbarContextForEmpty(toolbarContext)} issues found in this section — that&apos;s a good sign ✓
          </div>
        )}
        <Fragment key={toolbarContextKey}>
        {panelTab === "overview" && (
          <div className="space-y-3 transition-opacity duration-150">
            {hideCompetitorRefs && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-foreground">Your site only</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  Single view — competitor comparison is hidden. Use Original, Split, or Slider to see vs{" "}
                  {vsDomain ?? "a competitor"}.
                </p>
              </div>
            )}
            {!hideCompetitorRefs && statusBanner && (
              <CompareHeaderStatus
                variant="overview"
                userScore={statusBanner.userScore}
                rank={statusBanner.rank}
                totalRanked={statusBanner.totalRanked}
                losing={statusBanner.losing}
                conversion={statusBanner.conversion}
                mainIssue={statusBanner.mainIssue}
              />
            )}
            {quickWin && !hideCompetitorRefs && onQuickWinDismiss && onQuickWinPlan && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-950 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50">
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="font-bold">Quick Win:</span>{" "}
                  <span className="font-semibold">{quickWin.label}</span> — {quickWin.fixOne} → est.{" "}
                  <span className="font-bold tabular-nums">+{quickWin.impact}%</span> impact
                </span>
                <button
                  type="button"
                  onClick={onQuickWinPlan}
                  className="shrink-0 rounded-full border border-amber-600/40 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-950 hover:bg-amber-200 dark:border-amber-400/50 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/80"
                >
                  Fix this →
                </button>
                <button
                  type="button"
                  onClick={onQuickWinDismiss}
                  className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-200/80 dark:text-amber-200 dark:hover:bg-amber-900/60"
                  aria-label="Dismiss quick win"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {panelTab === "insight" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Insight</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFixMode(!fixMode)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase flex items-center gap-1",
                    fixMode ? "bg-primary text-primary-foreground ring-2 ring-primary/60" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Wrench className="h-3 w-3" />
                  {fixMode ? "Fix mode on" : "Fix mode"}
                </button>
                <button
                  type="button"
                  onClick={() => setSimplifyCEO(!simplifyCEO)}
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                    simplifyCEO ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  CEO view
                </button>
              </div>
            </div>
            {sectionDeepDive && (
              <div
                id={`compare-section-dive-${sectionDeepDive.sectionKey}`}
                className={cn(
                  "shrink-0 border border-amber-500/25 rounded-xl bg-gradient-to-b from-amber-500/[0.08] to-transparent px-3 py-3 space-y-2 scroll-mt-4 transition-[box-shadow,background-color] duration-300",
                  sectionDivePulse && "ring-2 ring-amber-400 bg-amber-50/95 dark:bg-amber-950/45 dark:ring-amber-500/80"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Section analysis</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-sm font-semibold text-foreground">{sectionDeepDive.label}</span>
                      {sectionDeepDive.score != null && (
                        <ScoreBreakdownPopover
                          sectionTitle={sectionDeepDive.label}
                          breakdown={buildSectionScoreBreakdown(
                            (sectionDeepDive.sectionKey as SectionOrderKey) || "hero",
                            sectionDeepDive.score,
                            result
                          )}
                        >
                          <span className={cn("text-xs font-bold tabular-nums", sColor(sectionDeepDive.score))}>
                            {sectionDeepDive.score.toFixed(1)}/10
                          </span>
                        </ScoreBreakdownPopover>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCloseSectionDeepDive?.()}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close section detail"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {sectionDeepDive.watchPoints.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Watch</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-foreground leading-snug">
                      {sectionDeepDive.watchPoints.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-lg border border-border/80 bg-card/50 p-2.5 max-h-[min(280px,40vh)] overflow-y-auto">
                  <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                    {annotationDisplayBody(sectionDeepDive.fullText) || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyLine(annotationDisplayBody(sectionDeepDive.fullText))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  Copy full text
                </button>
              </div>
            )}
            {toolbarContext.analyzeMode === null && toolbarContext.zoneLens === "hot" && (
              <HotLensPanel issues={hotLensIssues} />
            )}
            {toolbarContext.analyzeMode === null && toolbarContext.zoneLens === "delta" && (
              <DeltaLensPanel summary={deltaLensPack.summary} items={deltaLensPack.items} />
            )}
            {defaultInsightProblemCard && (
            <div
              id="compare-scroll-insight"
              className={cn(
                "rounded-xl border border-red-500/35 bg-card/80 px-3 py-3 space-y-2 shadow-[inset_0_1px_0_0_rgba(248,113,113,0.1)] scroll-mt-3",
                toolbarContext.zoneLens === "hot" && "border-l-4 border-l-red-500"
              )}
            >
              <p className="text-sm font-semibold text-foreground">{sectionLabel}</p>
              <div className="flex flex-wrap items-center gap-2">
                <InsightConfidenceBadge level={insightConf} />
                <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-muted/50 px-1.5 py-0.5 text-muted-foreground">
                  Data coverage {dataCoveragePct}%
                </span>
              </div>
              <p className="text-sm text-foreground leading-snug">{threeSecondInsight.problem}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground pt-1">In 3 seconds</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{threeSecondInsight.result}</p>
            </div>
            )}
          </div>
        )}

        {panelTab === "plan" && (
          <>
            {fixMode && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] text-foreground flex items-start gap-2">
                <Wrench className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-primary">Fix mode on</span>
                  <span className="text-muted-foreground"> — only high-impact issues and P1 gaps. Turn off to see full metrics.</span>
                </div>
              </div>
            )}

            <div id="compare-scroll-plan" className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 scroll-mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground">Recommended next steps</p>
              {topPlan.length === 0 ? (
                <p className="text-muted-foreground">Add gaps or an action plan in the report to populate this list.</p>
              ) : (
                <ol className="space-y-2">
                  {topPlan.map((row, i) => (
                    <li key={`${row.title}-${i}`} className="flex gap-2 items-start">
                      <span className="font-bold text-primary tabular-nums shrink-0">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <span className={cn("text-[9px] font-bold uppercase rounded px-1.5 py-0.5 mr-2", impactBadge(row.impact))}>
                          {row.impact}
                        </span>
                        <span className="text-foreground leading-snug">{row.title}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                onClick={() => {
                  setFixMode(true);
                  setSimplifyCEO(false);
                  setPanelTab("plan");
                }}
                className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground hover:brightness-110"
              >
                <Rocket className="h-3.5 w-3.5" />
                Apply fixes (focus P1)
              </button>
            </div>

            {simplifyCEO ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Explain like I&apos;m CEO</p>
                <ul className="list-disc pl-4 space-y-1.5 text-foreground leading-relaxed">
                  {ceoBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">What to fix</p>
              {gaps.length === 0 ? (
                <p className="text-muted-foreground">{fixMode ? "No P1 gaps in payload." : "No gaps listed — check Overview."}</p>
              ) : (
                <ul className="space-y-2">
                  {gaps.slice(0, 6).map((g, i) => (
                    <li key={i} className="rounded-lg bg-muted/20 border border-border/60 p-2">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <InsightConfidenceBadge level={insightConf} />
                        <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-background/60 px-1.5 py-0.5 text-muted-foreground">
                          Data coverage {dataCoveragePct}%
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-bold rounded px-1.5 py-0.5",
                          g.priority === "P1" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"
                        )}
                      >
                        {g.priority}
                      </span>
                      <p className="text-foreground mt-1">{g.problem}</p>
                      <p className="text-primary text-[11px] mt-0.5">{g.recommendation}</p>
                      {g.recommendation?.trim() ? (
                        <CopyGeneratorBlock
                          result={result}
                          sectionKey={inferSectionKeyFromGapArea(g.area) ?? "hero"}
                          issue={g.problem}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {panelTab === "impact" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/15 px-2 py-2">
              <BusinessImpactEstimate conversion={conversion} />
            </div>
            <div className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <InsightConfidenceBadge level={insightConf} />
              <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                Data coverage {dataCoveragePct}%
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Conversion impact</p>
            <p className="text-foreground leading-snug">{verdictLine}</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <span className={cn("rounded-full border px-2 py-0.5", riskBadge(conversion.risk))}>Risk: {conversion.risk}</span>
              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                Friction {conversion.frictionScore.toFixed(1)}/10
              </span>
              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                Cognitive load: {conversion.cognitiveLoad}
              </span>
            </div>
            <p className="text-muted-foreground">
              Est. revenue at stake:{" "}
              <span className="font-bold text-red-500 tabular-nums">
                −{conversion.lossLowPct}–{conversion.lossHighPct}%
              </span>
            </p>
            <div className="pt-2 border-t border-border/80 space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-primary">Why risk is {conversion.risk}</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {riskWhyBut.why.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 pt-1">But</p>
              <p className="text-foreground leading-relaxed">{riskWhyBut.but}</p>
            </div>
            </div>
          </div>
        )}

        {panelTab === "compete" && (
          <div className="space-y-3">
            {hideCompetitorRefs ? (
              <p className="text-[11px] text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-3 leading-relaxed">
                Competitive steal lists and win narratives are hidden in Single view. Use Original, Split, or Slider to compare against a competitor.
              </p>
            ) : (
              <>
            {winNarrative && (!activeSite.isUser || stealThree.length > 0) && (
              <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/8 to-transparent p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <InsightConfidenceBadge level={insightConf} />
                  <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-background/60 px-1.5 py-0.5 text-muted-foreground">
                    Data coverage {dataCoveragePct}%
                  </span>
                </div>
                <p className="text-[11px] font-bold text-primary flex items-center gap-1">
                  <Crown className="h-4 w-4" />
                  {winNarrative.competitorLabel} wins
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-primary">Their edge</p>
                    {winNarrative.winsBecause.slice(0, 4).map((line, i) => (
                      <p key={i} className="flex gap-1.5 text-foreground text-[11px] leading-snug">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{line}</span>
                      </p>
                    ))}
                  </div>
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400">You</p>
                    {winNarrative.youLoseBecause.slice(0, 4).map((line, i) => (
                      <p key={i} className="flex gap-1.5 text-muted-foreground text-[11px] leading-snug">
                        <X className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                        <span>{line}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stealThree.length > 0 && (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/[0.07] p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <InsightConfidenceBadge level={insightConf} />
                  <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-background/60 px-1.5 py-0.5 text-muted-foreground">
                    Data coverage {dataCoveragePct}%
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Flame className="h-4 w-4" />
                  Steal this (from competitors)
                </p>
                <ol className="space-y-2">
                  {stealThree.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">{i + 1}.</span>
                      <span className="text-foreground leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>
                {result.gaps?.[0]?.recommendation && (
                  <div className="rounded-lg border border-border bg-card/60 p-2.5">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <InsightConfidenceBadge level={insightConf} />
                      <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-background/60 px-1.5 py-0.5 text-muted-foreground">
                        Data coverage {dataCoveragePct}%
                      </span>
                    </div>
                    <p className="text-[10px] font-bold uppercase text-foreground mb-1">Fix this (your page)</p>
                    <p className="text-[11px] text-foreground leading-relaxed">{result.gaps[0].recommendation}</p>
                    <CopyGeneratorBlock
                      result={result}
                      sectionKey={inferSectionKeyFromGapArea(result.gaps[0].area) ?? "hero"}
                      issue={result.gaps[0].problem}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => copyLine(stealThree.join("\n"))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  Copy steal list
                </button>
              </div>
            )}

            {abVariants.length > 0 && (
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/[0.06] p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <InsightConfidenceBadge level={insightConf} />
                  <span className="text-[9px] font-bold uppercase tracking-wide rounded border border-border bg-background/60 px-1.5 py-0.5 text-muted-foreground">
                    Data coverage {dataCoveragePct}%
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Recommended variant
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">&ldquo;{abVariants[0]}&rdquo;</p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Why this works</p>
                <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                  <li>Clear value and specificity</li>
                  <li>Reduces hesitation vs vague copy</li>
                  <li>Easy to A/B against your current hero</li>
                </ul>
                <button
                  type="button"
                  onClick={() => copyLine(abVariants[0])}
                  className="w-full rounded-full bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold py-2"
                >
                  Use this headline
                </button>
                <CopyGeneratorBlock
                  result={result}
                  sectionKey="hero"
                  issue="Strengthen hero headline for clarity and conversion"
                  currentCopy={result.userAnalysis?.hero ?? abVariants[0]}
                />
                {abVariants.length > 1 && (
                  <details className="group pt-1">
                    <summary className="text-[10px] font-semibold text-muted-foreground cursor-pointer list-none flex items-center gap-1">
                      <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                      Other variants ({abVariants.length - 1})
                    </summary>
                    <div className="mt-2 space-y-2 pl-1">
                      {abVariants.slice(1).map((v, i) => (
                        <div key={i} className="rounded-lg border border-border/80 bg-card/50 px-2.5 py-2 flex justify-between gap-2">
                          <p className="text-foreground text-[11px] leading-relaxed">&ldquo;{v}&rdquo;</p>
                          <button
                            type="button"
                            onClick={() => copyLine(v)}
                            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted h-fit"
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {!winNarrative && stealThree.length === 0 && abVariants.length === 0 && (
              <p className="text-muted-foreground text-center py-6">No competitive headline or steal list in this report.</p>
            )}
              </>
            )}
          </div>
        )}

        {panelTab === "scores" && (
          <>
            {!fixMode && (
              <div className="rounded-lg border border-border/80 p-2.5 flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <InsightConfidenceBadge level={insightConf} />
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Data coverage</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-foreground">{dataCoveragePct}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{confidenceExplanation(gapConfidence)}</p>
                </div>
                <ScanEye className="h-8 w-8 text-muted-foreground/40 shrink-0" />
              </div>
            )}

            {!fixMode && (
              <>
                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHeroOpen(!heroOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50"
                  >
                    <span className="font-semibold text-foreground inline-flex items-center gap-1 flex-wrap">
                      {sectionLabel}{" "}
                      {metricsHeadlineScore != null && (
                        <ScoreBreakdownPopover
                          sectionTitle={sectionLabel}
                          breakdown={buildSectionScoreBreakdown(
                            (focusedKey ?? "hero") as SectionOrderKey,
                            metricsHeadlineScore,
                            result
                          )}
                        >
                          <span className={cn("tabular-nums", sColor(metricsHeadlineScore))}>{metricsHeadlineScore.toFixed(1)}</span>
                        </ScoreBreakdownPopover>
                      )}
                    </span>
                    {heroOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {heroOpen && focusedKey === "hero" && (
                    <div className="px-3 py-2 space-y-1.5 border-t border-border bg-card/50">
                      <p className="text-[10px] text-muted-foreground mb-1">Hero breakdown</p>
                      {(
                        [
                          ["Clarity", heroSub.clarity],
                          ["Value specificity", heroSub.valueSpecificity],
                          ["Emotional hook", heroSub.emotionalHook],
                          ["Visual hierarchy", heroSub.visualHierarchy],
                          ["CTA visibility", heroSub.ctaVisibility],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{k}</span>
                          <span className={cn("font-bold tabular-nums", sColor(v))}>{v.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {heroOpen && focusedKey !== "hero" && (
                    <p className="px-3 py-2 text-muted-foreground border-t border-border text-[11px]">
                      Select <span className="font-semibold text-foreground">Hero</span> on the page or in the zone chips to see clarity, value, emotion, hierarchy, and CTA sub-scores.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBehaviorOpen(!behaviorOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50"
                  >
                    <span className="font-semibold text-foreground">Behavioral UX</span>
                    {behaviorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {behaviorOpen && (
                    <div className="px-3 py-2 space-y-2 border-t border-border text-[11px]">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Attention flow</p>
                        <p className="text-foreground leading-relaxed">{behavioral.attentionFlow}</p>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leads to CTA</span>
                        <span className="font-bold">{behavioral.leadsToCta}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Visual hierarchy</span>
                        <span className={cn("font-bold tabular-nums", sColor(behavioral.visualHierarchyScore))}>
                          {behavioral.visualHierarchyScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scanability</span>
                        <span className={cn("font-bold tabular-nums", sColor(behavioral.scanability))}>{behavioral.scanability.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Information density</span>
                        <span className="text-right">
                          <span className={cn("font-bold tabular-nums", sColor(10 - behavioral.informationDensity))}>
                            {behavioral.informationDensity.toFixed(1)}
                          </span>
                          <span className="text-muted-foreground ml-1">
                            ({behavioral.informationDensity >= 7 ? "heavy" : behavioral.informationDensity >= 4 ? "balanced" : "light"})
                          </span>
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Higher score = busier page; pair with scanability to spot overload.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCopyOpen(!copyOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50"
                  >
                    <span className="font-semibold text-foreground">Copy analysis</span>
                    {copyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {copyOpen && (
                    <div className="px-3 py-2 space-y-1 border-t border-border">
                      {(
                        [
                          ["Clarity", copyMetrics.clarity],
                          ["Specificity", copyMetrics.specificity],
                          ["Emotional language", copyMetrics.emotionalLanguage],
                          ["Length efficiency", copyMetrics.lengthEfficiency],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{k}</span>
                          <span className={cn("font-bold tabular-nums", sColor(v))}>{v.toFixed(1)}</span>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground pt-1">
                        Power words detected: <span className="font-semibold text-foreground">{copyMetrics.powerWordHits}</span>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {fixMode && (
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Turn off <span className="font-semibold text-foreground">Fix mode</span> to see hero sub-scores, behavioral UX, and copy metrics.
              </p>
            )}

            {!fixMode && (
              <div className="rounded-lg border border-dashed border-border/80 p-2 text-[10px] text-muted-foreground">
                Overall score context: <span className="font-bold text-foreground">{userOverall != null ? userOverall.toFixed(1) : "—"}</span>/10 ·{" "}
                {activeSite.isUser ? "You" : activeSite.domain} view
              </div>
            )}
          </>
        )}
        </Fragment>
      </div>
    </div>
  );
}

/** Analysis overlay modes applied on top of screenshots (compare = none). */
export type CompareOverlayLayerMode =
  | "compare"
  | "attention"
  | "heatmap"
  | "copy"
  | "trust"
  | "readability"
  | "first5s"
  | "conversion";

/** Overlay tint for screenshot: compare | attention | heatmap | copy | trust | readability | first5s | conversion */
export function CompareOverlayLayer({
  mode,
  annotations,
  first5sTopPct,
  heatmapGapPairByKey,
  heatmapGapOnCompetitorOnly,
  siteIsUser,
  attention,
  onAttentionZoneMore,
}: {
  mode: CompareOverlayLayerMode;
  annotations: Array<{ top: number; height: number; score: number | null; label: string; sectionKey?: string }>;
  /** Percent from top of screenshot where the “below fold” darkening starts (from ~600px / image height). */
  first5sTopPct?: number | null;
  /** Gap heat: user vs competitor score per section (for competitor screenshot tri-color). */
  heatmapGapPairByKey?: Record<string, { user: number | null; comp: number | null }>;
  /** When true, hide heatmap on user screenshot (Gap heat shows zones on competitor only). */
  heatmapGapOnCompetitorOnly?: boolean;
  siteIsUser?: boolean;
  /** AI attention heatmap zones (Analyze → Attention). */
  attention?: {
    zones: AttentionZone[] | null;
    visible: boolean;
    showPlaceholder: boolean;
  } | null;
  /** Attention blobs: click → More in parent (Insight / section). */
  onAttentionZoneMore?: (zone: AttentionZone) => void;
}) {
  if (mode === "compare") return null;

  if (mode === "heatmap" && heatmapGapOnCompetitorOnly && siteIsUser) return null;

  const attentionResolved =
    mode === "attention"
      ? attention ?? { zones: null as AttentionZone[] | null, visible: true, showPlaceholder: true }
      : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      {mode === "attention" && attentionResolved?.visible && attentionResolved.zones && attentionResolved.zones.length > 0 && (
        <HeatmapOverlay zones={attentionResolved.zones} onZoneMore={onAttentionZoneMore} />
      )}
      {mode === "attention" && attentionResolved?.visible && (!attentionResolved.zones || !attentionResolved.zones.length) && attentionResolved.showPlaceholder && (
        <>
          <div
            className="absolute inset-0 opacity-35"
            style={{
              background:
                "radial-gradient(ellipse 50% 32% at 48% 16%, rgba(239,68,68,0.42), transparent 65%), radial-gradient(ellipse 40% 28% at 72% 55%, rgba(59,130,246,0.35), transparent 60%), radial-gradient(ellipse 45% 30% at 28% 70%, rgba(147,197,253,0.4), transparent 55%)",
            }}
          />
          <div className="absolute left-[40%] top-[18%] w-px h-[40%] bg-gradient-to-b from-orange-400/90 to-amber-200/40" />
          <div className="absolute bottom-[26%] right-[36%] rounded-full w-2 h-2 bg-orange-500 shadow-[0_0_14px_rgba(249,115,22,0.95)]" />
        </>
      )}
      {mode === "heatmap" &&
        heatmapGapPairByKey &&
        !siteIsUser &&
        annotations.map((a) => {
          const key = a.sectionKey ?? a.label;
          const pair = heatmapGapPairByKey[key];
          const u = pair?.user ?? null;
          const c = pair?.comp ?? null;
          const gap = u != null && c != null ? c - u : null;
          const bg =
            gap == null
              ? "rgba(148,163,184,0.2)"
              : gap > 0.35
                ? "rgba(239,68,68,0.38)"
                : gap < -0.35
                  ? "rgba(34,197,94,0.32)"
                  : "rgba(148,163,184,0.22)";
          return (
            <div
              key={a.label}
              className="absolute left-0 right-0 border-y border-white/10"
              style={{
                top: `${a.top}%`,
                height: `${a.height}%`,
                background: `linear-gradient(90deg, ${bg}, transparent 92%)`,
              }}
            />
          );
        })}
      {mode === "heatmap" &&
        !heatmapGapPairByKey &&
        annotations.map((a) => {
          const intensity = a.score == null ? 0.2 : Math.max(0, (10 - a.score) / 10) * 0.85;
          return (
            <div
              key={a.label}
              className="absolute left-0 right-0 border-y border-red-500/20"
              style={{
                top: `${a.top}%`,
                height: `${a.height}%`,
                background: `linear-gradient(90deg, rgba(239,68,68,${intensity * 0.5}), rgba(239,68,68,${intensity * 0.15}))`,
              }}
            />
          );
        })}
      {mode === "copy" &&
        annotations.map((a) => {
          const sk = (a as { sectionKey?: string }).sectionKey ?? "";
          const primary =
            /hero|cta/i.test(a.label) || sk === "hero" || sk === "CTA" || sk === "value proposition";
          return (
            <div
              key={`copy-${a.label}`}
              className={cn(
                "absolute left-0 right-0 border-y backdrop-blur-[0.5px]",
                primary ? "bg-amber-400/18 border-amber-400/40" : "bg-sky-500/14 border-sky-400/30"
              )}
              style={{ top: `${a.top}%`, height: `${a.height}%` }}
            />
          );
        })}
      {mode === "trust" && (
        <>
          <div
            className="absolute left-0 right-0 border-y border-blue-500/30 bg-blue-500/[0.12] backdrop-blur-[0.5px]"
            style={{ top: "53%", height: "19%" }}
          />
          <div
            className="absolute left-0 right-0 border-y border-blue-500/35 bg-blue-500/[0.14] backdrop-blur-[0.5px]"
            style={{ top: "70%", height: "20%" }}
          />
        </>
      )}
      {mode === "readability" && (
        <>
          <div
            className="absolute left-0 right-0 border-y border-primary/25 bg-primary/[0.1]"
            style={{ top: "0%", height: "22%" }}
          />
          <div
            className="absolute left-0 right-0 border-y border-teal-500/25 bg-teal-500/[0.08]"
            style={{ top: "18%", height: "17%" }}
          />
        </>
      )}
      {mode === "first5s" && first5sTopPct != null && first5sTopPct < 100 && (
        <div
          className="absolute left-0 right-0 bottom-0 z-[6]"
          style={{
            top: `${first5sTopPct}%`,
            background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.78) 45%, rgba(0,0,0,0.92) 100%)",
          }}
        />
      )}
      {mode === "conversion" &&
        annotations.map((a) => {
            const sc = a.score;
            const ring =
              sc == null
                ? "border-muted-foreground/50 shadow-[inset_0_0_0_2px_rgba(148,163,184,0.5)]"
                : sc >= 8
                  ? "border-primary shadow-[inset_0_0_0_2px_hsl(var(--primary)_/_0.65)]"
                  : sc >= 6
                    ? "border-amber-400 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.55)]"
                    : "border-red-500 shadow-[inset_0_0_0_2px_rgba(239,68,68,0.6)]";
            return (
              <div
                key={`conv-${a.label}`}
                className={cn("absolute left-[1.5%] right-[1.5%] rounded-lg", ring)}
                style={{ top: `${a.top}%`, height: `${a.height}%` }}
              />
            );
          })}
    </div>
  );
}

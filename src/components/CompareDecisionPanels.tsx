import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/types/api";
import { cn } from "@/lib/utils";
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
} from "@/lib/compareDecisionMetrics";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Crown,
  Flame,
  Rocket,
  ScanEye,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";

function sColor(s: number) {
  if (s >= 7.5) return "text-emerald-500";
  if (s >= 5) return "text-amber-500";
  return "text-red-500";
}

function riskBadge(r: ConversionLayer["risk"]) {
  const map = {
    LOW: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
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
  variant?: "header" | "card";
}) {
  const isHeader = variant === "header";
  const tier = businessImpactTier(conversion);
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 sm:gap-2 w-full min-w-0",
        !isHeader && "px-4 py-3 border-b",
        !isHeader && (losing ? "border-red-500/20 bg-red-500/[0.06]" : "border-emerald-500/15 bg-emerald-500/[0.04]")
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
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 shrink-0">
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className={cn("text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5", riskBadge(conversion.risk))}>
            Risk: {conversion.risk}
          </span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground max-w-[220px] sm:max-w-md truncate" title={mainIssue}>
            <span className="font-semibold text-foreground">Main issue:</span> {mainIssue}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal site tabs for Compare dashboard header (You + competitors, Δ vs you). */
export function CompareHeaderSiteTabs({
  sites,
  activeIdx,
  onSelect,
}: {
  sites: CompareSiteTab[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  const userScore = sites.find((s) => s.isUser)?.overallScore ?? null;
  const scoreClass = (x: number | null) => {
    if (x == null) return "text-muted-foreground";
    return sColor(x);
  };
  return (
    <div className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto py-0.5 scrollbar-hide">
      {sites.map((s, i) => {
        const delta =
          !s.isUser && userScore != null && s.overallScore != null
            ? Math.round((s.overallScore - userScore) * 10) / 10
            : null;
        const active = i === activeIdx;
        return (
          <button
            key={s.url}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
              active
                ? "border-primary bg-primary/15 text-primary shadow-sm"
                : "border-border bg-card/80 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {s.isUser ? (
              <>
                <span className="text-[9px] font-bold uppercase tracking-wide text-primary/90">You</span>
                <span className={cn("tabular-nums font-bold", active ? "text-primary" : "text-foreground")}>
                  {s.overallScore != null ? s.overallScore.toFixed(1) : "—"}
                </span>
              </>
            ) : (
              <>
                <span className="truncate max-w-[128px]">{s.domain}</span>
                {s.overallScore != null && (
                  <span className={cn("tabular-nums font-bold", active ? "text-primary" : scoreClass(s.overallScore))}>
                    {s.overallScore.toFixed(1)}
                  </span>
                )}
                {delta != null && (
                  <span
                    className={cn(
                      "text-[10px] font-bold tabular-nums",
                      delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                )}
              </>
            )}
          </button>
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

type DecisionPanelTab = "insight" | "plan" | "impact" | "compete" | "scores";

const DECISION_PANEL_TABS: { id: DecisionPanelTab; label: string }[] = [
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
}) {
  const [panelTab, setPanelTab] = useState<DecisionPanelTab>("insight");
  const [heroOpen, setHeroOpen] = useState(true);
  const [behaviorOpen, setBehaviorOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

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
        "rounded-2xl border bg-card/95 backdrop-blur-sm overflow-hidden flex flex-col h-full max-h-[min(92vh,960px)] lg:sticky lg:top-4 z-10",
        fixMode ? "border-primary/50 shadow-md shadow-primary/10" : "border-primary/25 shadow-lg shadow-black/15"
      )}
    >
      {statusBanner && (
        <CompareHeaderStatus
          variant="card"
          userScore={statusBanner.userScore}
          rank={statusBanner.rank}
          totalRanked={statusBanner.totalRanked}
          losing={statusBanner.losing}
          conversion={statusBanner.conversion}
          mainIssue={statusBanner.mainIssue}
        />
      )}
      <div className="flex items-center justify-between border-b border-primary/15 bg-primary/5 px-3 py-2.5 gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Rocket className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary leading-tight">Compare</p>
            <p className="text-[10px] text-muted-foreground truncate">Insight · plan · impact · compete · scores</p>
          </div>
        </div>
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

      <div className="flex shrink-0 border-b border-border bg-muted/20 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Compare sections">
        {DECISION_PANEL_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={panelTab === id}
            onClick={() => setPanelTab(id)}
            className={cn(
              "shrink-0 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide border-b-2 transition-colors",
              panelTab === id
                ? "border-primary text-primary bg-background/80"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 overflow-y-auto text-xs space-y-3 flex-1 min-h-0">
        {panelTab === "insight" && (
          <div className="rounded-xl border border-red-500/40 bg-card/80 px-3 py-3 space-y-2 shadow-[inset_0_1px_0_0_rgba(248,113,113,0.12)]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-500 dark:text-red-400">Problem</p>
            <p className="text-sm text-foreground leading-snug">{threeSecondInsight.problem}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground pt-1">In 3 seconds</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{threeSecondInsight.result}</p>
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

            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
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
                      <span
                        className={cn(
                          "text-[9px] font-bold rounded px-1.5 py-0.5",
                          g.priority === "P1" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"
                        )}
                      >
                        {g.priority}
                      </span>
                      <p className="text-foreground mt-1">{g.problem}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 text-[11px] mt-0.5">{g.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {panelTab === "impact" && (
          <div className="rounded-xl border border-border p-3 space-y-2">
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
              <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Why risk is {conversion.risk}</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {riskWhyBut.why.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 pt-1">But</p>
              <p className="text-foreground leading-relaxed">{riskWhyBut.but}</p>
            </div>
          </div>
        )}

        {panelTab === "compete" && (
          <div className="space-y-3">
            {winNarrative && (!activeSite.isUser || stealThree.length > 0) && (
              <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/8 to-transparent p-3 space-y-3">
                <p className="text-[11px] font-bold text-primary flex items-center gap-1">
                  <Crown className="h-4 w-4" />
                  {winNarrative.competitorLabel} wins
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Their edge</p>
                    {winNarrative.winsBecause.slice(0, 4).map((line, i) => (
                      <p key={i} className="flex gap-1.5 text-foreground text-[11px] leading-snug">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
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
                    <p className="text-[10px] font-bold uppercase text-foreground mb-1">Fix this (your page)</p>
                    <p className="text-[11px] text-foreground leading-relaxed">{result.gaps[0].recommendation}</p>
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
          </div>
        )}

        {panelTab === "scores" && (
          <>
            {!fixMode && (
              <div className="rounded-lg border border-border/80 p-2.5 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Data coverage</p>
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
                    <span className="font-semibold text-foreground">
                      {sectionLabel}{" "}
                      {metricsHeadlineScore != null && (
                        <span className={cn("tabular-nums", sColor(metricsHeadlineScore))}>{metricsHeadlineScore.toFixed(1)}</span>
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
      </div>
    </div>
  );
}

/** Overlay tint for screenshot: compare | attention | heatmap | copy */
export function CompareOverlayLayer({
  mode,
  annotations,
}: {
  mode: "compare" | "attention" | "heatmap" | "copy";
  annotations: Array<{ top: number; height: number; score: number | null; label: string }>;
}) {
  if (mode === "compare") return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {mode === "attention" && (
        <>
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: "radial-gradient(ellipse 55% 35% at 50% 18%, rgba(250,204,21,0.45), transparent 70%)",
            }}
          />
          <div className="absolute left-[42%] top-[22%] w-px h-[38%] bg-gradient-to-b from-amber-400/80 to-transparent" />
          <div className="absolute bottom-[28%] right-[38%] rounded-full w-2 h-2 bg-primary shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
        </>
      )}
      {mode === "heatmap" &&
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
      {mode === "copy" && (
        <div
          className="absolute left-0 right-0 bg-slate-900/25 backdrop-blur-[0.5px] border-y border-cyan-500/20"
          style={{ top: "0%", height: "22%" }}
        />
      )}
    </div>
  );
}

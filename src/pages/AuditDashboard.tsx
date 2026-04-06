import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  FileDown,
  Share2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn, getDomain } from "@/lib/utils";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { downloadFullInsightsPdf } from "@/lib/fullReportPdf";
import { getHistoryCount } from "@/lib/analysisHistory";
import { PerformanceGauges } from "@/components/PerformanceGauges";
import { CompetitiveHeatmap } from "@/components/CompetitiveHeatmap";
import { CompetitiveEdgePanel } from "@/components/CompetitiveEdgePanel";
import { ActionPlan } from "@/components/ActionPlan";
import { UxHintsPanel } from "@/components/UxHintsPanel";
import { CopySuggestions } from "@/components/CopySuggestions";
import { CompetitiveCharts } from "@/components/CompetitiveCharts";
import { ScreenshotCompare } from "@/components/ScreenshotCompare";
import { BeforeAfterScoresChart } from "@/components/BeforeAfterScoresChart";
import { StructuredSynthesis } from "@/components/StructuredSynthesis";
import { parseSectionScores, ensureScore } from "@/lib/utils";
import { weightedOverallFromSections, projectRatings } from "@/lib/insightsProjection";
import { compareSitesList } from "@/lib/compareDecisionMetrics";
import { DashboardNavSidebar } from "@/components/DashboardNavSidebar";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import type { AnalysisResult } from "@/types/api";

// ─── Score helpers ──────────────────────────────────────────────────────────────

function perfScore(result: AnalysisResult): number | null {
  return result.performance?.user?.scores?.performance ?? null;
}

function lighthouseSeoScore(result: AnalysisResult): number | null {
  return result.performance?.user?.scores?.seo ?? null;
}

// ─── Tip generator ──────────────────────────────────────────────────────────────

interface Tip {
  text: string;
  impact: "High" | "Medium" | "Low";
}

function getSectionTip(id: string, result: AnalysisResult): Tip | null {
  switch (id) {
    case "overview": {
      const p1 = result.gaps?.find((g) => g.priority === "P1");
      if (p1) return { text: `Critical gap: ${p1.problem} — ${p1.recommendation}`, impact: "High" };
      return null;
    }
    case "compare":
      return null;
    case "performance": {
      const s = perfScore(result);
      if (s != null && s < 50)
        return {
          text: `Performance ${s}/100 — critical. Users leave before the page loads. Compress images and eliminate render-blocking scripts.`,
          impact: "High",
        };
      if (s != null && s < 70)
        return {
          text: `Performance ${s}/100 — needs improvement. Lazy-load images and defer non-critical JS to reach 70+.`,
          impact: "Medium",
        };
      return null;
    }
    case "competitors": {
      const comp = result.competitors?.[0];
      if (!comp) return null;
      return {
        text: `${result.competitors?.length} competitor${(result.competitors?.length ?? 0) > 1 ? "s" : ""} analysed. Scroll the heatmap to spot where they outscore you.`,
        impact: "Low",
      };
    }
    case "beat": {
      const edge = result.competitiveEdge?.[0]?.advantages?.[0];
      if (edge)
        return {
          text: `Quick win vs ${result.competitiveEdge![0].competitor}: ${edge.stealThis}`,
          impact: edge.effort === "Low" ? "High" : "Medium",
        };
      return null;
    }
    case "actions": {
      const w1 = result.actionPlan?.find((a) => a.week === 1 && a.impact === "High");
      if (w1)
        return {
          text: `Week 1 priority: ${w1.action}${w1.rationale ? ` — ${w1.rationale}` : ""}`,
          impact: "High",
        };
      return null;
    }
    case "hints": {
      const h = result.uxHints?.find((h) => h.impact === "High");
      if (h) return { text: `High-impact fix in ${h.section}: ${h.fix}`, impact: "High" };
      return null;
    }
    case "copy": {
      const s = result.copySuggestions?.[0];
      if (s?.suggestions?.[0])
        return {
          text: `Try this alternative for "${s.section}": "${s.suggestions[0]}"`,
          impact: "Medium",
        };
      return null;
    }
    default:
      return null;
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function TipCard({ tip }: { tip: Tip }) {
  const colors = {
    High: "border-red-500/40 bg-red-500/5 dark:bg-red-500/10",
    Medium: "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
    Low: "border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10",
  };
  const badge = {
    High: "bg-red-500/15 text-red-600 dark:text-red-400",
    Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Low: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  };
  return (
    <div className={cn("mb-6 rounded-2xl border p-4 flex items-start gap-3", colors[tip.impact])}>
      <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">AI Recommendation</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", badge[tip.impact])}>
            {tip.impact} impact
          </span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{tip.text}</p>
      </div>
    </div>
  );
}

function ScoreRing({ score, max = 10, size = 80 }: { score: number; max?: number; size?: number }) {
  const pct = Math.min(score / max, 1);
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = score >= 7.5 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="2.8" stroke="currentColor" className="text-border" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="2.8"
        stroke={color}
        strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function OverviewSection({ result, url }: { result: AnalysisResult; url: string }) {
  const userScores = useMemo(() => parseSectionScores(result.userAnalysis), [result]);
  const overallScore = useMemo(() => {
    const synth = result.synthesis?.overall_score;
    if (synth != null) return ensureScore(synth);
    return weightedOverallFromSections(userScores) ?? 7.0;
  }, [result, userScores]);

  const forecast = useMemo(() => projectRatings(overallScore), [overallScore]);
  const p1Gaps = (result.gaps ?? []).filter((g) => g.priority === "P1").slice(0, 3);
  const p2Gaps = (result.gaps ?? []).filter((g) => g.priority === "P2").slice(0, 2);
  const quickWins = (result.actionPlan ?? []).filter((a) => a.week === 1 && a.impact === "High").slice(0, 3);
  const perf = perfScore(result);
  const lhSeo = lighthouseSeoScore(result);

  return (
    <div className="space-y-6">
      {/* Hero metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Overall score */}
        <div className="col-span-2 md:col-span-1 rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <ScoreRing score={overallScore} />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums rotate-90">
              {overallScore.toFixed(1)}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Overall</p>
            <p className="text-2xl font-bold tabular-nums">{overallScore.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">out of 10</p>
          </div>
        </div>

        {/* Lighthouse SEO (PageSpeed category — not on-page HTML audit) */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Lighthouse SEO</p>
          {lhSeo != null ? (
            <>
              <p className={cn("text-2xl font-bold tabular-nums", lhSeo >= 90 ? "text-primary" : lhSeo >= 50 ? "text-amber-500" : "text-red-500")}>
                {lhSeo}
              </p>
              <p className="text-xs text-muted-foreground mt-1">/ 100 (PageSpeed)</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
        </div>

        {/* Performance */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Performance</p>
          {perf != null ? (
            <>
              <p className={cn("text-2xl font-bold tabular-nums", perf >= 90 ? "text-primary" : perf >= 70 ? "text-amber-500" : "text-red-500")}>
                {perf}
              </p>
              <p className="text-xs text-muted-foreground mt-1">/ 100 (Lighthouse)</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
        </div>

        {/* Competitors */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Competitors</p>
          <p className="text-2xl font-bold">{result.competitors?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">analysed</p>
        </div>
      </div>

      {/* Forecast bar */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Score Trajectory</span>
          <span className="text-xs text-muted-foreground">— projected after applying recommendations</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Now", value: forecast.current, color: "text-foreground" },
            { label: "~30 days", value: forecast.days30, color: "text-primary" },
            { label: "~90 days", value: forecast.days90, color: "text-primary" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-muted/30 px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</p>
              <p className={cn("text-xl font-bold tabular-nums mt-1", c.color)}>{c.value.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">/ 10</p>
            </div>
          ))}
        </div>
        {forecast.summary && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{forecast.summary}</p>}
      </div>

      {/* Gaps + Quick wins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Critical gaps */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Critical Gaps
          </p>
          {[...p1Gaps, ...p2Gaps].length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical gaps identified.</p>
          ) : (
            <ul className="space-y-2">
              {[...p1Gaps, ...p2Gaps].map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", g.priority === "P1" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                    {g.priority}
                  </span>
                  <span className="text-foreground">{g.problem}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick wins */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Week 1 Quick Wins
          </p>
          {quickWins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Check Action Plan for detailed steps.</p>
          ) : (
            <ul className="space-y-2">
              {quickWins.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-primary font-bold text-xs">→</span>
                  <span className="text-foreground">{a.action}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Before/After chart */}
      {userScores && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold text-sm text-foreground mb-1">Now vs. After Improvements</p>
          <p className="text-xs text-muted-foreground mb-4">Section-level estimated impact after shipping recommendations.</p>
          <BeforeAfterScoresChart userScores={userScores} improvementFactor={0.65} />
        </div>
      )}

      {/* Synthesis */}
      {result.report && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold text-sm text-foreground mb-4">AI Analysis Summary</p>
          <StructuredSynthesis report={result.report} gaps={result.gaps} />
        </div>
      )}
    </div>
  );
}

function MovedToCompareMessage() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center max-w-lg mx-auto">
      <p className="text-sm text-muted-foreground leading-relaxed">
        This analysis detail now lives in <span className="font-semibold text-foreground">Compare</span> — use the right panel tabs (Overview, Insight, Plan, Impact, Compete, Scores).
      </p>
    </div>
  );
}

function SectionContent({
  id,
  result,
  url,
  compareSiteIdx,
  onCompareSiteIdxChange,
  compareToolbarSlot,
  compareLensMenuSlot,
}: {
  id: string;
  result: AnalysisResult;
  url: string;
  compareSiteIdx?: number;
  onCompareSiteIdxChange?: (idx: number) => void;
  compareToolbarSlot?: HTMLElement | null;
}) {
  switch (id) {
    case "overview":
      return <OverviewSection result={result} url={url} />;
    case "compare":
      return (
        <ScreenshotCompare
          result={result}
          url={url}
          compareSiteIdx={compareSiteIdx}
          onCompareSiteIdxChange={onCompareSiteIdxChange}
          compareToolbarSlot={compareToolbarSlot}
        />
      );
    case "performance":
      return (
        <PerformanceGauges
          data={result.performance ?? { user: null, competitors: [] }}
        />
      );
    case "ux":
    case "cta":
    case "readability":
    case "practices":
    case "journey":
    case "patterns":
      return <MovedToCompareMessage />;
    case "competitors":
      return result.competitors?.length ? (
        <div className="space-y-6">
          <CompetitiveCharts
            userUrl={url}
            userAnalysis={result.userAnalysis}
            competitors={result.competitors}
          />
          <CompetitiveHeatmap userUrl={url} result={result} />
        </div>
      ) : (
        <EmptyState label="No competitors were analysed." />
      );
    case "beat":
      return (result.competitiveEdge?.length ?? 0) > 0 ? (
        <CompetitiveEdgePanel entries={result.competitiveEdge!} />
      ) : (
        <EmptyState label="Competitive edge data not available." />
      );
    case "actions":
      return (result.actionPlan?.length ?? 0) > 0 ? (
        <ActionPlan items={result.actionPlan!} />
      ) : (
        <EmptyState label="Action plan data not available." />
      );
    case "hints":
      return (result.uxHints?.length ?? 0) > 0 ? (
        <UxHintsPanel hints={result.uxHints!} />
      ) : (
        <EmptyState label="UX hints data not available." />
      );
    case "copy":
      return (result.copySuggestions?.length ?? 0) > 0 ? (
        <CopySuggestions suggestions={result.copySuggestions!} />
      ) : (
        <EmptyState label="Copy suggestions not available." />
      );
    default:
      return <EmptyState label="Select a section from the sidebar." />;
  }
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  compare: "Compare",
  performance: "Performance",
  competitors: "Competitors",
  beat: "Beat Competitors",
  monitor: "Monitor",
  actions: "Action Plan",
  hints: "UX Hints",
  copy: "Copy Ideas",
  history: "History",
};

// ─── Main export ────────────────────────────────────────────────────────────────

export default function AuditDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSharedView = searchParams.get("shared") === "true";
  const payload = readFullInsightsPayload();
  const [activeSection, setActiveSection] = useState(() => {
    const s = new URLSearchParams(window.location.search).get("section");
    return s && FULL_INSIGHTS_SECTION_IDS.has(s) ? s : "compare";
  });
  const [compareSiteIdx, setCompareSiteIdx] = useState(0);
  const compareToolbarHostRef = useRef<HTMLDivElement | null>(null);
  const [compareToolbarHost, setCompareToolbarHost] = useState<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const historyCount = getHistoryCount();

  useEffect(() => {
    const s = searchParams.get("section");
    if (s && FULL_INSIGHTS_SECTION_IDS.has(s)) setActiveSection(s);
  }, [searchParams]);

  useEffect(() => {
    if (activeSection !== "compare") setCompareSiteIdx(0);
  }, [activeSection]);

  useLayoutEffect(() => {
    if (activeSection !== "compare") {
      setCompareToolbarHost(null);
      return;
    }
    setCompareToolbarHost(compareToolbarHostRef.current);
  }, [activeSection]);

  if (!payload?.result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-16">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">No report loaded</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            This page shows your audit dashboard after an analysis. Run a check from the home page — your results open
            here automatically.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
          >
            Start analysis
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  const { url, result, planName, paidAt } = payload;

  const handleSidebarSelect = (id: string) => {
    if (id === "history") {
      navigate("/history");
      return;
    }
    if (id === "monitor") {
      navigate("/monitor");
      return;
    }
    setActiveSection(id);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("section", id);
        return p;
      },
      { replace: true }
    );
  };

  const overallScore = useMemo(() => {
    const s = result.synthesis?.overall_score;
    if (s != null) return ensureScore(s);
    const userScores = parseSectionScores(result.userAnalysis);
    return weightedOverallFromSections(userScores) ?? 7.0;
  }, [result]);

  const compareTabSites = useMemo(() => compareSitesList(result, url), [result, url]);

  const tip = getSectionTip(activeSection, result);

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await downloadFullInsightsPdf(payload);
    } catch (e) {
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShare = () => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("shared", "true");
      void navigator.clipboard.writeText(u.toString());
      toast.success("Report link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardNavSidebar
        activeNavId={activeSection}
        onSelect={handleSidebarSelect}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        reportContext={{ url, overallScore, createdAt: paidAt }}
        result={result}
        historyCount={historyCount}
        onNewAnalysis={() => navigate("/")}
        compareSiteTabs={
          compareTabSites.length > 0
            ? {
                sites: compareTabSites,
                activeIdx: Math.min(compareSiteIdx, Math.max(0, compareTabSites.length - 1)),
                onSelect: setCompareSiteIdx,
                analysisResult: result,
              }
            : null
        }
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar — Compare shows competitive status instead of domain breadcrumb */}
        <header
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-background/90 backdrop-blur px-4 py-2",
            activeSection === "compare" ? "min-h-14" : "h-14 min-h-14 justify-end"
          )}
        >
          {activeSection === "compare" && (
            <div
              ref={compareToolbarHostRef}
              className="flex min-h-0 min-w-0 flex-1 basis-full items-center overflow-x-auto pb-0.5 sm:basis-auto sm:px-1"
            />
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {activeSection === "compare" && (
              <span className="hidden h-4 w-px shrink-0 bg-border/70 sm:block" aria-hidden />
            )}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share report"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={pdfLoading}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{pdfLoading ? "Building…" : "Export PDF"}</span>
            </button>
          </div>
        </header>

        {isSharedView && (
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-50">
            <span className="min-w-0">
              👁 You&apos;re viewing a shared report · Run your own analysis →
            </span>
            <Link
              to="/"
              className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        )}

        {/* Section content — Compare uses full main width so screenshot + insights can sit side-by-side */}
        <main className="flex-1 overflow-y-auto px-4 py-5 md:py-7">
          <div
            className={cn(
              activeSection === "compare" ? "w-full max-w-none" : "max-w-5xl mx-auto"
            )}
          >
            {activeSection !== "compare" && (
              <>
                <h1 className="text-lg font-bold text-foreground mb-1">
                  {SECTION_LABELS[activeSection] ?? activeSection}
                </h1>
                <p className="text-xs text-muted-foreground mb-5">
                  {getDomain(url)} · {planName}
                </p>
              </>
            )}
            {tip && <TipCard tip={tip} />}
            <SectionContent
              id={activeSection}
              result={result}
              url={url}
              compareSiteIdx={activeSection === "compare" ? compareSiteIdx : undefined}
              onCompareSiteIdxChange={activeSection === "compare" ? setCompareSiteIdx : undefined}
              compareToolbarSlot={activeSection === "compare" ? compareToolbarHost : undefined}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

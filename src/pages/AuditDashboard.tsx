import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  LayoutDashboard,
  Zap,
  ScanEye,
  Eye,
  ShieldCheck,
  BookOpen,
  Users,
  Trophy,
  ListChecks,
  Map,
  Grid3x3,
  Target,
  Lightbulb,
  PenTool,
  ChevronLeft,
  ChevronRight,
  Bell,
  Home,
  FileDown,
  Share2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn, getDomain } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { downloadFullInsightsPdf } from "@/lib/fullReportPdf";
import { getHistoryCount } from "@/lib/analysisHistory";
import { PerformanceGauges } from "@/components/PerformanceGauges";
import { UxSignalsPanel } from "@/components/UxSignalsPanel";
import { CtaTrustPanel } from "@/components/CtaTrustPanel";
import { ReadabilityPanel } from "@/components/ReadabilityPanel";
import { CompetitiveHeatmap } from "@/components/CompetitiveHeatmap";
import { CompetitiveEdgePanel } from "@/components/CompetitiveEdgePanel";
import { BestPracticesChecklist } from "@/components/BestPracticesChecklist";
import { CustomerJourneyMap } from "@/components/CustomerJourneyMap";
import { DesignPatterns } from "@/components/DesignPatterns";
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
import { CompareHeaderSiteTabs } from "@/components/CompareDecisionPanels";
import type { AnalysisResult } from "@/types/api";

// ─── Nav config ────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "compare", label: "Compare", icon: ScanEye },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "performance", label: "Performance", icon: Zap, group: "Technical" },
  { id: "ux", label: "UX Quality", icon: Eye, group: "UX" },
  { id: "cta", label: "CTA & Trust", icon: ShieldCheck, group: "UX" },
  { id: "readability", label: "Readability", icon: BookOpen, group: "UX" },
  { id: "competitors", label: "Competitors", icon: Users, group: "Competitive" },
  { id: "beat", label: "Beat Competitors", icon: Trophy, group: "Competitive" },
  { id: "practices", label: "Best Practices", icon: ListChecks, group: "Growth" },
  { id: "journey", label: "Customer Journey", icon: Map, group: "Growth" },
  { id: "patterns", label: "Design Patterns", icon: Grid3x3, group: "Growth" },
  { id: "actions", label: "Action Plan", icon: Target, group: "Growth" },
  { id: "hints", label: "UX Hints", icon: Lightbulb, group: "Growth" },
  { id: "copy", label: "Copy Ideas", icon: PenTool, group: "Growth" },
];

const NAV_GROUPS = ["Technical", "UX", "Competitive", "Growth"];

// ─── Score helpers ──────────────────────────────────────────────────────────────

function perfScore(result: AnalysisResult): number | null {
  return result.performance?.user?.scores?.performance ?? null;
}

function lighthouseSeoScore(result: AnalysisResult): number | null {
  return result.performance?.user?.scores?.seo ?? null;
}

function getNavBadge(id: string, result: AnalysisResult): { text: string; variant: "good" | "warn" | "bad" } | null {
  if (id === "performance") {
    const s = perfScore(result);
    if (s == null) return null;
    return { text: String(s), variant: s >= 70 ? "good" : s >= 50 ? "warn" : "bad" };
  }
  if (id === "competitors") {
    const n = result.competitors?.length ?? 0;
    if (!n) return null;
    return { text: `${n}`, variant: "good" };
  }
  return null;
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
    case "ux": {
      const flags = result.uxSignals?.accessibilityFlags;
      if (flags?.length)
        return { text: `Accessibility issue: ${flags[0]}. Fixing this broadens reach and satisfies WCAG standards.`, impact: "High" };
      if (result.uxSignals?.visualHierarchy === "weak" || result.uxSignals?.visualHierarchy === "poor")
        return { text: "Visual hierarchy is weak — users can't quickly identify what to do next. Increase heading contrast and tighten spacing.", impact: "Medium" };
      return null;
    }
    case "cta": {
      const hint = result.ctaTrust?.frictionReducers?.[0];
      if (hint) return { text: `Quick win: add "${hint}" near your CTA to reduce conversion friction.`, impact: "High" };
      return null;
    }
    case "readability": {
      const grade = result.readability?.user?.fleschKincaidGrade;
      if (grade != null && grade > 12)
        return {
          text: `Reading grade ${grade.toFixed(1)} — too complex. Aim for grade 7-9 to maximise comprehension across your audience.`,
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
    case "practices": {
      const fail = result.bestPractices?.find((p) => !p.pass && p.impact === "High");
      if (fail) return { text: `Missing high-impact practice: "${fail.label}". ${fail.note ?? ""}`, impact: "High" };
      return null;
    }
    case "journey": {
      const missing = result.journeyMap?.find((s) => s.status === "missing");
      if (missing)
        return {
          text: `Journey stage "${missing.stage}" is not addressed. Users drop off here — add dedicated content for this phase.`,
          impact: "High",
        };
      return null;
    }
    case "patterns": {
      const absent = result.designPatterns?.find((p) => !p.present);
      if (absent)
        return { text: `Pattern "${absent.label}" is not implemented. ${absent.note ?? "Consider adding it."}`, impact: "Medium" };
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
              <p className={cn("text-2xl font-bold tabular-nums", lhSeo >= 90 ? "text-emerald-500" : lhSeo >= 50 ? "text-amber-500" : "text-red-500")}>
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
              <p className={cn("text-2xl font-bold tabular-nums", perf >= 90 ? "text-emerald-500" : perf >= 70 ? "text-amber-500" : "text-red-500")}>
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
            { label: "~90 days", value: forecast.days90, color: "text-emerald-500" },
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
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Week 1 Quick Wins
          </p>
          {quickWins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Check Action Plan for detailed steps.</p>
          ) : (
            <ul className="space-y-2">
              {quickWins.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-emerald-500 font-bold text-xs">→</span>
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

function SectionContent({
  id,
  result,
  url,
  compareSiteIdx,
  onCompareSiteIdxChange,
}: {
  id: string;
  result: AnalysisResult;
  url: string;
  compareSiteIdx?: number;
  onCompareSiteIdxChange?: (idx: number) => void;
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
        />
      );
    case "performance":
      return result.performance ? (
        <PerformanceGauges data={result.performance} />
      ) : (
        <EmptyState label="Performance data not available." />
      );
    case "ux":
      return result.uxSignals ? (
        <UxSignalsPanel signals={result.uxSignals} />
      ) : (
        <EmptyState label="UX signals not available for this analysis." />
      );
    case "cta":
      return result.ctaTrust ? (
        <CtaTrustPanel data={result.ctaTrust} />
      ) : (
        <EmptyState label="CTA & trust data not available." />
      );
    case "readability":
      return result.readability ? (
        <ReadabilityPanel data={result.readability} />
      ) : (
        <EmptyState label="Readability data not available." />
      );
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
    case "practices":
      return (result.bestPractices?.length ?? 0) > 0 ? (
        <BestPracticesChecklist items={result.bestPractices!} />
      ) : (
        <EmptyState label="Best practices data not available." />
      );
    case "journey":
      return (result.journeyMap?.length ?? 0) > 0 ? (
        <CustomerJourneyMap stages={result.journeyMap!} />
      ) : (
        <EmptyState label="Customer journey data not available." />
      );
    case "patterns":
      return (result.designPatterns?.length ?? 0) > 0 ? (
        <DesignPatterns patterns={result.designPatterns!} />
      ) : (
        <EmptyState label="Design patterns data not available." />
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
  ux: "UX Quality",
  cta: "CTA & Trust",
  readability: "Readability",
  competitors: "Competitors",
  beat: "Beat Competitors",
  practices: "Best Practices",
  journey: "Customer Journey",
  patterns: "Design Patterns",
  actions: "Action Plan",
  hints: "UX Hints",
  copy: "Copy Ideas",
};

// ─── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  result: AnalysisResult;
  url: string;
  overallScore: number;
}

function Sidebar({ active, onSelect, collapsed, onToggle, result, url, overallScore }: SidebarProps) {
  const domain = getDomain(url);
  const scoreColor =
    overallScore >= 7.5 ? "text-emerald-500" : overallScore >= 5 ? "text-amber-500" : "text-red-500";

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 h-full border-r border-border bg-card transition-all duration-200 overflow-hidden",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo + collapse */}
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border px-3 gap-2", !collapsed && "justify-between")}>
        {!collapsed && (
          <Link to="/" className="font-bold text-sm text-primary tracking-tight truncate">
            LandingLens
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Domain + score pill */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-border shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Analysing</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground truncate">{domain}</p>
            <span className={cn("text-sm font-bold tabular-nums shrink-0", scoreColor)}>
              {overallScore.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide" aria-label="Dashboard sections">
        {/* Compare & Overview (primary) */}
        {NAV_ITEMS.filter((n) => !n.group).map((item) => (
          <NavButton key={item.id} item={item} active={active} collapsed={collapsed} onSelect={onSelect} badge={getNavBadge(item.id, result)} />
        ))}

        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              {!collapsed && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  {group}
                </p>
              )}
              {collapsed && <div className="my-1 mx-3 h-px bg-border/50" />}
              {items.map((item) => (
                <NavButton key={item.id} item={item} active={active} collapsed={collapsed} onSelect={onSelect} badge={getNavBadge(item.id, result)} />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="shrink-0 border-t border-border py-2">
        <SidebarAction
          icon={Bell}
          label="Monitor"
          collapsed={collapsed}
          onClick={() => window.open("/monitor", "_self")}
        />
        <SidebarAction
          icon={Home}
          label="New Analysis"
          collapsed={collapsed}
          onClick={() => window.open("/", "_self")}
        />
      </div>
    </aside>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onSelect,
  badge,
}: {
  item: NavItem;
  active: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
  badge: { text: string; variant: "good" | "warn" | "bad" } | null;
}) {
  const Icon = item.icon;
  const isActive = active === item.id;
  const badgeColor = badge
    ? badge.variant === "good"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : badge.variant === "warn"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-red-500/15 text-red-600 dark:text-red-400"
    : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      title={collapsed ? item.label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {badge && (
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold", badgeColor)}>
              {badge.text}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function SidebarAction({
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────

export default function AuditDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSharedView = searchParams.get("shared") === "true";
  const payload = readFullInsightsPayload();
  const [activeSection, setActiveSection] = useState("compare");
  const [compareSiteIdx, setCompareSiteIdx] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const historyCount = getHistoryCount();

  useEffect(() => {
    if (activeSection !== "compare") setCompareSiteIdx(0);
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

  const overallScore = useMemo(() => {
    const s = result.synthesis?.overall_score;
    if (s != null) return ensureScore(s);
    const userScores = parseSectionScores(result.userAnalysis);
    return weightedOverallFromSections(userScores) ?? 7.0;
  }, [result]);

  const compareTabSites = useMemo(
    () => (activeSection === "compare" ? compareSitesList(result, url) : []),
    [activeSection, result, url]
  );

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
      <Sidebar
        active={activeSection}
        onSelect={setActiveSection}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        result={result}
        url={url}
        overallScore={overallScore}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar — Compare shows competitive status instead of domain breadcrumb */}
        <header
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 md:px-6 min-h-14",
            activeSection === "compare" && "items-center bg-background/90 backdrop-blur border-border",
            activeSection !== "compare" && "h-14 items-center bg-background/90 backdrop-blur border-border"
          )}
        >
          {activeSection === "compare" && compareTabSites.length > 0 ? (
            <div className="flex-1 min-w-0 flex items-center">
              <CompareHeaderSiteTabs
                sites={compareTabSites}
                activeIdx={Math.min(compareSiteIdx, Math.max(0, compareTabSites.length - 1))}
                onSelect={setCompareSiteIdx}
                analysisResult={result}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 flex-1">
              <span className="text-foreground font-semibold truncate">{getDomain(url)}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="truncate">{SECTION_LABELS[activeSection] ?? activeSection}</span>
            </div>
          )}
          <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0 tabular-nums" title="Report created">
            Created {new Date(paidAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate("/", { state: { openHistory: true } })}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              History
              {historyCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {historyCount}
                </span>
              )}
            </button>
            <ThemeToggle className="shrink-0" />
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share Report</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:brightness-110 disabled:opacity-60 disabled:pointer-events-none transition-all"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{pdfLoading ? "Building…" : "Export PDF"}</span>
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
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
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
            />
          </div>
        </main>
      </div>
    </div>
  );
}

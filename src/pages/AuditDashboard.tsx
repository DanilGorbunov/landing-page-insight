import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Loader2,
  X,
} from "lucide-react";
import { cn, getDomain } from "@/lib/utils";
import { readFullInsightsPayload, writeFullInsightsPayload } from "@/lib/reportSession";
import { getAuditPage } from "@/lib/auditPageStore";
import { auditPathForUrl, auditSlugFromUrl, auditSectionHref, DEFAULT_AUDIT_SECTION } from "@/lib/auditSlug";
import { fetchSharedAuditBySlug } from "@/lib/fetchSharedAudit";
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
import { DashboardPageShell } from "@/components/DashboardPageShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import { resolveDashboardNavHref } from "@/lib/dashboardNavHref";
import type { AnalysisResult } from "@/types/api";

const SHARED_REPORT_BANNER_DISMISSED_KEY = "ll_shared_report_banner_dismissed";

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
      const n = result.competitors?.length ?? 0;
      if (n > 0)
        return {
          text: `${n} competitor${n > 1 ? "s" : ""} analysed. Scroll the heatmap to spot where they outscore you.`,
          impact: "Low",
        };
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

  const domain = getDomain(url);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Report overview</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            At-a-glance scores, gaps, and projected trajectory for{" "}
            <span className="font-medium text-foreground">{domain}</span>. Use{" "}
            <span className="font-medium text-foreground">Compare</span> for screenshots, zones, and the insight panel.
          </p>
          {result.siteType ? (
            <p className="mt-2">
              <span className="inline-flex rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Site type: {result.siteType}
              </span>
            </p>
          ) : null}
        </div>
        <Link
          to={auditSectionHref("compare", url)}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 sm:self-center"
        >
          Open Compare
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {/* Hero metrics row (competitor charts live below in Competitive landscape) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
      </div>

      {/* Former “Competitors” tab: radar, bars, heatmap — now part of Overview */}
      {result.competitors && result.competitors.length > 0 ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Competitive landscape</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Shape and section scores vs each analysed competitor — same charts as before, now on Overview.
            </p>
          </div>
          <CompetitiveCharts
            userUrl={url}
            userAnalysis={result.userAnalysis}
            competitors={result.competitors}
          />
          <CompetitiveHeatmap userUrl={url} result={result} />
        </div>
      ) : null}

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
            <p className="text-sm text-muted-foreground">Check Plans for detailed steps.</p>
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
        This analysis detail now lives in <span className="font-semibold text-foreground">Compare</span> — use the right panel tabs (Simulate, Insight, Scores).
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
  beat: "Beat Competitors",
  monitor: "Monitor",
  actions: "Plans",
  hints: "UX Hints",
  copy: "Copy Ideas",
  history: "History",
};

// ─── Main export ────────────────────────────────────────────────────────────────

export default function AuditDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const slug =
    slugParam !== undefined && slugParam !== ""
      ? (() => {
          try {
            return decodeURIComponent(slugParam);
          } catch {
            return slugParam;
          }
        })()
      : undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const isSharedView = searchParams.get("shared") === "true";
  const [sharedBannerDismissed, setSharedBannerDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(SHARED_REPORT_BANNER_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissSharedBanner = useCallback(() => {
    try {
      sessionStorage.setItem(SHARED_REPORT_BANNER_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
    setSharedBannerDismissed(true);
  }, []);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [sharedFetch, setSharedFetch] = useState<"idle" | "loading" | "ok" | "missing">("idle");
  const payload = useMemo(() => {
    const sp = readFullInsightsPayload();
    if (!slug) return sp;
    const normalized = slug.toLowerCase();
    const fromStore = slugParam ? getAuditPage(slugParam) : null;
    if (fromStore?.result) return fromStore;
    if (sp?.result && auditSlugFromUrl(sp.url) === normalized) return sp;
    return null;
  }, [slug, slugParam, sessionRevision]);
  const [activeSection, setActiveSection] = useState(() => {
    const s = new URLSearchParams(window.location.search).get("section");
    if (s === "competitors") return "overview";
    return s && FULL_INSIGHTS_SECTION_IDS.has(s) ? s : "compare";
  });
  const [compareSiteIdx, setCompareSiteIdx] = useState(0);
  const [reauditDialogOpen, setReauditDialogOpen] = useState(false);

  useEffect(() => {
    const s = searchParams.get("section");
    if (s === "competitors") {
      setActiveSection("overview");
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("section", "overview");
          return p;
        },
        { replace: true }
      );
      return;
    }
    if (s === DEFAULT_AUDIT_SECTION) {
      setActiveSection(DEFAULT_AUDIT_SECTION);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("section");
          return p;
        },
        { replace: true }
      );
      return;
    }
    if (s && FULL_INSIGHTS_SECTION_IDS.has(s)) {
      setActiveSection(s);
      return;
    }
    setActiveSection(DEFAULT_AUDIT_SECTION);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (activeSection !== "compare") setCompareSiteIdx(0);
  }, [activeSection]);

  useEffect(() => {
    if (location.pathname !== "/full-insights") return;
    const p = readFullInsightsPayload();
    if (!p?.result) return;
    const q = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    navigate(auditPathForUrl(p.url, q), { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!slug || !slugParam) return;
    const fromStore = getAuditPage(slugParam);
    if (fromStore?.result) {
      writeFullInsightsPayload(fromStore);
      setSessionRevision((n) => n + 1);
    }
  }, [slug, slugParam]);

  useEffect(() => {
    if (!slug || !slugParam) {
      setSharedFetch("idle");
      return;
    }
    const normalized = slug.toLowerCase();
    const fromStore = getAuditPage(slugParam);
    if (fromStore?.result) {
      setSharedFetch("ok");
      return;
    }
    const sp = readFullInsightsPayload();
    if (sp?.result && auditSlugFromUrl(sp.url) === normalized) {
      setSharedFetch("ok");
      return;
    }

    const ac = new AbortController();
    setSharedFetch("loading");
    fetchSharedAuditBySlug(normalized, ac.signal)
      .then((data) => {
        if (data?.result) {
          writeFullInsightsPayload(data);
          setSessionRevision((n) => n + 1);
          setSharedFetch("ok");
        } else {
          setSharedFetch("missing");
        }
      })
      .catch((e) => {
        if ((e as Error)?.name === "AbortError") return;
        setSharedFetch("missing");
      });

    return () => ac.abort();
  }, [slug, slugParam]);

  /** Reset competitor column when the loaded report URL changes (must run before any early return — hooks rule). */
  useEffect(() => {
    if (!payload?.result) return;
    setCompareSiteIdx(0);
  }, [payload?.url]);

  if (!payload?.result) {
    const missingSlug = Boolean(slug);
    const loadingShared = missingSlug && (sharedFetch === "idle" || sharedFetch === "loading");
    if (loadingShared) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-label="Loading audit" />
          <p className="mt-4 text-sm text-muted-foreground">Loading shared audit…</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-16">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            {missingSlug ? "Audit not found" : "No report loaded"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {missingSlug
              ? `No saved report for “${slug}” on the server yet. Run an analysis for that site (same backend your app uses) — the latest result becomes the shareable /audit/ link.`
              : "This page shows your audit dashboard after an analysis. Run a check from the home page — your results open here automatically."}
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

  const resolveNavHref = useCallback(
    (id: string) =>
      resolveDashboardNavHref(id, {
        mode: "audit",
        pathname: location.pathname,
        searchParams: new URLSearchParams(location.search),
      }),
    [location.pathname, location.search]
  );

  const overallScore = useMemo(() => {
    const s = result.synthesis?.overall_score;
    if (s != null) return ensureScore(s);
    const userScores = parseSectionScores(result.userAnalysis);
    return weightedOverallFromSections(userScores) ?? 7.0;
  }, [result]);

  const tip = getSectionTip(activeSection, result);

  const handleReaudit = () => setReauditDialogOpen(true);

  const confirmReaudit = () => {
    toast.info("Starting full re-audit…");
    navigate("/", { state: { startFreshAnalysis: { url } } });
  };

  return (
    <>
      <AlertDialog open={reauditDialogOpen} onOpenChange={setReauditDialogOpen}>
        <AlertDialogContent className="border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Re-audit</AlertDialogTitle>
            <AlertDialogDescription className="text-balance">
              Run a full new analysis from scratch? The site will be scraped again and competitors discovered fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReaudit}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DashboardPageShell
        onReaudit={handleReaudit}
        sidebarProps={{
          activeNavId: activeSection,
          resolveNavHref,
          sidebarNavReplace: true,
          reportContext: { url, overallScore, createdAt: paidAt },
          result,
          onNewAnalysis: () => navigate("/"),
          hideSidebarNewAnalysis:
            activeSection === "compare" || activeSection === "overview",
        }}
        banner={
          isSharedView && !sharedBannerDismissed ? (
            <div className="flex shrink-0 items-start gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-50 sm:items-center">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
                <span className="min-w-0">
                  👁 You&apos;re viewing a shared report · Run your own analysis →
                </span>
                <Link
                  to="/"
                  className="inline-flex shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
                >
                  Get started
                </Link>
              </div>
              <button
                type="button"
                onClick={dismissSharedBanner}
                className="shrink-0 rounded-md p-1 text-amber-900/70 transition-colors hover:bg-amber-500/20 hover:text-amber-950 dark:text-amber-100/80 dark:hover:bg-amber-500/15 dark:hover:text-amber-50"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : undefined
        }
        mainClassName={cn(
          "px-4",
          activeSection === "compare" ? "pb-0" : "pb-5 md:pb-7",
          activeSection === "compare"
            ? "flex min-h-0 flex-col overflow-hidden pt-0"
            : "overflow-y-auto pt-4"
        )}
      >
        <div
          className={cn(
            activeSection === "compare" ? "flex min-h-0 w-full max-w-none flex-1 flex-col" : "mx-auto max-w-5xl"
          )}
        >
          {activeSection !== "compare" && (
            <>
              <h1 className="mb-1 text-lg font-bold text-foreground">
                {SECTION_LABELS[activeSection] ?? activeSection}
              </h1>
              <p className="mb-5 text-xs text-muted-foreground">
                {getDomain(url)} · {planName}
              </p>
            </>
          )}
          {tip && (
            <div className={cn(activeSection === "compare" && "shrink-0")}>
              <TipCard tip={tip} />
            </div>
          )}
          {activeSection === "compare" ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <SectionContent
                id={activeSection}
                result={result}
                url={url}
                compareSiteIdx={compareSiteIdx}
                onCompareSiteIdxChange={setCompareSiteIdx}
              />
            </div>
          ) : (
            <SectionContent
              id={activeSection}
              result={result}
              url={url}
              compareSiteIdx={undefined}
              onCompareSiteIdxChange={undefined}
            />
          )}
        </div>
      </DashboardPageShell>
    </>
  );
}

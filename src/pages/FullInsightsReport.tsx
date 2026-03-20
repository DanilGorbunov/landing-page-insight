import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, FileDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { getHistoryCount, enableFullInsightsHistoryPersistence } from "@/lib/analysisHistory";
import { downloadFullInsightsPdf } from "@/lib/fullReportPdf";
import {
  getDomain,
  cn,
  parseSectionScores,
  getCompetitorOverallScore,
  ensureScore,
  analysisToBullets,
  stripMarkdownFormatting,
  inferScoreFromAnalysis,
  parseScoreFromReport,
  type SectionScoreKey,
} from "@/lib/utils";
import { itemVariants } from "@/lib/motion";
import {
  SectionCard,
  SiteSectionMetricsCard,
  SECTION_TO_BACKEND,
  SECTION_TABS,
  type SectionTab,
} from "@/components/ReportScreen";
import { CompetitiveCharts } from "@/components/CompetitiveCharts";
import { weightedOverallFromSections, projectRatings } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";
import { BeforeAfterScoresChart } from "@/components/BeforeAfterScoresChart";
import { StructuredSynthesis } from "@/components/StructuredSynthesis";
import {
  ReportEyebrow,
  ReportJumpNav,
  ReportMetaChips,
  ReportPageTitle,
  ReportSection,
  ReportSurface,
} from "@/components/report/ReportLayout";

const BACKEND_SECTIONS: { key: keyof AnalysisResult["userAnalysis"]; label: string }[] = [
  { key: "hero", label: "Hero" },
  { key: "value proposition", label: "Value Prop" },
  { key: "features", label: "Features" },
  { key: "social proof", label: "Social Proof" },
  { key: "CTA", label: "CTA" },
];

const RADAR_ORDER: SectionScoreKey[] = ["hero", "value_prop", "features", "social_proof", "cta"];

function snippet(text: string | undefined, max = 220): string {
  if (!text) return "—";
  const t = stripMarkdownFormatting(text).replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function improvementLines(analysis: Record<string, string> | undefined, sectionKey: string): string[] {
  const raw = analysis?.[sectionKey];
  if (!raw) return [];
  const bullets = analysisToBullets(raw, 6);
  const fails = bullets.filter((b) => !b.pass).map((b) => b.text);
  if (fails.length > 0) return fails.slice(0, 4);
  return [snippet(raw, 160)];
}

export default function FullInsightsReport() {
  const navigate = useNavigate();
  const payload = useMemo(() => readFullInsightsPayload(), []);
  const [activeSection, setActiveSection] = useState<SectionTab>("Hero");
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    if (!payload?.result) {
      navigate("/", { replace: true });
    }
  }, [payload?.result, navigate]);

  useEffect(() => {
    if (!payload?.result) return;
    enableFullInsightsHistoryPersistence();
    setHistoryCount(getHistoryCount());
  }, [payload?.result]);

  const jumpLinks = useMemo(() => {
    const links: { href: string; label: string }[] = [
      { href: "#forecast", label: "Forecast" },
      { href: "#scores", label: "Scores" },
      { href: "#recommendations", label: "Recommendations" },
    ];
    if (payload?.result?.gaps && payload.result.gaps.length > 0) {
      links.push({ href: "#gaps", label: "Gaps" });
    }
    links.push({ href: "#synthesis", label: "Synthesis" });
    const hasChartData = Boolean(
      payload?.result?.userAnalysis || (payload?.result?.competitors?.length ?? 0) > 0
    );
    if (hasChartData) links.push({ href: "#appendix", label: "Deep dive" });
    return links;
  }, [payload?.result]);

  if (!payload?.result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Redirecting…
      </div>
    );
  }

  const { url, result, planName, paidAt } = payload;
  const domain = getDomain(url);
  const userScores = parseSectionScores(result.userAnalysis);
  const weighted = userScores ? weightedOverallFromSections(userScores) : null;
  const baseOverall =
    weighted ??
    result.synthesis?.overall_score ??
    ensureScore(getCompetitorOverallScore(result.userAnalysis) ?? inferScoreFromAnalysis(result.userAnalysis));
  const forecast = projectRatings(baseOverall);

  const hasChartData = Boolean(result.userAnalysis || (result.competitors?.length ?? 0) > 0);
  const overviewCardScore = ensureScore(
    result.synthesis?.overall_score ??
      parseScoreFromReport(result.report) ??
      (result.userAnalysis ? getCompetitorOverallScore(result.userAnalysis) : null)
  );
  const sites: { label: string; isUser: boolean; analysis: Record<string, string> | undefined; urlHref: string }[] =
    [
      { label: domain, isUser: true, analysis: result.userAnalysis, urlHref: url },
      ...(result.competitors ?? []).slice(0, 3).map((c) => ({
        label: getDomain(c.url),
        isUser: false,
        analysis: c.analysis,
        urlHref: c.url,
      })),
    ];

  const [pdfLoading, setPdfLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-white/[0.06] bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex min-h-[44px] min-w-0 w-full max-w-6xl items-center px-4 md:px-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="touch-target mr-2 flex shrink-0 items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:mr-4"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <Link
            to="/"
            className="mr-4 shrink-0 font-sans text-lg font-medium tracking-tight text-primary hover:opacity-90 sm:mr-6"
          >
            Landing Lens
          </Link>
          <nav
            className="scrollbar-hide flex min-h-[44px] shrink-0 items-center gap-1 overflow-x-auto py-1 sm:gap-2"
            aria-label="Report actions"
          >
            <button
              type="button"
              onClick={() => navigate("/", { state: { openHistory: true } })}
              className="touch-target inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground sm:px-4"
              aria-label={historyCount > 0 ? `History, ${historyCount} analyses` : "Open history"}
            >
              History
              {historyCount > 0 ? (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/20 px-1.5 text-xs font-semibold text-primary">
                  {historyCount}
                </span>
              ) : null}
            </button>
          </nav>
          <div className="ml-auto flex shrink-0 items-center pl-2">
            <button
              type="button"
              onClick={handlePdf}
              disabled={pdfLoading}
              className="touch-target inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:brightness-110 disabled:pointer-events-none disabled:opacity-60 sm:px-4"
            >
              <FileDown className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{pdfLoading ? "Building PDF…" : "Export PDF"}</span>
              <span className="sm:hidden">{pdfLoading ? "…" : "PDF"}</span>
            </button>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-6 sm:py-8 pb-20 sm:pb-10 md:pb-24"
      >
        <div id="report-top" className="scroll-mt-[5.5rem] pt-8 sm:pt-10 pb-2">
          <ReportEyebrow>Full insights</ReportEyebrow>
          <ReportPageTitle>{domain}</ReportPageTitle>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Weighted view of your landing versus competitors—structured for scanning, then synthesis.
          </p>
          <ReportMetaChips
            items={[
              { label: "Plan", value: planName },
              { label: "Unlocked", value: new Date(paidAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) },
            ]}
          />
        </div>

        <ReportJumpNav links={jumpLinks} className="mb-6 sm:mb-8" />

        <ReportSection
          id="forecast"
          title="Rating trajectory"
          description="Illustrative projection if you ship the highest-impact fixes. Not a guarantee—use as a prioritization lens."
          contentClassName="space-y-8"
        >
          <ReportSurface variant="highlight">
            <div className="flex items-start gap-3 mb-6">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <TrendingUp className="h-4 w-4" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{forecast.summary}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { k: "now" as const, label: "Now", value: forecast.current, emphasize: "muted" as const },
                { k: "30" as const, label: "~30 days", value: forecast.days30, emphasize: "primary" as const },
                { k: "90" as const, label: "~90 days", value: forecast.days90, emphasize: "success" as const },
              ].map((cell) => (
                <div
                  key={cell.k}
                  className="rounded-xl border border-white/[0.06] bg-background/50 px-3 py-4 sm:px-4 text-center"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cell.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-2xl sm:text-[1.75rem] font-mono font-bold tabular-nums tracking-tight",
                      cell.emphasize === "primary" && "text-primary",
                      cell.emphasize === "success" && "text-success",
                      cell.emphasize === "muted" && "text-foreground"
                    )}
                  >
                    {cell.value.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">out of 10</p>
                </div>
              ))}
            </div>
          </ReportSurface>

          <div>
            <h3 className="text-base font-semibold text-foreground mb-1">Now vs. after improvements</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-xl">
              Section-level scores today versus an estimated profile after key recommendations (same headroom logic
              as the ~90 day forecast).
            </p>
            {userScores ? (
              <ReportSurface variant="default" className="p-4 sm:p-5">
                <BeforeAfterScoresChart userScores={userScores} improvementFactor={0.65} />
              </ReportSurface>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough section-level data to plot.</p>
            )}
          </div>
        </ReportSection>

        <ReportSection
          id="scores"
          title="Scores by section"
          description="Parsed from each site’s analysis text (X/10). Avg is the mean when all five sections carry a score."
          contentClassName="space-y-4"
        >
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-card/25 shadow-sm shadow-black/5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Per-section scores for your site and competitors</caption>
                <thead>
                  <tr className="border-b border-white/[0.06] bg-muted/30">
                    <th scope="col" className="text-left px-4 py-3.5 font-semibold text-muted-foreground">
                      Site
                    </th>
                    {BACKEND_SECTIONS.map((s) => (
                      <th
                        key={s.key}
                        scope="col"
                        className="px-3 py-3.5 font-semibold text-muted-foreground whitespace-nowrap text-center"
                      >
                        {s.label}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3.5 font-semibold text-muted-foreground text-center">
                      Avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => {
                    const parsed = parseSectionScores(site.analysis);
                    const avg = getCompetitorOverallScore(site.analysis) ?? inferScoreFromAnalysis(site.analysis);
                    return (
                      <tr
                        key={site.label}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-muted/15 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-mono text-xs sm:text-sm">
                          <a
                            href={site.urlHref.startsWith("http") ? site.urlHref : `https://${site.urlHref}`}
                            className="text-foreground hover:text-primary hover:underline underline-offset-4"
                          >
                            {site.label}
                          </a>
                          {site.isUser && (
                            <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              You
                            </span>
                          )}
                        </td>
                        {RADAR_ORDER.map((rk) => {
                          const v = parsed?.[rk];
                          return (
                            <td
                              key={rk}
                              className={cn(
                                "px-3 py-3.5 font-mono tabular-nums text-center text-sm",
                                v != null && v < 5 && "text-destructive font-semibold",
                                v != null && v >= 7.5 && "text-success font-semibold"
                              )}
                            >
                              {v != null ? v.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3.5 font-mono font-semibold tabular-nums text-center text-sm">
                          {avg != null ? ensureScore(avg).toFixed(1) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </ReportSection>

        <ReportSection
          id="recommendations"
          title="Recommendations by section"
          description="Condensed from the model. Start with failed checks and lowest-scoring sections."
          contentClassName="space-y-3"
        >
          <Accordion type="multiple" className="space-y-3">
            {BACKEND_SECTIONS.map(({ key, label }) => (
              <AccordionItem
                key={key}
                value={key}
                className="rounded-2xl border border-white/[0.07] bg-card/20 px-1 data-[state=open]:bg-card/35 transition-colors"
              >
                <AccordionTrigger className="px-4 py-4 text-left text-sm font-semibold hover:no-underline [&[data-state=open]]:text-primary">
                  {label}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-0 space-y-5 text-sm border-t border-white/[0.04]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">Your site</p>
                    <p className="text-muted-foreground leading-relaxed">{snippet(result.userAnalysis?.[key])}</p>
                    <ul className="mt-3 space-y-2 list-disc pl-5 text-foreground/95 marker:text-primary/70">
                      {improvementLines(result.userAnalysis, key).map((line, i) => (
                        <li key={i} className="leading-relaxed pl-0.5">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(result.competitors ?? []).slice(0, 3).map((c) => (
                    <div key={c.url} className="pt-4 border-t border-white/[0.06]">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {getDomain(c.url)}
                      </p>
                      <p className="text-muted-foreground leading-relaxed">{snippet(c.analysis?.[key], 180)}</p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ReportSection>

        {result.gaps && result.gaps.length > 0 && (
          <ReportSection
            id="gaps"
            title="Critical gaps"
            description="Highest-priority deltas versus what competitors do better on-page."
            contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {result.gaps.map((g, i) => (
              <article
                key={i}
                className={cn(
                  "rounded-2xl border border-white/[0.07] bg-card/25 p-5 shadow-sm shadow-black/5 pl-5",
                  g.priority === "P1" ? "border-l-4 border-l-destructive" : "border-l-4 border-l-primary/50"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-3">
                  <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
                    {g.priority}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{g.area}</span>
                  <span className="ml-auto text-[11px] font-medium text-muted-foreground tabular-nums">
                    {g.confidence}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug mb-2">{g.problem}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{g.recommendation}</p>
                <p className="mt-3 text-xs font-medium text-primary">{g.competitor}</p>
              </article>
            ))}
          </ReportSection>
        )}

        <ReportSection
          id="synthesis"
          title="Full synthesis"
          description="Executive narrative from this run: summary, strengths, gaps, and next steps."
          contentClassName="space-y-4"
        >
          <StructuredSynthesis report={result.report} />
        </ReportSection>

        {hasChartData && (
          <section
            id="appendix"
            className="scroll-mt-[5.5rem] border-t border-dashed border-white/[0.1] pt-14 pb-8"
            aria-labelledby="appendix-heading"
          >
            <header className="mb-10 max-w-2xl">
              <ReportEyebrow className="text-muted-foreground/80">Appendix</ReportEyebrow>
              <h2 id="appendix-heading" className="text-lg font-semibold tracking-[-0.01em] text-foreground mt-2">
                Visuals & competitive detail
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Same cards and charts as the summary report—use for side-by-side screenshots and shape comparisons.
              </p>
            </header>

            <div className="space-y-12">
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-base font-semibold text-foreground">Section comparison</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a section to compare narratives and captures.
                  </p>
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Landing sections"
                >
                  {SECTION_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeSection === tab}
                      onClick={() => setActiveSection(tab)}
                      className={cn(
                        "touch-target rounded-full px-4 py-2 text-xs font-semibold transition-all",
                        activeSection === tab
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border border-white/[0.08] bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SectionCard
                    domain={domain}
                    siteUrl={url}
                    isUser
                    score={overviewCardScore}
                    screenshotUrl={result.targetScreenshotUrl}
                    analysisText={result.userAnalysis?.[SECTION_TO_BACKEND[activeSection]]}
                    variants={itemVariants}
                  />
                  {(result.competitors ?? []).slice(0, 3).map((comp) => (
                    <SectionCard
                      key={comp.url}
                      domain={getDomain(comp.url)}
                      siteUrl={comp.url}
                      isUser={false}
                      score={ensureScore(
                        getCompetitorOverallScore(comp.analysis) ?? inferScoreFromAnalysis(comp.analysis)
                      )}
                      screenshotUrl={comp.screenshotUrl ?? undefined}
                      analysisText={comp.analysis?.[SECTION_TO_BACKEND[activeSection]]}
                      variants={itemVariants}
                    />
                  ))}
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.04 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-base font-semibold text-foreground">Metrics by section</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Numeric breakdown per site. Avg shown when all five sections include a score.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SiteSectionMetricsCard
                    domain={domain}
                    siteUrl={url}
                    isUser
                    analysis={result.userAnalysis}
                    variants={itemVariants}
                  />
                  {(result.competitors ?? []).slice(0, 3).map((comp) => (
                    <SiteSectionMetricsCard
                      key={comp.url}
                      domain={getDomain(comp.url)}
                      siteUrl={comp.url}
                      analysis={comp.analysis}
                      variants={itemVariants}
                    />
                  ))}
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-base font-semibold text-foreground">Competitive charts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Radar for overall shape; bars for section mix. Tap legend entries to hide a series.
                  </p>
                </div>
                <ReportSurface variant="muted" className="p-4 sm:p-6">
                  <CompetitiveCharts
                    userUrl={url}
                    userAnalysis={result.userAnalysis}
                    competitors={result.competitors ?? undefined}
                  />
                </ReportSurface>
              </motion.section>
            </div>
          </section>
        )}

        <footer className="mt-8 pt-8 border-t border-white/[0.06] text-center text-xs text-muted-foreground">
          <p>Landing Lens — demo insights. Projections are illustrative.</p>
        </footer>
      </main>
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getJobStatus, type AnalysisResult, type CriticalGap, type JobLiveState, type LiveSiteState } from "@/lib/api";
import {
  getDomain,
  cn,
  liveSectionScoresToAnalysisText,
  parseSectionScores,
  hasFullSectionScores,
  stripMarkdownFormatting,
  cleanReportSummaryText,
} from "@/lib/utils";
import type { LiveSectionKey } from "@/types/api";
import type { RadarSite } from "@/components/CompetitiveRadarChart";
import { CompetitiveRadarChart } from "@/components/CompetitiveRadarChart";
import { CompetitiveBarChart } from "@/components/CompetitiveBarChart";

const POLL_MS = 1500;
const MAX_POLL_FAILURES = 8;

const FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

const SECTION_ORDER: { key: LiveSectionKey; label: string }[] = [
  { key: "hero", label: "Hero" },
  { key: "value proposition", label: "Value Prop" },
  { key: "features", label: "Features" },
  { key: "social proof", label: "Social Proof" },
  { key: "CTA", label: "CTA" },
];

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

function scoreColorClass(score: number): string {
  if (score >= 7.5) return "text-success";
  if (score >= 5) return "text-warning";
  return "text-destructive";
}

function AnimatedSectionScore({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) {
      prevRef.current = null;
      return;
    }
    if (prevRef.current === value) return;
    prevRef.current = value;
    const start = performance.now();
    const dur = 450;
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 2;
      setDisplay(parseFloat((eased * value).toFixed(1)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  if (value == null) {
    return (
      <span className="text-[10px] text-muted-foreground tabular-nums animate-pulse">Analyzing…</span>
    );
  }
  return (
    <span className={cn("text-sm font-mono font-semibold tabular-nums", scoreColorClass(value))}>
      {display.toFixed(1)}
    </span>
  );
}

function AnimatedOverallScore({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(parseFloat((eased * target).toFixed(1)));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target]);
  return <span className="tabular-nums">{val.toFixed(1)}</span>;
}

function buildRadarSitesFromLive(userUrl: string, sites: LiveSiteState[]): RadarSite[] {
  const ordered = [...sites].sort((a, b) => {
    if (a.isUser) return -1;
    if (b.isUser) return 1;
    return 0;
  });
  const out: RadarSite[] = [];
  for (const s of ordered) {
    const pseudo = liveSectionScoresToAnalysisText(
      s.sectionScores as Record<string, number | null | undefined>
    );
    const scores = parseSectionScores(pseudo);
    if (scores && hasFullSectionScores(scores)) {
      out.push({
        url: s.url,
        isUserSite: s.isUser,
        scores: scores as RadarSite["scores"],
      });
    }
  }
  return out;
}

function PriorityBadge({ level }: { level: "P1" | "P2" }) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider",
        level === "P1" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
      )}
    >
      {level}
    </span>
  );
}

interface ProgressiveReportViewProps {
  jobId: string;
  url: string;
  onComplete: (result: AnalysisResult | null) => void;
  onBack?: () => void;
  onGoHome?: () => void;
}

export default function ProgressiveReportView({
  jobId,
  url,
  onComplete,
  onBack,
  onGoHome,
}: ProgressiveReportViewProps) {
  const [live, setLive] = useState<JobLiveState | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const doneRef = useRef(false);
  const domain = getDomain(url);

  const radarSites = useMemo(() => {
    if (!live?.sites?.length) return [];
    return buildRadarSitesFromLive(url, live.sites);
  }, [live?.sites, url]);

  const [axisReveal, setAxisReveal] = useState(0);
  useEffect(() => {
    if (!live?.synthesis?.ready || radarSites.length === 0) {
      setAxisReveal(0);
      return;
    }
    setAxisReveal(1);
    let step = 1;
    const id = window.setInterval(() => {
      step += 1;
      setAxisReveal(Math.min(5, step));
      if (step >= 5) window.clearInterval(id);
    }, 360);
    return () => window.clearInterval(id);
  }, [live?.synthesis?.ready, radarSites.length]);

  const hidden = useMemo(() => new Set<number>(), []);
  const visibleSites = useMemo(() => radarSites.filter((_, i) => !hidden.has(i)), [radarSites, hidden]);

  useEffect(() => {
    if (doneRef.current) return;
    let cancelled = false;
    let failCount = 0;

    const poll = async () => {
      while (!cancelled && !doneRef.current) {
        try {
          const job = await getJobStatus(jobId);
          if (cancelled) return;
          failCount = 0;
          if (job.live) setLive(job.live as JobLiveState);
          if (job.result) setResult(job.result as AnalysisResult);

          if (job.status === "completed" && job.result) {
            doneRef.current = true;
            setTimeout(() => onComplete(job.result as AnalysisResult), 400);
            return;
          }
          if (job.status === "failed") {
            const err = job.error || "Analysis failed.";
            setStreamError(err);
            return;
          }
        } catch {
          if (cancelled || doneRef.current) return;
          failCount += 1;
          if (failCount >= MAX_POLL_FAILURES) {
            setStreamError("Connection failed. Back to try again.");
            return;
          }
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, onComplete]);

  const summarySnippet = useMemo(() => {
    const report = result?.report;
    if (!report || !live?.synthesis?.ready) return null;
    let raw = stripMarkdownFormatting(report);
    raw = cleanReportSummaryText(raw);
    raw = raw.replace(/\s*I am analyzing\s+https?:\/\/[^\n.]*[.\n]?/gi, " ").trim();
    raw = raw.replace(/^[\s\S]*?Overall score:\s*[\d.]+\s*\/\s*10\s*/i, "").trim();
    const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2);
    return sentences.join(" ") || raw.slice(0, 280);
  }, [result?.report, live?.synthesis?.ready]);

  const overallTarget = useMemo(() => {
    if (live?.synthesis?.overallScore != null) return live.synthesis.overallScore;
    const fromReport = result?.synthesis?.overall_score;
    if (fromReport != null) return fromReport;
    return 5.5;
  }, [live?.synthesis?.overallScore, result?.synthesis?.overall_score]);

  const gapsToShow: CriticalGap[] = useMemo(() => {
    if (live?.synthesis?.ready && live.synthesis.gaps?.length) return live.synthesis.gaps;
    if (result?.gaps?.length) return result.gaps;
    return [];
  }, [live?.synthesis, result?.gaps]);

  const showCharts = live?.synthesis?.ready && radarSites.length > 0 && axisReveal > 0;

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 h-14 flex items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="touch-target p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {onGoHome ? (
            <button
              type="button"
              onClick={onGoHome}
              className="font-sans text-lg font-medium tracking-tight text-primary hover:opacity-90"
            >
              Landing Lens
            </button>
          ) : (
            <Link to="/" className="font-sans text-lg font-medium tracking-tight text-primary hover:opacity-90">
              Landing Lens
            </Link>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            <span>
              Live report <span className="font-mono text-foreground">{domain}</span>
            </span>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 px-4 md:px-8 py-8 max-w-6xl mx-auto w-full pb-16">
        {streamError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive mb-4">{streamError}</p>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary"
              >
                ← Back
              </button>
            )}
          </div>
        )}

        {!streamError && (
          <div className="space-y-8">
            {(!live?.sites || live.sites.length === 0) && (
              <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm">Discovering competitors…</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(live?.sites ?? []).map((site) => (
                <CompetitorLiveCard key={site.url} site={site} />
              ))}
            </div>

            {(live?.synthesis?.started || live?.synthesis?.ready) && (
              <motion.section {...fadeUp} className="glass-surface-elevated rounded-xl p-6 border border-white/10">
                <h2 className="text-sm font-semibold text-foreground mb-4">Synthesis</h2>
                {!live?.synthesis?.ready ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm">Writing report…</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Overall score</p>
                        <p className="text-4xl font-mono font-bold text-primary tabular-nums">
                          <AnimatedOverallScore target={overallTarget} />
                          <span className="text-lg font-normal text-muted-foreground"> /10</span>
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Competitive view
                      </div>
                    </div>
                    {summarySnippet && (
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{summarySnippet}</p>
                    )}

                    {gapsToShow.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Critical gaps
                        </h3>
                        <motion.ul
                          className="grid grid-cols-1 md:grid-cols-2 gap-3"
                          initial="hidden"
                          animate="show"
                          variants={{
                            show: { transition: { staggerChildren: 0.12 } },
                            hidden: {},
                          }}
                        >
                          {gapsToShow.map((gap, i) => (
                            <motion.li
                              key={i}
                              variants={{
                                hidden: { opacity: 0, y: 8 },
                                show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                              }}
                              className="glass-surface rounded-lg p-4 border border-white/10"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <PriorityBadge level={gap.priority} />
                                <span className="text-xs text-muted-foreground">{gap.area}</span>
                              </div>
                              <p className="text-sm font-medium text-foreground mb-1">{gap.problem}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{gap.recommendation}</p>
                              {gap.competitor && (
                                <p className="text-[11px] text-muted-foreground mt-2 font-mono flex items-center gap-1">
                                  <ArrowUpRight className="w-3 h-3" />
                                  {gap.competitor}
                                </p>
                              )}
                            </motion.li>
                          ))}
                        </motion.ul>
                      </div>
                    )}

                    {showCharts && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4"
                      >
                        <div className="flex flex-col items-center w-full min-w-0">
                          <span className="text-[11px] text-muted-foreground uppercase mb-3 tracking-widest">
                            Competitive Shape
                          </span>
                          <div className="w-full max-w-[520px] h-[300px]">
                            <CompetitiveRadarChart
                              sites={radarSites}
                              hidden={hidden}
                              progressiveAxisCount={axisReveal}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center w-full min-w-0">
                          <span className="text-[11px] text-muted-foreground uppercase mb-3 tracking-widest">
                            Section Breakdown
                          </span>
                          <div className="w-full max-w-[520px] h-[300px]">
                            <CompetitiveBarChart
                              sites={radarSites}
                              hidden={hidden}
                              visibleSites={visibleSites}
                              progressiveAxisCount={axisReveal}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CompetitorLiveCard({ site }: { site: LiveSiteState }) {
  const href = site.url.startsWith("http") ? site.url : `https://${site.url}`;
  return (
    <motion.article
      layout
      {...fadeUp}
      className="glass-surface rounded-xl overflow-hidden border border-white/10"
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <img src={FAVICON(site.domain)} alt="" className="w-8 h-8 shrink-0 rounded" width={32} height={32} />
          <div className="min-w-0 flex-1">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-foreground truncate block hover:underline"
            >
              {site.domain}
            </a>
            {site.isUser && (
              <span className="text-[10px] text-primary font-medium">← you</span>
            )}
          </div>
        </div>

        <div className="rounded-md overflow-hidden border border-border bg-muted/30 aspect-[4/3] mb-4 relative">
          {site.screenshotReady && site.screenshotUrl ? (
            <motion.img
              src={site.screenshotUrl}
              alt={`Screenshot ${site.domain}`}
              className="w-full h-full object-cover object-top"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
            />
          ) : (
            <div className="absolute inset-0 animate-pulse bg-muted/60" aria-hidden />
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Section scores</p>
          {SECTION_ORDER.map((row) => {
            const v = site.sectionScores[row.key];
            return (
              <div key={row.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground truncate">{row.label}</span>
                <AnimatedSectionScore value={v} />
              </div>
            );
          })}
        </div>
      </div>
    </motion.article>
  );
}

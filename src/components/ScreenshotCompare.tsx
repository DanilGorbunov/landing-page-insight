import { useState, useMemo, useRef, useCallback } from "react";
import { cn, getDomain, parseScoreFromReport } from "@/lib/utils";
import type { AnalysisResult } from "@/types/api";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

// ─── Section layout: approximate vertical zones on a full-page screenshot ─────
// These percentages map landing page sections to vertical positions.
// A typical landing page flows: Hero (0–20%) → Value Prop (18–35%) → Features (32–55%)
// → Social Proof (52–72%) → CTA / Footer (68–90%)
const SECTION_ZONES: Record<string, { top: number; height: number; label: string }> = {
  hero:               { top: 0,   height: 20, label: "Hero" },
  "value proposition": { top: 18,  height: 17, label: "Value Prop" },
  features:           { top: 33,  height: 22, label: "Features" },
  "social proof":     { top: 53,  height: 19, label: "Social Proof" },
  CTA:                { top: 70,  height: 20, label: "CTA" },
};

const SECTION_KEYS = ["hero", "value proposition", "features", "social proof", "CTA"] as const;

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Annotation {
  sectionKey: string;
  label: string;
  score: number | null;
  summary: string;
  top: number;
  height: number;
}

interface SiteEntry {
  url: string;
  domain: string;
  isUser: boolean;
  screenshotUrl: string | null;
  analysis: Record<string, string>;
  annotations: Annotation[];
  overallScore: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function extractFirstSentence(text: string): string {
  const cleaned = text
    .replace(/\*\*/g, "")
    .replace(/^#{1,4}\s+.*/gm, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\d+(\.\d+)?\s*\/\s*10/g, "")
    .trim();
  const m = cleaned.match(/[A-Z][^.!?]{10,120}[.!?]/);
  return m ? m[0].trim() : cleaned.slice(0, 120).trim();
}

function buildAnnotations(analysis: Record<string, string>): Annotation[] {
  return SECTION_KEYS.map((key) => {
    const zone = SECTION_ZONES[key];
    const text = analysis[key] ?? "";
    const score = parseScoreFromReport(text);
    return {
      sectionKey: key,
      label: zone.label,
      score,
      summary: text ? extractFirstSentence(text) : "No data",
      top: zone.top,
      height: zone.height,
    };
  });
}

function scoreColor(score: number | null): string {
  if (score == null) return "border-muted-foreground/40 bg-muted/60";
  if (score >= 7.5) return "border-emerald-500/60 bg-emerald-500/10";
  if (score >= 5) return "border-amber-500/60 bg-amber-500/10";
  return "border-red-500/60 bg-red-500/10";
}

function scoreTextColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 7.5) return "text-emerald-500";
  if (score >= 5) return "text-amber-500";
  return "text-red-500";
}

function ScoreIcon({ score }: { score: number | null }) {
  if (score == null) return null;
  if (score >= 7.5) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (score >= 5) return <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
}

// ─── Overlay annotation card ────────────────────────────────────────────────────

function AnnotationPin({
  ann,
  expanded,
  onToggle,
  side,
}: {
  ann: Annotation;
  expanded: boolean;
  onToggle: () => void;
  side: "left" | "right";
}) {
  return (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        top: `${ann.top + ann.height / 2}%`,
        [side]: "8px",
        transform: "translateY(-50%)",
        maxWidth: "220px",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md shadow-lg transition-all cursor-pointer select-none",
          scoreColor(ann.score),
          expanded && "ring-2 ring-primary/40"
        )}
      >
        <ScoreIcon score={ann.score} />
        <span className="text-foreground">{ann.label}</span>
        {ann.score != null && (
          <span className={cn("tabular-nums font-bold ml-0.5", scoreTextColor(ann.score))}>
            {ann.score.toFixed(1)}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-xl text-xs leading-relaxed text-foreground max-w-[220px]">
          <p>{ann.summary}</p>
          {ann.score != null && ann.score < 7 && (
            <p className="mt-2 text-[11px] text-primary font-semibold flex items-center gap-1">
              <Lightbulb className="h-3 w-3 shrink-0" />
              Needs improvement
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section zone highlight strips ──────────────────────────────────────────────

function SectionZones({ annotations, showZones }: { annotations: Annotation[]; showZones: boolean }) {
  if (!showZones) return null;
  return (
    <>
      {annotations.map((ann) => (
        <div
          key={ann.sectionKey}
          className={cn(
            "absolute left-0 right-0 border-t border-b pointer-events-none transition-opacity duration-300",
            ann.score != null && ann.score >= 7.5
              ? "border-emerald-500/20 bg-emerald-500/5"
              : ann.score != null && ann.score >= 5
              ? "border-amber-500/20 bg-amber-500/5"
              : ann.score != null
              ? "border-red-500/20 bg-red-500/5"
              : "border-muted-foreground/10 bg-muted/5"
          )}
          style={{ top: `${ann.top}%`, height: `${ann.height}%` }}
        />
      ))}
    </>
  );
}

// ─── Site selector tabs ─────────────────────────────────────────────────────────

function SiteTab({
  site,
  active,
  onClick,
}: {
  site: SiteEntry;
  active: boolean;
  onClick: () => void;
}) {
  const avg = site.overallScore;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
      )}
    >
      {site.isUser && (
        <span className="shrink-0 rounded bg-primary-foreground/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">
          You
        </span>
      )}
      <span className="truncate max-w-[140px]">{site.domain}</span>
      {avg != null && (
        <span
          className={cn(
            "tabular-nums text-xs font-bold shrink-0",
            active ? "text-primary-foreground/80" : scoreTextColor(avg)
          )}
        >
          {avg.toFixed(1)}
        </span>
      )}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface Props {
  result: AnalysisResult;
  url: string;
}

export function ScreenshotCompare({ result, url }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [expandedPin, setExpandedPin] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [fullWidth, setFullWidth] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sites: SiteEntry[] = useMemo(() => {
    const list: SiteEntry[] = [];
    const userDomain = getDomain(url);
    const userAnalysis = result.userAnalysis ?? {};
    const userScores = SECTION_KEYS.map((k) => parseScoreFromReport(userAnalysis[k])).filter(
      (n): n is number => n != null
    );
    const userAvg =
      userScores.length > 0
        ? Math.round((userScores.reduce((a, b) => a + b, 0) / userScores.length) * 10) / 10
        : null;

    list.push({
      url,
      domain: userDomain,
      isUser: true,
      screenshotUrl: result.targetScreenshotUrl ?? null,
      analysis: userAnalysis,
      annotations: buildAnnotations(userAnalysis),
      overallScore: result.synthesis?.overall_score ?? userAvg,
    });

    for (const comp of result.competitors ?? []) {
      const compDomain = getDomain(comp.url);
      const compAnalysis = comp.analysis ?? {};
      const compScores = SECTION_KEYS.map((k) => parseScoreFromReport(compAnalysis[k])).filter(
        (n): n is number => n != null
      );
      const compAvg =
        compScores.length > 0
          ? Math.round((compScores.reduce((a, b) => a + b, 0) / compScores.length) * 10) / 10
          : null;
      list.push({
        url: comp.url,
        domain: compDomain,
        isUser: false,
        screenshotUrl: comp.screenshotUrl ?? null,
        analysis: compAnalysis,
        annotations: buildAnnotations(compAnalysis),
        overallScore: compAvg,
      });
    }
    return list;
  }, [result, url]);

  const activeSite = sites[activeIdx] ?? sites[0];

  const handlePrev = useCallback(() => {
    setActiveIdx((i) => (i > 0 ? i - 1 : sites.length - 1));
    setExpandedPin(null);
  }, [sites.length]);

  const handleNext = useCallback(() => {
    setActiveIdx((i) => (i < sites.length - 1 ? i + 1 : 0));
    setExpandedPin(null);
  }, [sites.length]);

  if (!sites.some((s) => s.screenshotUrl)) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">No screenshots available for comparison.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Site selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={handlePrev}
          className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Previous site"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {sites.map((site, i) => (
          <SiteTab key={site.url} site={site} active={i === activeIdx} onClick={() => { setActiveIdx(i); setExpandedPin(null); }} />
        ))}
        <button
          type="button"
          onClick={handleNext}
          className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Next site"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowAnnotations((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            showAnnotations
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {showAnnotations ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Annotations
        </button>
        <button
          type="button"
          onClick={() => setShowZones((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            showZones
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          Zones
        </button>
        <button
          type="button"
          onClick={() => setFullWidth((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {fullWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {fullWidth ? "Normal" : "Full width"}
        </button>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />7.5+</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />5–7.4</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />&lt;5</span>
        </div>
      </div>

      {/* Screenshot with overlays */}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-2xl border border-border overflow-hidden bg-muted/30",
          fullWidth ? "max-w-none" : "max-w-3xl mx-auto"
        )}
      >
        {activeSite.screenshotUrl ? (
          <div className="relative">
            <img
              src={activeSite.screenshotUrl}
              alt={`Full page screenshot of ${activeSite.domain}`}
              className="w-full h-auto block"
              loading="lazy"
            />

            {/* Zone highlights */}
            <SectionZones annotations={activeSite.annotations} showZones={showZones} />

            {/* Annotation pins */}
            {showAnnotations &&
              activeSite.annotations.map((ann) => (
                <AnnotationPin
                  key={ann.sectionKey}
                  ann={ann}
                  expanded={expandedPin === ann.sectionKey}
                  onToggle={() =>
                    setExpandedPin((prev) => (prev === ann.sectionKey ? null : ann.sectionKey))
                  }
                  side={activeSite.isUser ? "left" : "right"}
                />
              ))}

            {/* Domain badge */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-md border border-border px-4 py-1.5 shadow-lg">
              {activeSite.isUser && (
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  You
                </span>
              )}
              <span className="text-xs font-semibold text-foreground">{activeSite.domain}</span>
              {activeSite.overallScore != null && (
                <span className={cn("text-xs font-bold tabular-nums", scoreTextColor(activeSite.overallScore))}>
                  {activeSite.overallScore.toFixed(1)}/10
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            No screenshot available for {activeSite.domain}
          </div>
        )}
      </div>

      {/* Quick comparison strip beneath screenshot */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sites.length, 5)}, 1fr)` }}>
        {sites.map((site, i) => (
          <button
            key={site.url}
            type="button"
            onClick={() => { setActiveIdx(i); setExpandedPin(null); }}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              i === activeIdx ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-semibold text-foreground truncate">{site.domain}</span>
              {site.overallScore != null && (
                <span className={cn("text-[11px] font-bold tabular-nums shrink-0", scoreTextColor(site.overallScore))}>
                  {site.overallScore.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex gap-0.5">
              {SECTION_KEYS.map((key) => {
                const ann = site.annotations.find((a) => a.sectionKey === key);
                const s = ann?.score;
                const bg =
                  s == null
                    ? "bg-muted"
                    : s >= 7.5
                    ? "bg-emerald-500"
                    : s >= 5
                    ? "bg-amber-500"
                    : "bg-red-500";
                return (
                  <div
                    key={key}
                    className={cn("flex-1 h-1.5 rounded-full", bg)}
                    title={`${SECTION_ZONES[key].label}: ${s?.toFixed(1) ?? "—"}`}
                  />
                );
              })}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

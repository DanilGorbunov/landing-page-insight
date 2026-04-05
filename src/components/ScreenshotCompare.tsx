import { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect, type SyntheticEvent } from "react";
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
  LayoutGrid,
  Columns2,
  Blend,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart3,
  Sparkles,
  ScanEye,
  MousePointer2,
  Type,
  Flame,
  ArrowLeftRight,
  Shield,
  BookOpen,
  Smartphone,
  Timer,
  Target,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DecisionActionPanel,
  CompareOverlayLayer,
  type CompareOverlayLayerMode,
} from "@/components/CompareDecisionPanels";
import type { CriticalGap } from "@/types/api";
import {
  deriveHeroSubMetrics,
  deriveConversionLayer,
  deriveBehavioralUx,
  deriveCopyAnalysis,
  rankSites,
  biggestGaps,
  buildCompetitorWinNarrative,
  dataCoveragePct,
  abVariantsFromResult,
  stealTopThree,
  heroThreeSecondInsight,
  annotationBulletPoints,
  annotationPreview,
  type SectionOrderKey,
} from "@/lib/compareDecisionMetrics";
import type { SectionDeepDivePayload } from "@/components/CompareDecisionPanels";

// ─── Constants ──────────────────────────────────────────────────────────────────

const SECTION_ZONES: Record<string, { top: number; height: number; label: string; short: string }> = {
  hero:               { top: 0,   height: 20, label: "Hero",         short: "Hero" },
  "value proposition": { top: 18,  height: 17, label: "Value Prop",   short: "Val" },
  features:           { top: 33,  height: 22, label: "Features",     short: "Feat" },
  "social proof":     { top: 53,  height: 19, label: "Social Proof", short: "Social" },
  CTA:                { top: 70,  height: 20, label: "CTA",          short: "CTA" },
};

const SECTION_KEYS = ["hero", "value proposition", "features", "social proof", "CTA"] as const;
const ZOOM_LEVELS = [1, 1.25, 1.5, 1.75] as const;

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Annotation {
  sectionKey: string;
  label: string;
  score: number | null;
  summary: string;
  /** Longer excerpt for pin popover. */
  preview: string;
  fullText: string;
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
  const c = text.replace(/\*\*/g, "").replace(/^#{1,4}\s+.*/gm, "").replace(/^\s*[-•]\s*/gm, "").replace(/\d+(\.\d+)?\s*\/\s*10/g, "").trim();
  const m = c.match(/[A-Z][^.!?]{10,120}[.!?]/);
  return m ? m[0].trim() : c.slice(0, 120).trim();
}

function buildAnnotations(analysis: Record<string, string>): Annotation[] {
  return SECTION_KEYS.map((key) => {
    const zone = SECTION_ZONES[key];
    const text = analysis[key] ?? "";
    return {
      sectionKey: key,
      label: zone.label,
      score: parseScoreFromReport(text),
      summary: text ? extractFirstSentence(text) : "No data",
      preview: text ? annotationPreview(text, 360) : "",
      fullText: text,
      top: zone.top,
      height: zone.height,
    };
  });
}

function sColor(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s >= 7.5) return "text-emerald-500";
  if (s >= 5) return "text-amber-500";
  return "text-red-500";
}

function sBg(s: number | null) {
  if (s == null) return "bg-muted";
  if (s >= 7.5) return "bg-emerald-500";
  if (s >= 5) return "bg-amber-500";
  return "bg-red-500";
}

function sBorder(s: number | null) {
  if (s == null) return "border-muted-foreground/40 bg-muted/60";
  if (s >= 7.5) return "border-emerald-500/60 bg-emerald-500/10";
  if (s >= 5) return "border-amber-500/60 bg-amber-500/10";
  return "border-red-500/60 bg-red-500/10";
}

function ScoreIcon({ score }: { score: number | null }) {
  if (score == null) return null;
  if (score >= 7.5) return <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />;
  if (score >= 5) return <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />;
  return <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />;
}

/** Toolbar overlay modes: layer modes + mobile frame (no extra SVG layer). */
type ToolbarOverlayMode = CompareOverlayLayerMode | "mobile";

const CIRCLED_EYE_ORDER = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

function chipUnderlineClass(score: number | null) {
  if (score == null) return "bg-muted-foreground/40 dark:bg-muted-foreground/50";
  if (score < 7) return "bg-red-500";
  if (score < 8) return "bg-amber-500";
  return "bg-emerald-500";
}

function matchesSectionKey(lbl: string, key: string): boolean {
  const h = lbl.toLowerCase(), k = key.toLowerCase();
  if (k === "hero") return h.includes("hero");
  if (k === "value proposition") return h.includes("value") || h.includes("prop");
  if (k === "features") return h.includes("feature");
  if (k === "social proof") return h.includes("social") || h.includes("proof") || h.includes("testimonial");
  if (k === "cta") return h.includes("cta") || h.includes("call to action");
  return false;
}

function sectionPriorityFromGap(
  sectionKey: string,
  gaps: CriticalGap[] | undefined,
  userSectionScore: number | null
): "P1" | "P2" | "P3" {
  const g = gaps?.find((gap) => matchesSectionKey(gap.area, sectionKey));
  if (g?.priority === "P1") return "P1";
  if (g?.priority === "P2") return "P2";
  if (userSectionScore != null && userSectionScore < 6) return "P1";
  if (userSectionScore != null && userSectionScore < 7.5) return "P2";
  return "P3";
}

// ─── AnnotationPin ──────────────────────────────────────────────────────────────

function AnnotationPin({
  ann,
  expanded,
  onToggle,
  side,
  onMore,
}: {
  ann: Annotation;
  expanded: boolean;
  onToggle: () => void;
  side: "left" | "right";
  onMore?: () => void;
}) {
  const bullets = annotationBulletPoints(ann.fullText, 3);
  return (
    <div className="absolute z-10 pointer-events-auto" style={{ top: `${ann.top + ann.height / 2}%`, [side]: "6px", transform: "translateY(-50%)", maxWidth: "min(320px,44vw)" }}>
      <button type="button" onClick={onToggle} className={cn("flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-semibold backdrop-blur-md shadow-lg transition-all cursor-pointer select-none", sBorder(ann.score), expanded && "ring-2 ring-primary/40")}>
        <ScoreIcon score={ann.score} />
        <span className="text-foreground">{ann.label}</span>
        {ann.score != null && <span className={cn("tabular-nums font-bold", sColor(ann.score))}>{ann.score.toFixed(1)}</span>}
      </button>
      {expanded && (
        <div className="mt-1 rounded-xl border border-border bg-card/95 backdrop-blur-md p-2.5 shadow-xl text-[11px] leading-relaxed text-foreground max-w-[min(300px,44vw)]">
          {ann.preview ? <p className="text-foreground/95">{ann.preview}</p> : <p>{ann.summary}</p>}
          {bullets.length > 0 && (
            <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground list-disc pl-3.5">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {onMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMore();
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary/10 py-1.5 text-[10px] font-bold uppercase tracking-wide text-primary hover:bg-primary/20"
            >
              More
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          {ann.score != null && ann.score < 7 && (
            <p className="mt-2 text-primary font-semibold flex items-center gap-1 text-[10px]">
              <Lightbulb className="h-3 w-3 shrink-0" />
              Needs improvement
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type ZoneLens = "balanced" | "rich" | "hot" | "delta";

function SectionZones({
  annotations,
  show,
  zoneLens,
  deltaByKey,
  problemIndicators,
  eyeOrderByKey,
  competitorScores,
  siteIsUser,
  deltaLensTint,
}: {
  annotations: Annotation[];
  show: boolean;
  zoneLens: ZoneLens;
  deltaByKey?: Record<string, number | null>;
  problemIndicators?: boolean;
  eyeOrderByKey?: Record<string, number>;
  /** Competitor section scores — used on your screenshot for “they do this better”. */
  competitorScores?: Record<string, number | null>;
  siteIsUser?: boolean;
  /** Competitor-only: green/red full-zone tint for Δ vs You. */
  deltaLensTint?: boolean;
}) {
  if (!show) return null;
  return (
    <>
      {annotations.map((a) => {
        const sc = a.score;
        const isHot = zoneLens === "hot" && sc != null && sc < 7;
        const rich = zoneLens === "rich";
        const showDelta = zoneLens === "delta" && deltaByKey && deltaByKey[a.sectionKey] != null;
        const delta = showDelta ? deltaByKey![a.sectionKey]! : null;
        const lowScoreProblem = Boolean(problemIndicators && sc != null && sc < 7);
        const ord = eyeOrderByKey?.[a.sectionKey];
        const eyeLabel =
          ord != null && ord >= 1 && ord <= CIRCLED_EYE_ORDER.length ? CIRCLED_EYE_ORDER[ord - 1] : null;
        const compSc = competitorScores?.[a.sectionKey];
        const theyBetter =
          Boolean(siteIsUser) && sc != null && compSc != null && compSc - sc >= 1.5;
        const dTint =
          deltaLensTint && deltaByKey && deltaByKey[a.sectionKey] != null ? deltaByKey[a.sectionKey]! : null;
        return (
          <div
            key={a.sectionKey}
            className={cn(
              "absolute left-0 right-0 pointer-events-none transition-colors rounded-lg",
              !lowScoreProblem && "border-t border-b",
              sc != null && sc >= 7.5
                ? "border-emerald-500/25 bg-emerald-500/[0.08]"
                : sc != null && sc >= 5
                  ? "border-amber-500/25 bg-amber-500/[0.08]"
                  : sc != null
                    ? "border-red-500/30 bg-red-500/[0.1]"
                    : "border-muted-foreground/10 bg-muted/5",
              lowScoreProblem && "z-[4] border-2 border-dashed border-red-500 dark:border-red-400",
              isHot && "ring-2 ring-red-500/40 ring-inset animate-pulse z-[1]"
            )}
            style={{ top: `${a.top}%`, height: `${a.height}%` }}
          >
            {dTint != null && dTint !== 0 && (
              <div
                className={cn(
                  "absolute inset-0 rounded-lg z-[3]",
                  dTint > 0 ? "bg-emerald-500/20 dark:bg-emerald-500/25" : "bg-red-500/20 dark:bg-red-500/25"
                )}
              />
            )}
            {rich && sc != null && (
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/15 dark:bg-black/25">
                <div className={cn("h-full rounded-sm", sBg(sc))} style={{ width: `${Math.min(100, sc * 10)}%` }} />
              </div>
            )}
            {delta != null && (
              <div className="absolute right-1.5 bottom-1.5 pointer-events-none rounded-md px-1.5 py-0.5 text-[9px] font-bold bg-background/95 border border-border shadow-sm backdrop-blur-sm z-[5]">
                <span className={delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} vs you
                </span>
              </div>
            )}
            {eyeLabel != null && (
              <div className="absolute left-1.5 bottom-1.5 z-[5] flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/90 text-[11px] font-bold text-foreground shadow-sm backdrop-blur-sm dark:bg-card/95">
                {eyeLabel}
              </div>
            )}
            {theyBetter && (
              <div className="absolute right-1 top-1 z-[6] max-w-[min(100%,140px)] rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold leading-tight text-emerald-700 shadow-sm backdrop-blur-sm dark:text-emerald-300">
                ↑ They do this better
              </div>
            )}
            {isHot && !theyBetter && (
              <div className="absolute right-1 top-1 z-[2] rounded bg-red-600/95 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow">
                Hot zone
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Screenshot frame ───────────────────────────────────────────────────────────

function ScreenshotFrame({
  site,
  showZones,
  showPins,
  expandedPin,
  setExpandedPin,
  zoom,
  overlayMode,
  sectionNavTick,
  zoneLens,
  deltaByKey,
  onSectionMore,
  problemIndicators,
  eyeOrderByKey,
  competitorScores,
  deltaLensTint,
}: {
  site: SiteEntry;
  showZones: boolean;
  showPins: boolean;
  expandedPin: string | null;
  setExpandedPin: (k: string | null) => void;
  zoom: number;
  overlayMode: ToolbarOverlayMode;
  /** Increments on each section chip click so re-selecting the same tab still scrolls. */
  sectionNavTick: number;
  zoneLens: ZoneLens;
  deltaByKey?: Record<string, number | null>;
  onSectionMore?: (ann: Annotation) => void;
  problemIndicators?: boolean;
  eyeOrderByKey?: Record<string, number>;
  competitorScores?: Record<string, number | null>;
  deltaLensTint?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [first5sFoldPct, setFirst5sFoldPct] = useState<number | null>(null);

  const layerMode: CompareOverlayLayerMode = overlayMode === "mobile" ? "compare" : overlayMode;
  const mobileFrame = overlayMode === "mobile";

  const scrollToExpandedSection = useCallback(() => {
    const key = expandedPin;
    if (!key || !scrollRef.current) return;
    const zone = SECTION_ZONES[key];
    if (!zone) return;
    const el = scrollRef.current;
    const { scrollHeight, clientHeight } = el;
    if (scrollHeight <= 0 || clientHeight <= 0) return;
    const maxTop = Math.max(0, scrollHeight - clientHeight);
    const centerY = ((zone.top + zone.height / 2) / 100) * scrollHeight - clientHeight / 2;
    el.scrollTo({ top: Math.min(maxTop, Math.max(0, centerY)), behavior: "smooth" });
  }, [expandedPin]);

  const onImageLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const h = img.naturalHeight;
      setFirst5sFoldPct(h > 0 ? Math.min(100, (600 / h) * 100) : null);
      scrollToExpandedSection();
    },
    [scrollToExpandedSection]
  );

  useLayoutEffect(() => {
    scrollToExpandedSection();
  }, [scrollToExpandedSection, sectionNavTick, zoom, site.screenshotUrl]);

  if (!site.screenshotUrl) return <div className="flex items-center justify-center min-h-[200px] text-sm text-muted-foreground bg-muted/20 rounded-xl">No screenshot for {site.domain}</div>;
  return (
    <div
      ref={scrollRef}
      className="relative overflow-auto rounded-xl border border-border bg-muted/20 max-h-[min(82vh,1200px)]"
      style={{ cursor: zoom > 1 ? "grab" : undefined }}
    >
      <div
        className={cn(
          "relative inline-block min-w-full origin-top transition-transform duration-150 ease-out",
          mobileFrame && "mx-auto block max-w-[390px] shadow-2xl ring-2 ring-border/80 dark:ring-border/60 rounded-xl overflow-hidden"
        )}
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
      >
        <img
          src={site.screenshotUrl}
          alt={`Full page: ${site.domain}`}
          className="w-full h-auto block select-none"
          loading="lazy"
          draggable={false}
          onLoad={onImageLoad}
        />
        <SectionZones
          annotations={site.annotations}
          show={showZones}
          zoneLens={zoneLens}
          deltaByKey={deltaByKey}
          problemIndicators={problemIndicators}
          eyeOrderByKey={eyeOrderByKey}
          competitorScores={competitorScores}
          siteIsUser={site.isUser}
          deltaLensTint={deltaLensTint}
        />
        <CompareOverlayLayer
          mode={layerMode}
          annotations={site.annotations.map((a) => ({ top: a.top, height: a.height, score: a.score, label: a.label }))}
          first5sTopPct={layerMode === "first5s" ? first5sFoldPct : null}
        />
        {showPins &&
          site.annotations.map((ann) => (
            <AnnotationPin
              key={ann.sectionKey}
              ann={ann}
              expanded={expandedPin === ann.sectionKey}
              onToggle={() => setExpandedPin(expandedPin === ann.sectionKey ? null : ann.sectionKey)}
              side={site.isUser ? "left" : "right"}
              onMore={onSectionMore ? () => onSectionMore(ann) : undefined}
            />
          ))}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-background/85 backdrop-blur-md border border-border px-3 py-1.5 shadow-lg max-w-[90%]">
          {site.isUser && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shrink-0">You</span>}
          <span className="text-xs font-semibold text-foreground truncate">{site.domain}</span>
          {site.overallScore != null && <span className={cn("text-xs font-bold tabular-nums shrink-0", sColor(site.overallScore))}>{site.overallScore.toFixed(1)}/10</span>}
          <a href={site.url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" title="Open live site" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
      </div>
    </div>
  );
}

// ─── Slider compare ─────────────────────────────────────────────────────────────

function SliderCompare({ left, right, leftLabel, rightLabel }: { left: SiteEntry; right: SiteEntry; leftLabel: string; rightLabel: string }) {
  const [pct, setPct] = useState(50);
  if (!left.screenshotUrl || !right.screenshotUrl) return null;
  return (
    <div className="space-y-2">
      <input type="range" min={5} max={95} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full h-1.5 accent-primary cursor-ew-resize rounded-full" aria-label="Compare drag" />
      <div className="relative rounded-xl border border-border overflow-hidden bg-muted/30 select-none">
        <img src={right.screenshotUrl} alt={rightLabel} className="w-full h-auto block" draggable={false} />
        <img src={left.screenshotUrl} alt={leftLabel} className="absolute top-0 left-0 w-full h-auto pointer-events-none" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} draggable={false} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_rgba(0,0,0,0.4)] z-30 pointer-events-none" style={{ left: `${pct}%`, transform: "translateX(-50%)" }} />
        <div className="absolute bottom-2 left-2 z-30 rounded-md bg-background/90 px-2 py-1 text-[10px] font-bold text-foreground border border-border">{leftLabel}</div>
        <div className="absolute bottom-2 right-2 z-30 rounded-md bg-background/90 px-2 py-1 text-[10px] font-bold text-foreground border border-border">{rightLabel}</div>
      </div>
    </div>
  );
}

// ─── Site tab ───────────────────────────────────────────────────────────────────

function SiteTab({ site, active, onClick, delta }: { site: SiteEntry; active: boolean; onClick: () => void; delta?: number | null }) {
  const why =
    delta == null
      ? undefined
      : delta > 0
        ? `Ahead of your overall score by ${delta.toFixed(1)}`
        : delta < 0
          ? `Trails your overall score by ${Math.abs(delta).toFixed(1)}`
          : "Tied on overall score";
  return (
    <button
      type="button"
      onClick={onClick}
      title={why}
      className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap", active ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30")}
    >
      {site.isUser && <span className="shrink-0 rounded bg-primary-foreground/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider">You</span>}
      <span className="truncate max-w-[100px]">{site.domain}</span>
      {site.overallScore != null && <span className={cn("tabular-nums font-bold shrink-0", active ? "text-primary-foreground/80" : sColor(site.overallScore))}>{site.overallScore.toFixed(1)}</span>}
      {!site.isUser && delta != null && !active && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums shrink-0",
            delta > 0
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : delta < 0
                ? "border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-400"
                : "border-border bg-muted text-muted-foreground"
          )}
        >
          {delta > 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : delta < 0 ? <TrendingDown className="h-3 w-3 shrink-0" /> : <Minus className="h-2.5 w-2.5 shrink-0" />}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}
        </span>
      )}
    </button>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  result: AnalysisResult;
  url: string;
  /** When set with `onCompareSiteIdxChange`, selection is controlled (e.g. dashboard header tabs). */
  compareSiteIdx?: number;
  onCompareSiteIdxChange?: (idx: number) => void;
}

export function ScreenshotCompare({ result, url, compareSiteIdx: controlledIdx, onCompareSiteIdxChange }: Props) {
  const [internalIdx, setInternalIdx] = useState(0);
  const controlled = controlledIdx !== undefined && onCompareSiteIdxChange !== undefined;
  const activeIdx = controlled ? controlledIdx! : internalIdx;
  const setActiveIdx = useCallback(
    (next: number) => {
      if (controlled) onCompareSiteIdxChange!(next);
      else setInternalIdx(next);
    },
    [controlled, onCompareSiteIdxChange]
  );
  const [expandedPin, setExpandedPin] = useState<string | null>(null);
  /** Bumps on each section chip click so the preview scrolls even when re-selecting the same section. */
  const [sectionNavTick, setSectionNavTick] = useState(0);
  const [zoneLens, setZoneLens] = useState<ZoneLens>("balanced");
  const [sectionDeepDive, setSectionDeepDive] = useState<SectionDeepDivePayload | null>(null);
  const [showPins, setShowPins] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [fullWidth, setFullWidth] = useState(false);
  const [viewMode, setViewMode] = useState<"single" | "split" | "slider">("single");
  const [vsIdx, setVsIdx] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [overlayMode, setOverlayMode] = useState<ToolbarOverlayMode>("compare");
  const [fixMode, setFixMode] = useState(false);
  const [simplifyCEO, setSimplifyCEO] = useState(false);
  const [planFocusTick, setPlanFocusTick] = useState(0);
  const [quickWinDismissed, setQuickWinDismissed] = useState(false);
  const zoom = ZOOM_LEVELS[zoomIdx] ?? 1;

  const sites: SiteEntry[] = useMemo(() => {
    const list: SiteEntry[] = [];
    const ud = getDomain(url), ua = result.userAnalysis ?? {};
    const us = SECTION_KEYS.map((k) => parseScoreFromReport(ua[k])).filter((n): n is number => n != null);
    const uavg = us.length ? Math.round((us.reduce((a, b) => a + b, 0) / us.length) * 10) / 10 : null;
    list.push({ url, domain: ud, isUser: true, screenshotUrl: result.targetScreenshotUrl ?? null, analysis: ua, annotations: buildAnnotations(ua), overallScore: result.synthesis?.overall_score ?? uavg });
    for (const comp of result.competitors ?? []) {
      const cd = getDomain(comp.url), ca = comp.analysis ?? {};
      const cs = SECTION_KEYS.map((k) => parseScoreFromReport(ca[k])).filter((n): n is number => n != null);
      const cavg = cs.length ? Math.round((cs.reduce((a, b) => a + b, 0) / cs.length) * 10) / 10 : null;
      list.push({ url: comp.url, domain: cd, isUser: false, screenshotUrl: comp.screenshotUrl ?? null, analysis: ca, annotations: buildAnnotations(ca), overallScore: cavg });
    }
    return list;
  }, [result, url]);

  const userSite = sites[0];
  const activeSite = sites[activeIdx] ?? sites[0];
  const safeVs = sites.length > 1 ? Math.min(Math.max(1, vsIdx), sites.length - 1) : 0;
  const vsSite = sites.length > 1 ? sites[safeVs] : null;

  useEffect(() => { if (sites.length < 2 && viewMode !== "single") setViewMode("single"); }, [sites.length, viewMode]);
  useEffect(() => { if (vsIdx > sites.length - 1 && sites.length > 1) setVsIdx(sites.length - 1); }, [sites.length, vsIdx]);
  useEffect(() => {
    if (!controlled || sites.length === 0) return;
    if (controlledIdx! >= sites.length) onCompareSiteIdxChange!(0);
  }, [controlled, controlledIdx, sites.length, onCompareSiteIdxChange]);

  const deltaVsYou = useCallback((s: SiteEntry) => s.isUser || userSite.overallScore == null || s.overallScore == null ? null : Math.round((s.overallScore - userSite.overallScore) * 10) / 10, [userSite]);

  const decisionBundle = useMemo(() => {
    const heroText = result.userAnalysis?.hero ?? "";
    const heroAnn = userSite?.annotations.find((a) => a.sectionKey === "hero");
    const heroScore = heroAnn?.score ?? null;
    const overall = result.synthesis?.overall_score ?? userSite?.overallScore ?? null;

    const userBySection = Object.fromEntries(
      (userSite?.annotations ?? []).map((a) => [a.sectionKey, a.score])
    ) as Record<SectionOrderKey, number | null>;

    const compSites = sites
      .filter((s) => !s.isUser)
      .map((s) => ({
        label: s.domain,
        bySection: Object.fromEntries(s.annotations.map((a) => [a.sectionKey, a.score])) as Record<
          SectionOrderKey,
          number | null
        >,
      }));

    const rank = rankSites(
      sites.map((s) => ({ label: s.isUser ? "You" : s.domain, score: s.overallScore })),
      "You"
    );

    const losing = rank != null && rank.rank > 1 && sites.length > 1;

    return {
      heroText,
      heroScore,
      overall,
      heroSub: deriveHeroSubMetrics(heroScore, heroText, result.uxSignals ?? undefined),
      conversion: deriveConversionLayer(overall, result.gaps, heroText),
      behavioral: deriveBehavioralUx(result.uxSignals ?? undefined, overall),
      copyMetrics: deriveCopyAnalysis(heroText),
      rank,
      losing,
      gapItems: biggestGaps(userBySection, compSites),
      winNarrative: buildCompetitorWinNarrative(result, activeSite.domain),
      stealThree: stealTopThree(result, activeSite.domain),
      abVariants: abVariantsFromResult(result),
      dataCoverage: dataCoveragePct(result.targetScreenshotUrl ?? null, heroText),
      gapConfidence: result.gaps?.[0]?.confidence,
    };
  }, [result, sites, userSite, activeSite.domain]);

  const competitorAhead =
    !activeSite.isUser &&
    userSite.overallScore != null &&
    activeSite.overallScore != null &&
    activeSite.overallScore > userSite.overallScore;

  const sortedSectionKeys = useMemo(() => {
    return [...SECTION_KEYS].sort((a, b) => {
      const sa = userSite.annotations.find((x) => x.sectionKey === a)?.score ?? 999;
      const sb = userSite.annotations.find((x) => x.sectionKey === b)?.score ?? 999;
      return sa - sb;
    });
  }, [userSite]);

  const centerInsight = useMemo(
    () => heroThreeSecondInsight(decisionBundle.heroScore, decisionBundle.conversion.mainIssue),
    [decisionBundle.heroScore, decisionBundle.conversion.mainIssue]
  );

  const sectionDeltaByKey = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!userSite) return out;
    for (const k of SECTION_KEYS) {
      const u = userSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
      const t = activeSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
      out[k] = u != null && t != null ? Math.round((t - u) * 10) / 10 : null;
    }
    return out;
  }, [userSite, activeSite]);

  /** Split view always compares you vs the selected `vs` competitor (not necessarily `activeSite`). */
  const sectionDeltaVsCompetitor = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!userSite || !vsSite) return out;
    for (const k of SECTION_KEYS) {
      const u = userSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
      const t = vsSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
      out[k] = u != null && t != null ? Math.round((t - u) * 10) / 10 : null;
    }
    return out;
  }, [userSite, vsSite]);

  const showProblemIndicators =
    (viewMode === "split" && (overlayMode === "compare" || overlayMode === "mobile")) ||
    (viewMode === "single" && overlayMode === "compare");

  const eyeOrderByKey = useMemo(() => {
    const sorted = [...userSite.annotations].sort((a, b) => a.top - b.top);
    const m: Record<string, number> = {};
    sorted.forEach((a, i) => {
      m[a.sectionKey] = i + 1;
    });
    return m;
  }, [userSite]);

  const competitorScoresForUser = useMemo(() => {
    if (!vsSite) return undefined;
    const m: Record<string, number | null> = {};
    for (const k of SECTION_KEYS) {
      m[k] = vsSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
    }
    return m;
  }, [vsSite]);

  const tooltipCompareDomain = vsSite?.domain ?? (!activeSite.isUser ? activeSite.domain : null);

  const splitOverallDelta =
    viewMode === "split" && userSite.overallScore != null && vsSite?.overallScore != null
      ? Math.round((userSite.overallScore - vsSite.overallScore) * 10) / 10
      : null;

  const quickWin = useMemo(() => {
    if (!vsSite || quickWinDismissed) return null;
    let best: { key: (typeof SECTION_KEYS)[number]; gap: number } | null = null;
    for (const k of SECTION_KEYS) {
      const u = userSite.annotations.find((a) => a.sectionKey === k)?.score;
      const c = vsSite.annotations.find((a) => a.sectionKey === k)?.score;
      if (u == null || c == null) continue;
      const gap = c - u;
      if (!best || gap > best.gap) best = { key: k, gap };
    }
    if (!best || best.gap <= 0) return null;
    const gaps = result.gaps ?? [];
    const gapRow = gaps.find((g) => matchesSectionKey(g.area, best!.key));
    const fixOne =
      gapRow?.recommendation?.trim() ||
      userSite.annotations.find((a) => a.sectionKey === best.key)?.summary ||
      "Tighten messaging and proof in this section to close the gap.";
    const trimmed = fixOne.length > 120 ? `${fixOne.slice(0, 117)}…` : fixOne;
    const impact = Math.min(18, Math.max(3, Math.round(best.gap * 4)));
    return {
      sectionKey: best.key,
      label: SECTION_ZONES[best.key].label,
      gap: best.gap,
      fixOne: trimmed,
      impact,
    };
  }, [vsSite, quickWinDismissed, result.gaps, userSite]);

  const openSectionMore = useCallback((ann: Annotation) => {
    setSectionDeepDive({
      sectionKey: ann.sectionKey,
      label: ann.label,
      score: ann.score,
      fullText: ann.fullText,
      watchPoints: annotationBulletPoints(ann.fullText, 5),
    });
  }, []);

  const handlePrev = useCallback(() => {
    const next = activeIdx > 0 ? activeIdx - 1 : sites.length - 1;
    setActiveIdx(next);
    setExpandedPin(null);
  }, [activeIdx, sites.length, setActiveIdx]);
  const handleNext = useCallback(() => {
    const next = activeIdx < sites.length - 1 ? activeIdx + 1 : 0;
    setActiveIdx(next);
    setExpandedPin(null);
  }, [activeIdx, sites.length, setActiveIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= Math.min(9, sites.length)) {
        setActiveIdx(n - 1);
        setExpandedPin(null);
      }
      if (e.key === "[" || e.key === "ArrowLeft") handlePrev();
      if (e.key === "]" || e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sites.length, handlePrev, handleNext, setActiveIdx]);

  if (!sites.some((s) => s.screenshotUrl)) return <div className="rounded-2xl border border-dashed border-border p-12 text-center"><p className="text-sm text-muted-foreground">No screenshots available.</p></div>;

  const sectionChipLabel = expandedPin && SECTION_ZONES[expandedPin] ? SECTION_ZONES[expandedPin].label : "Sections";

  const actionPanel = (
    <DecisionActionPanel
      result={result}
      activeSite={{ domain: activeSite.domain, isUser: activeSite.isUser, overallScore: activeSite.overallScore }}
      userSite={{ domain: userSite.domain, isUser: userSite.isUser, overallScore: userSite.overallScore }}
      focusedKey={expandedPin}
      sectionLabel={sectionChipLabel}
      metricsHeadlineScore={
        expandedPin ? activeSite.annotations.find((a) => a.sectionKey === expandedPin)?.score ?? null : decisionBundle.heroScore
      }
      heroScore={decisionBundle.heroScore}
      heroSub={decisionBundle.heroSub}
      conversion={decisionBundle.conversion}
      behavioral={decisionBundle.behavioral}
      copyMetrics={decisionBundle.copyMetrics}
      gapItems={decisionBundle.gapItems}
      winNarrative={decisionBundle.winNarrative}
      stealThree={decisionBundle.stealThree}
      abVariants={decisionBundle.abVariants}
      fixMode={fixMode}
      setFixMode={setFixMode}
      simplifyCEO={simplifyCEO}
      setSimplifyCEO={setSimplifyCEO}
      dataCoveragePct={decisionBundle.dataCoverage}
      gapConfidence={decisionBundle.gapConfidence}
      userOverall={decisionBundle.overall}
      competitorAhead={competitorAhead}
      statusBanner={
        controlled
          ? {
              userScore: userSite.overallScore,
              rank: decisionBundle.rank?.rank ?? null,
              totalRanked: decisionBundle.rank?.total ?? 0,
              losing: decisionBundle.losing,
              conversion: decisionBundle.conversion,
              mainIssue: decisionBundle.conversion.mainIssue,
            }
          : null
      }
      threeSecondInsight={centerInsight}
      sectionDeepDive={sectionDeepDive}
      onCloseSectionDeepDive={() => setSectionDeepDive(null)}
      focusPlanTick={planFocusTick}
    />
  );

  return (
    <div className="space-y-3">
      {!controlled && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <button type="button" onClick={handlePrev} className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {sites.map((s, i) => (
            <SiteTab
              key={s.url}
              site={s}
              active={i === activeIdx}
              onClick={() => {
                setActiveIdx(i);
                setExpandedPin(null);
              }}
              delta={deltaVsYou(s)}
            />
          ))}
          <button type="button" onClick={handleNext} className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Single → Split → Slider → Compare → Attention → Gap heat → Copy | tools */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {([
            { id: "single" as const, icon: LayoutGrid, label: "Single", np: false },
            { id: "split" as const, icon: Columns2, label: "Split", np: true },
            { id: "slider" as const, icon: Blend, label: "Slider", np: true },
          ] as const).map(({ id, icon: I, label, np }) => (
            <button key={id} type="button" disabled={np && sites.length < 2} onClick={() => setViewMode(id)} className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors", viewMode === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground", np && sites.length < 2 && "opacity-40 cursor-not-allowed")}><I className="h-3.5 w-3.5" />{label}</button>
          ))}
          {([
            { id: "compare" as const, label: "Compare", icon: ScanEye },
            { id: "attention" as const, label: "Attention", icon: MousePointer2 },
            { id: "heatmap" as const, label: "Gap heat", icon: BarChart3 },
            { id: "copy" as const, label: "Copy", icon: Type },
            { id: "trust" as const, label: "Trust", icon: Shield },
            { id: "readability" as const, label: "Read", icon: BookOpen },
            { id: "mobile" as const, label: "Mobile", icon: Smartphone },
            { id: "first5s" as const, label: "First 5s", icon: Timer },
            { id: "conversion" as const, label: "Conversion", icon: Target },
          ] as const).map(({ id, label, icon: I }) => (
            <button
              key={id}
              type="button"
              onClick={() => setOverlayMode(id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                overlayMode === id ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <I className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
          {(viewMode === "split" || viewMode === "slider") && vsSite && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <span className="text-[10px] text-muted-foreground">vs</span>
              <select value={safeVs} onChange={(e) => setVsIdx(Number(e.target.value))} className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium">{sites.slice(1).map((s, i) => <option key={s.url} value={i + 1}>{s.domain}</option>)}</select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
          <button type="button" onClick={() => setShowPins((v) => !v)} className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold", showPins ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{showPins ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}Pins</button>
          <button type="button" onClick={() => setShowZones((v) => !v)} className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold", showZones ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>Zones</button>
          <button type="button" onClick={() => setFullWidth((v) => !v)} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">{fullWidth ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}{fullWidth ? "Normal" : "Wide"}</button>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button type="button" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} className="p-1 rounded hover:bg-muted disabled:opacity-40"><ZoomOut className="h-3 w-3" /></button>
            <span className="text-[10px] font-mono font-bold w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIdx >= ZOOM_LEVELS.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-40"><ZoomIn className="h-3 w-3" /></button>
          </div>
        </div>
      </div>

      {/* Screenshot | Action plan */}
      <div
        className={cn(
          "grid gap-4 items-start",
          fullWidth ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_minmax(323px,391px)]"
        )}
      >
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/25 px-2 py-1.5">
            <span className="text-[10px] font-bold uppercase text-muted-foreground shrink-0">Lens</span>
            {(
              [
                { id: "balanced" as const, label: "Balanced", icon: Sparkles },
                { id: "rich" as const, label: "Visual+", icon: BarChart3 },
                { id: "hot" as const, label: "Hot", icon: Flame },
                { id: "delta" as const, label: "Δ vs you", icon: ArrowLeftRight },
              ] as const
            ).map(({ id, label, icon: I }) => {
              const disabled = id === "delta" && activeSite.isUser;
              return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setZoneLens(id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase transition-colors",
                  zoneLens === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <I className="h-3 w-3 shrink-0" />
                {label}
              </button>
            );})}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
            {sortedSectionKeys.map((key) => {
              const ann = activeSite.annotations.find((a) => a.sectionKey === key);
              const uSc = userSite.annotations.find((a) => a.sectionKey === key)?.score ?? null;
              const compSc =
                vsSite?.annotations.find((a) => a.sectionKey === key)?.score ??
                (!activeSite.isUser ? activeSite.annotations.find((a) => a.sectionKey === key)?.score : null);
              const gapPts =
                uSc != null && compSc != null ? Math.round((uSc - compSc) * 10) / 10 : null;
              const priority = sectionPriorityFromGap(key, result.gaps, uSc);
              const insightLine =
                userSite.annotations.find((a) => a.sectionKey === key)?.summary ?? "—";
              const chipUser = chipUnderlineClass(uSc);
              return (
                <Tooltip key={key} delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedPin(key);
                        setSectionNavTick((n) => n + 1);
                      }}
                      className={cn(
                        "group relative rounded-full border px-2.5 pb-1.5 pt-1 text-[10px] font-semibold transition-colors",
                        expandedPin === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="block">
                        {SECTION_ZONES[key].label}
                        {ann?.score != null && (
                          <span className={cn("ml-1 tabular-nums", sColor(ann.score))}>{ann.score.toFixed(1)}</span>
                        )}
                      </span>
                      <span
                        className={cn("absolute bottom-0 left-1 right-1 h-[3px] rounded-full", chipUser)}
                        aria-hidden
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="w-[280px] max-w-[80vw] border-border bg-gray-900 p-3 text-white shadow-xl dark:bg-gray-950"
                  >
                    <p className="text-[11px] font-semibold text-white">
                      You {uSc != null ? uSc.toFixed(1) : "—"} vs {tooltipCompareDomain ?? "competitor"}{" "}
                      {compSc != null ? compSc.toFixed(1) : "—"}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-200">
                      Gap:{" "}
                      {gapPts == null ? (
                        "—"
                      ) : (
                        <span className="font-bold tabular-nums">
                          {gapPts > 0 ? "+" : ""}
                          {gapPts.toFixed(1)} pts
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          priority === "P1"
                            ? "bg-red-500/30 text-red-100"
                            : priority === "P2"
                              ? "bg-amber-500/30 text-amber-100"
                              : "bg-slate-500/30 text-slate-100"
                        )}
                      >
                        {priority}
                      </span>
                    </p>
                    <p className="mt-2 text-[10px] leading-snug text-gray-300">{insightLine}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {quickWin && sites.length > 1 && (
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 shadow-sm dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50">
              <span className="min-w-0 flex-1 leading-snug">
                <span className="font-bold">⚡ Quick Win:</span>{" "}
                <span className="font-semibold">{quickWin.label}</span> — {quickWin.fixOne} → est.{" "}
                <span className="font-bold tabular-nums">+{quickWin.impact}%</span> impact
              </span>
              <button
                type="button"
                onClick={() => setPlanFocusTick((n) => n + 1)}
                className="shrink-0 rounded-full border border-amber-600/40 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-950 hover:bg-amber-200 dark:border-amber-400/50 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/80"
              >
                Fix this →
              </button>
              <button
                type="button"
                onClick={() => setQuickWinDismissed(true)}
                className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-200/80 dark:text-amber-200 dark:hover:bg-amber-900/60"
                aria-label="Dismiss quick win"
              >
                ×
              </button>
            </div>
          )}

          {viewMode === "single" &&
            (activeSite.screenshotUrl ? (
              <ScreenshotFrame
                site={activeSite}
                showZones={showZones}
                showPins={showPins}
                expandedPin={expandedPin}
                setExpandedPin={setExpandedPin}
                zoom={zoom}
                overlayMode={overlayMode}
                sectionNavTick={sectionNavTick}
                zoneLens={zoneLens}
                deltaByKey={activeSite.isUser ? undefined : sectionDeltaByKey}
                onSectionMore={openSectionMore}
                problemIndicators={showProblemIndicators}
                eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                competitorScores={
                  showProblemIndicators && activeSite.isUser && vsSite ? competitorScoresForUser : undefined
                }
                deltaLensTint={zoneLens === "delta" && !activeSite.isUser}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No screenshot.</div>
            ))}

          {viewMode === "split" && userSite && vsSite && (
            <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-wide">You</p>
                <ScreenshotFrame
                  site={userSite}
                  showZones={showZones}
                  showPins={showPins}
                  expandedPin={expandedPin}
                  setExpandedPin={setExpandedPin}
                  zoom={zoom}
                  overlayMode={overlayMode}
                  sectionNavTick={sectionNavTick}
                  zoneLens={zoneLens}
                  deltaByKey={undefined}
                  onSectionMore={openSectionMore}
                  problemIndicators={showProblemIndicators}
                  eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                  competitorScores={showProblemIndicators ? competitorScoresForUser : undefined}
                  deltaLensTint={false}
                />
              </div>
              <div className="relative flex w-full shrink-0 flex-col items-center justify-center border-y border-border/80 py-2 md:w-11 md:border-x md:border-y-0 md:py-0">
                {splitOverallDelta != null && (
                  <div className="sticky top-[38vh] z-10 flex w-full flex-col items-center justify-center">
                    <div
                      className={cn(
                        "rounded-full border px-2.5 py-1.5 text-[11px] font-bold tabular-nums shadow-md backdrop-blur-sm bg-background/95 dark:bg-card/95",
                        splitOverallDelta > 0
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : splitOverallDelta < 0
                            ? "border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-400"
                            : "border-border bg-muted/90 text-muted-foreground"
                      )}
                    >
                      {splitOverallDelta > 0 ? "+" : ""}
                      {splitOverallDelta.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-wide">vs {vsSite.domain}</p>
                <ScreenshotFrame
                  site={vsSite}
                  showZones={showZones}
                  showPins={showPins}
                  expandedPin={expandedPin}
                  setExpandedPin={setExpandedPin}
                  zoom={zoom}
                  overlayMode={overlayMode}
                  sectionNavTick={sectionNavTick}
                  zoneLens={zoneLens}
                  deltaByKey={sectionDeltaVsCompetitor}
                  onSectionMore={openSectionMore}
                  problemIndicators={showProblemIndicators}
                  eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                  competitorScores={undefined}
                  deltaLensTint={zoneLens === "delta"}
                />
              </div>
            </div>
          )}

          {zoneLens === "delta" && (viewMode === "split" || !activeSite.isUser) && vsSite && (
            <p className="text-center text-[10px] text-muted-foreground dark:text-muted-foreground/90">
              🟢 Competitor advantage · 🔴 Your advantage
            </p>
          )}

          {viewMode === "slider" && userSite && vsSite && userSite.screenshotUrl && vsSite.screenshotUrl && (
            <SliderCompare left={userSite} right={vsSite} leftLabel="You" rightLabel={vsSite.domain} />
          )}

          {!activeSite.isUser && userSite && (
            <div className="rounded-xl border border-dashed border-border p-2.5 bg-muted/20">
              <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1"><BarChart3 className="h-3 w-3" />Δ vs you</p>
              <div className="flex flex-wrap gap-1.5">
                {SECTION_KEYS.map((key) => {
                  const u = userSite.annotations.find((a) => a.sectionKey === key)?.score;
                  const t = activeSite.annotations.find((a) => a.sectionKey === key)?.score;
                  const d = u != null && t != null ? Math.round((t - u) * 10) / 10 : null;
                  return (
                    <div key={key} className="rounded-lg bg-card border border-border px-2 py-1 text-[10px]">
                      <span className="text-muted-foreground">{SECTION_ZONES[key].short}:</span>{" "}
                      {d == null ? (
                        "—"
                      ) : (
                        <span className={cn("font-bold", d > 0 ? "text-emerald-500" : d < 0 ? "text-red-500" : "text-muted-foreground")}>
                          {d > 0 ? "+" : ""}
                          {d.toFixed(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!fullWidth && <div className="hidden lg:block min-w-0 sticky top-4">{actionPanel}</div>}
      </div>

      {fullWidth && <div className="max-h-[min(88vh,900px)]">{actionPanel}</div>}

      {!controlled && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(sites.length, 5)}, 1fr)` }}>
          {sites.map((site, i) => (
            <button
              key={site.url}
              type="button"
              onClick={() => {
                setActiveIdx(i);
                setExpandedPin(null);
              }}
              className={cn("rounded-xl border p-2.5 text-left transition-all", i === activeIdx ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30")}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-semibold text-foreground truncate">{site.domain}</span>
                {site.overallScore != null && (
                  <span className={cn("text-[10px] font-bold tabular-nums shrink-0", sColor(site.overallScore))}>{site.overallScore.toFixed(1)}</span>
                )}
              </div>
              <div className="flex gap-0.5">
                {SECTION_KEYS.map((key) => {
                  const s = site.annotations.find((a) => a.sectionKey === key)?.score;
                  return (
                    <div
                      key={key}
                      className={cn("flex-1 h-1 rounded-full", sBg(s))}
                      title={`${SECTION_ZONES[key].short}: ${s?.toFixed(1) ?? "—"}`}
                    />
                  );
                })}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

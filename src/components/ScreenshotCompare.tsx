import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
  type SyntheticEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { cn, getDomain, parseScoreFromReport } from "@/lib/utils";
import type { AnalysisResult } from "@/types/api";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Lightbulb,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart3,
  MousePointer2,
  ChevronDown,
  Check,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_COMPETITORS } from "@/lib/constants";
import { HintTooltip } from "@/components/HintTooltip";
import {
  HINT_ANALYZE,
  HINT_CONTROLS,
  hintSiteTab,
  type ToolbarHintContent,
} from "@/lib/compareUiHints";
import {
  DecisionActionPanel,
  CompareOverlayLayer,
  type CompareOverlayLayerMode,
} from "@/components/CompareDecisionPanels";
import { AiLabelMarkers } from "@/components/AiLabelMarkers";
import { SectionAiPreviewModal } from "@/components/SectionAiPreviewModal";
import { useSectionPreview } from "@/hooks/useSectionPreview";
import { cropSectionToJpegBase64 } from "@/lib/sectionScreenshotCrop";
import { HeatmapOverlay } from "@/components/HeatmapOverlay";
import { buildSimulateAiLabelRows } from "@/lib/simulateAiLabels";
import { buildUnifiedAiLabelRowsForMode } from "@/lib/unifiedAiLabels";
import type { HistoryEntry } from "@/lib/analysisHistory";
import type { AttentionHeatmapResponse, AttentionZone } from "@/types/attention";
import { fetchAttentionHeatmap } from "@/lib/api";
import { normalizeAttentionResponse } from "@/lib/attentionNormalize";
import { ATTENTION_DEMO_ZONES } from "@/lib/attentionDemoZones";
import { screenshotUrlToImageBase64 } from "@/lib/screenshotToBase64";
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
import {
  buildSimulateItems,
  fillMissingSectionSimulateItems,
  getSimulateOverlayPercentRect,
  type SimulateImprovementItem,
} from "@/lib/simulateWhatIf";
import type { SimulateAiLabelRow } from "@/lib/simulateAiLabels";
import type { SectionDeepDivePayload } from "@/components/CompareDecisionPanels";
import {
  type ToolbarContext,
  type ToolbarViewMode,
  getRightPanelHeader,
  formatToolbarContextForEmpty,
  sectionPassesToolbarFilters,
} from "@/lib/compareToolbarContext";

// ─── Constants ──────────────────────────────────────────────────────────────────

const SECTION_ZONES: Record<string, { top: number; height: number; label: string; short: string }> = {
  hero:               { top: 0,   height: 20, label: "Hero",         short: "Hero" },
  "value proposition": { top: 18,  height: 17, label: "Value Prop",   short: "Val" },
  features:           { top: 33,  height: 22, label: "Features",     short: "Feat" },
  "social proof":     { top: 53,  height: 19, label: "Social Proof", short: "Social" },
  CTA:                { top: 70,  height: 20, label: "CTA",          short: "CTA" },
};

const SECTION_KEYS = ["hero", "value proposition", "features", "social proof", "CTA"] as const;

/** When section text has no parseable X/10, show these baseline scores on the screenshot chips. */
const SCREENSHOT_SECTION_FALLBACK_SCORES: Record<(typeof SECTION_KEYS)[number], number> = {
  hero: 7.0,
  "value proposition": 6.0,
  features: 8.0,
  "social proof": 8.0,
  CTA: 6.0,
};

const ZOOM_LEVELS = [1, 1.25, 1.5, 1.75] as const;

/** Split column toolbar: site pill + AI Tips / zoom / heatmap / wide / grid-back — 28px row height. */
const COMPACT_TOOLBAR_ROW = "h-7 min-h-7";

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

/** Default split opponent: overall #1 in the report if that site is a competitor; otherwise the highest-scoring competitor. */
function defaultVsSiteIndex(sites: SiteEntry[]): number {
  if (sites.length < 2) return 1;
  const ranked = sites
    .map((s, i) => ({ i, s, score: s.overallScore }))
    .filter((x): x is { i: number; s: SiteEntry; score: number } => x.score != null)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return 1;
  const top = ranked[0];
  if (!top.s.isUser) return top.i;
  const bestComp = ranked.find((x) => !x.s.isUser);
  return bestComp?.i ?? 1;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function extractFirstSentence(text: string): string {
  const c = text.replace(/\*\*/g, "").replace(/^#{1,4}\s+.*/gm, "").replace(/^\s*[-•]\s*/gm, "").replace(/\d+(\.\d+)?\s*\/\s*10/g, "").trim();
  const m = c.match(/[A-Z][^.!?]{10,120}[.!?]/);
  return m ? m[0].trim() : c.slice(0, 120).trim();
}

function sectionScoreForScreenshot(
  analysis: Record<string, string>,
  key: (typeof SECTION_KEYS)[number]
): number {
  const parsed = parseScoreFromReport(analysis[key]);
  return parsed ?? SCREENSHOT_SECTION_FALLBACK_SCORES[key];
}

function buildAnnotations(analysis: Record<string, string>): Annotation[] {
  return SECTION_KEYS.map((key) => {
    const zone = SECTION_ZONES[key];
    const text = analysis[key] ?? "";
    return {
      sectionKey: key,
      label: zone.label,
      score: sectionScoreForScreenshot(analysis, key),
      summary: text ? extractFirstSentence(text) : "No data",
      preview: text ? annotationPreview(text, 360) : "",
      fullText: text,
      top: zone.top,
      height: zone.height,
    };
  });
}

function competitorGridFaviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function normalizeCompetitorUrlInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function sColor(s: number | null) {
  if (s == null) return "text-muted-foreground";
  if (s >= 7.5) return "text-primary";
  if (s >= 5) return "text-amber-500";
  return "text-red-500";
}

function sBg(s: number | null) {
  if (s == null) return "bg-muted";
  if (s >= 7.5) return "bg-primary";
  if (s >= 5) return "bg-amber-500";
  return "bg-red-500";
}

function sBorder(s: number | null) {
  if (s == null) return "border-muted-foreground/40 bg-muted/60";
  if (s >= 7.5) return "border-primary/60 bg-primary/10";
  if (s >= 5) return "border-amber-500/60 bg-amber-500/10";
  return "border-red-500/60 bg-red-500/10";
}

/** Toolbar overlay modes: layer modes + mobile frame (no extra SVG layer). */
type ToolbarOverlayMode = CompareOverlayLayerMode | "mobile";

const CIRCLED_EYE_ORDER = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

function matchesSectionKey(lbl: string, key: string): boolean {
  const h = lbl.toLowerCase(), k = key.toLowerCase();
  if (k === "hero") return h.includes("hero");
  if (k === "value proposition") return h.includes("value") || h.includes("prop");
  if (k === "features") return h.includes("feature");
  if (k === "social proof") return h.includes("social") || h.includes("proof") || h.includes("testimonial");
  if (k === "cta") return h.includes("cta") || h.includes("call to action");
  return false;
}

type ZoneLens = "balanced" | "delta";

function SectionZones({
  annotations,
  show,
  zoneLens,
  deltaByKey,
  problemIndicators,
  eyeOrderByKey,
  competitorScores,
  siteIsUser,
  compareDiffMode,
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
  /** VIEW Compare: green = competitor does better, red = you do better (uses comp−user delta). */
  compareDiffMode?: boolean;
}) {
  if (!show) return null;
  return (
    <>
      {annotations.map((a) => {
        const sc = a.score;
        const showDelta = zoneLens === "delta" && deltaByKey && deltaByKey[a.sectionKey] != null;
        const delta = showDelta ? deltaByKey![a.sectionKey]! : null;
        const lowScoreProblem = Boolean(problemIndicators && sc != null && sc < 7);
        const ord = eyeOrderByKey?.[a.sectionKey];
        const eyeLabel =
          ord != null && ord >= 1 && ord <= CIRCLED_EYE_ORDER.length ? CIRCLED_EYE_ORDER[ord - 1] : null;
        const compSc = competitorScores?.[a.sectionKey];
        const theyBetter =
          Boolean(siteIsUser) && sc != null && compSc != null && compSc - sc >= 1.5;
        const cd = compareDiffMode && deltaByKey && deltaByKey[a.sectionKey] != null ? deltaByKey[a.sectionKey]! : null;
        const compareDiffClass =
          compareDiffMode && cd != null
            ? cd > 0.08
              ? "border-primary/55 z-[2] bg-transparent"
              : cd < -0.08
                ? "border-red-500/55 z-[2] bg-transparent"
                : "border-border/70 z-[1] bg-transparent"
            : null;
        return (
          <div
            key={a.sectionKey}
            className={cn(
              "absolute left-0 right-0 pointer-events-none transition-colors rounded-lg bg-transparent",
              !compareDiffMode && !lowScoreProblem && "border-t border-b",
              compareDiffMode && compareDiffClass,
              !compareDiffMode &&
                (sc != null && sc >= 7.5
                  ? "border-primary/35"
                  : sc != null && sc >= 5
                    ? "border-amber-500/35"
                    : sc != null
                      ? "border-red-500/40"
                      : "border-muted-foreground/25"),
              !compareDiffMode && lowScoreProblem && "z-[4] border-2 border-dashed border-red-500 dark:border-red-400"
            )}
            style={{ top: `${a.top}%`, height: `${a.height}%` }}
          >
            {delta != null && (
              <div className="absolute right-1.5 bottom-1.5 pointer-events-none rounded-md px-1.5 py-0.5 text-[9px] font-bold bg-background/95 border border-border shadow-sm backdrop-blur-sm z-[5]">
                <span className={delta > 0 ? "text-primary" : delta < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
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
              <div className="absolute right-1 top-1 z-[6] max-w-[min(100%,140px)] rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[8px] font-bold leading-tight text-primary shadow-sm backdrop-blur-sm dark:text-primary">
                ↑ They do this better
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
  expandedPin,
  zoom,
  overlayMode,
  sectionNavTick,
  zoneLens,
  deltaByKey,
  problemIndicators,
  eyeOrderByKey,
  competitorScores,
  compareDiffMode,
  heatmapGapPairByKey,
  heatmapGapOnCompetitorOnly,
  attentionOverlay,
  simulateOverlayRows,
  simulateAiLabelsSlot,
}: {
  site: SiteEntry;
  showZones: boolean;
  expandedPin: string | null;
  zoom: number;
  overlayMode: ToolbarOverlayMode;
  /** Increments on each section chip click so re-selecting the same tab still scrolls. */
  sectionNavTick: number;
  zoneLens: ZoneLens;
  deltaByKey?: Record<string, number | null>;
  problemIndicators?: boolean;
  eyeOrderByKey?: Record<string, number>;
  competitorScores?: Record<string, number | null>;
  compareDiffMode?: boolean;
  heatmapGapPairByKey?: Record<string, { user: number | null; comp: number | null }>;
  heatmapGapOnCompetitorOnly?: boolean;
  /** Analyze → Attention: Claude Vision heatmap + toggle. */
  attentionOverlay?: {
    zones: AttentionZone[] | null;
    layerVisible: boolean;
    onLayerVisibleChange: (v: boolean) => void;
    loading: boolean;
    showPlaceholder: boolean;
  } | null;
  /** What-if Simulator: green dashed zones on your screenshot when items are checked. */
  simulateOverlayRows?: Array<{ sectionKey: string; pillText: string }> | null;
  /** SIMULATE-linked AI annotation labels (your screenshot, Split/Compare + SIMULATE tab). */
  simulateAiLabelsSlot?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
    (_e: SyntheticEvent<HTMLImageElement>) => {
      scrollToExpandedSection();
    },
    [scrollToExpandedSection]
  );

  useLayoutEffect(() => {
    scrollToExpandedSection();
  }, [scrollToExpandedSection, sectionNavTick, zoom, site.screenshotUrl]);

  if (!site.screenshotUrl) return <div className="flex items-center justify-center min-h-[200px] text-sm text-muted-foreground bg-muted/20 rounded-xl">No screenshot for {site.domain}</div>;
  return (
    <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-border bg-background scrollbar-hide"
        style={{ cursor: zoom > 1 ? "grab" : undefined }}
      >
      <div
        className={cn(
          "relative overflow-visible inline-block min-w-full origin-top transition-transform duration-150 ease-out",
          mobileFrame && "mx-auto block max-w-[390px] shadow-2xl ring-2 ring-border/80 dark:ring-border/60 rounded-xl"
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
          compareDiffMode={compareDiffMode}
        />
        <CompareOverlayLayer
          mode={layerMode}
          annotations={site.annotations.map((a) => ({
            top: a.top,
            height: a.height,
            score: a.score,
            label: a.label,
            sectionKey: a.sectionKey,
          }))}
          heatmapGapPairByKey={heatmapGapPairByKey}
          heatmapGapOnCompetitorOnly={heatmapGapOnCompetitorOnly}
          siteIsUser={site.isUser}
          attention={null}
        />
        {overlayMode === "attention" &&
          attentionOverlay &&
          attentionOverlay.layerVisible &&
          attentionOverlay.zones &&
          attentionOverlay.zones.length > 0 && (
            <HeatmapOverlay zones={attentionOverlay.zones} />
          )}
        {site.isUser && simulateOverlayRows && simulateOverlayRows.length > 0 && (
          <>
            {simulateOverlayRows.map((row) => {
              const cta = site.annotations.find((a) => a.sectionKey === "CTA");
              const rect = getSimulateOverlayPercentRect(
                row.sectionKey as SectionOrderKey,
                cta ? { top: cta.top, height: cta.height } : null
              );
              return (
                <div
                  key={row.sectionKey}
                  className="pointer-events-none absolute left-2 right-2 z-[20] rounded-lg border-2 border-dashed border-[#1D9E75] bg-transparent transition-opacity duration-300 ease-out"
                  style={{ top: `${rect.top}%`, height: `${rect.height}%` }}
                >
                  <span className="absolute left-2 top-2 max-w-[min(100%,calc(100%-1rem))] truncate rounded-full border border-[#1D9E75]/40 bg-[#1D9E75]/18 px-2 py-0.5 text-[10px] font-semibold text-[#0d5c44] shadow-sm dark:text-[#8ee8c8]">
                    {row.pillText}
                  </span>
                </div>
              );
            })}
          </>
        )}
        {simulateAiLabelsSlot}
        {attentionOverlay?.loading && overlayMode === "attention" && (
          <div className="pointer-events-none absolute right-2 top-2 z-[24] flex max-w-[200px] flex-col gap-0.5 rounded-lg border border-border bg-background/95 px-2 py-1.5 text-left shadow-sm">
            <p className="text-[10px] font-semibold text-foreground">Analyzing attention…</p>
            <p className="text-[9px] leading-snug text-muted-foreground">Claude Vision — up to a minute.</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ─── Slider compare ─────────────────────────────────────────────────────────────

function SliderCompare({
  left,
  right,
  leftLabel,
  rightLabel,
  leftZoom,
  rightZoom,
}: {
  left: SiteEntry;
  right: SiteEntry;
  leftLabel: string;
  rightLabel: string;
  /** Independent column zoom — combined for one aligned stack (average keeps the divider meaningful). */
  leftZoom: number;
  rightZoom: number;
}) {
  const [pct, setPct] = useState(50);
  if (!left.screenshotUrl || !right.screenshotUrl) return null;
  const stackZoom = (leftZoom + rightZoom) / 2;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <HintTooltip
        side="top"
        title={HINT_CONTROLS.slider.title}
        description={HINT_CONTROLS.slider.description}
        action={HINT_CONTROLS.slider.action}
      >
        <input
          type="range"
          min={5}
          max={95}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full h-1.5 shrink-0 accent-primary cursor-ew-resize rounded-full"
          aria-label="Comparison: drag the divider between screenshots"
        />
      </HintTooltip>
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-border bg-background select-none scrollbar-hide">
        <div
          className="relative min-h-[120px] inline-block min-w-full origin-top transition-transform duration-150 ease-out"
          style={{ transform: `scale(${stackZoom})`, transformOrigin: "top center" }}
        >
          <img src={right.screenshotUrl} alt={rightLabel} className="w-full h-auto block" draggable={false} />
          <img src={left.screenshotUrl} alt={leftLabel} className="absolute top-0 left-0 w-full h-auto pointer-events-none" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} draggable={false} />
          <div className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_12px_rgba(0,0,0,0.4)] z-30 pointer-events-none" style={{ left: `${pct}%`, transform: "translateX(-50%)" }} />
          <div className="absolute bottom-2 left-2 z-30 rounded-md bg-background/90 px-2 py-1 text-[10px] font-bold text-foreground border border-border">{leftLabel}</div>
          <div className="absolute bottom-2 right-2 z-30 rounded-md bg-background/90 px-2 py-1 text-[10px] font-bold text-foreground border border-border">{rightLabel}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Site tab ───────────────────────────────────────────────────────────────────

function SiteTab({ site, active, onClick, delta }: { site: SiteEntry; active: boolean; onClick: () => void; delta?: number | null }) {
  const h = hintSiteTab(site.isUser, site.domain, delta);
  return (
    <HintTooltip title={h.title} description={h.description} action={h.action} side="bottom">
      <button
        type="button"
        onClick={onClick}
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
                ? "border-primary/50 bg-primary/15 text-primary"
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
    </HintTooltip>
  );
}

/** AI tip labels on screenshots — same control beside each URL row (global on/off). */
function AiTipsColumnButton({
  active,
  onToggle,
  pushToolbarHelp,
  compact,
}: {
  active: boolean;
  onToggle: () => void;
  pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  compact?: boolean;
}) {
  return (
    <HintTooltip side="bottom" title={HINT_CONTROLS.aiTips.title} description={HINT_CONTROLS.aiTips.description} action={HINT_CONTROLS.aiTips.action}>
      <button
        type="button"
        onClick={() => {
          pushToolbarHelp("ctrl-ai-tips", HINT_CONTROLS.aiTips);
          onToggle();
        }}
        aria-pressed={active}
        aria-label="AI Tips"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors",
          compact
            ? cn(COMPACT_TOOLBAR_ROW, "w-7 px-0 text-[9px]")
            : "size-8 px-0 text-[11px]",
          active
            ? "border-[#1D9E75]/50 bg-[#1D9E75]/10 text-[#0f6b4f] dark:text-[#8ee8c8]"
            : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <Lightbulb className={cn("shrink-0 opacity-90", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      </button>
    </HintTooltip>
  );
}

/** Zoom — after Heatmap in each column; state is keyed by site URL in the parent. */
function ZoomColumnControls({
  zoomIdx,
  onZoomOut,
  onZoomIn,
  pushToolbarHelp,
  compact,
}: {
  zoomIdx: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  compact?: boolean;
}) {
  const zoom = ZOOM_LEVELS[zoomIdx] ?? 1;
  return (
    <div
      className={cn(
        "flex shrink-0 gap-0.5 rounded-lg border border-border px-0.5",
        compact ? cn(COMPACT_TOOLBAR_ROW, "items-stretch py-0") : "items-center p-0.5"
      )}
    >
      <HintTooltip
        side="bottom"
        title={HINT_CONTROLS.zoomOut.title}
        description={HINT_CONTROLS.zoomOut.description}
        action={HINT_CONTROLS.zoomOut.action}
        disabled={zoomIdx === 0}
      >
        <button
          type="button"
          onClick={() => {
            pushToolbarHelp("ctrl-zoom-out", HINT_CONTROLS.zoomOut);
            onZoomOut();
          }}
          disabled={zoomIdx === 0}
          className={cn(
            "flex items-center justify-center rounded hover:bg-muted disabled:opacity-40",
            compact ? "h-full min-h-0 px-1 py-0" : "p-1"
          )}
          aria-label="Zoom out"
        >
          <ZoomOut className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
        </button>
      </HintTooltip>
      <span
        className={cn(
          "inline-flex items-center justify-center font-mono font-bold text-muted-foreground tabular-nums",
          compact ? "w-8 shrink-0 self-stretch text-[9px]" : "w-10 text-center text-[10px]"
        )}
      >
        {Math.round(zoom * 100)}%
      </span>
      <HintTooltip
        side="bottom"
        title={HINT_CONTROLS.zoomIn.title}
        description={HINT_CONTROLS.zoomIn.description}
        action={HINT_CONTROLS.zoomIn.action}
        disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
      >
        <button
          type="button"
          onClick={() => {
            pushToolbarHelp("ctrl-zoom-in", HINT_CONTROLS.zoomIn);
            onZoomIn();
          }}
          disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
          className={cn(
            "flex items-center justify-center rounded hover:bg-muted disabled:opacity-40",
            compact ? "h-full min-h-0 px-1 py-0" : "p-1"
          )}
          aria-label="Zoom in"
        >
          <ZoomIn className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
        </button>
      </HintTooltip>
    </div>
  );
}

/** Analyze → Heatmap — same control beside each site URL row (per-site visibility). */
function HeatmapColumnButton({
  active,
  onToggle,
  pushToolbarHelp,
  compact,
}: {
  active: boolean;
  onToggle: () => void;
  pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  compact?: boolean;
}) {
  return (
    <HintTooltip
      side="bottom"
      title={HINT_ANALYZE.attention.title}
      description={HINT_ANALYZE.attention.description}
      action={HINT_ANALYZE.attention.action}
    >
      <button
        type="button"
        onClick={() => {
          pushToolbarHelp("analyze-attention", HINT_ANALYZE.attention);
          onToggle();
        }}
        aria-pressed={active}
        aria-label="Heatmap"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors",
          compact
            ? cn(COMPACT_TOOLBAR_ROW, "w-7 px-0 text-[9px]")
            : "size-8 px-0 text-[11px]",
          active
            ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <MousePointer2 className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      </button>
    </HintTooltip>
  );
}

/** Wide layout toggle — same control beside each site URL row above screenshots (lg+ panel). */
function WideLayoutButton({
  fullWidth,
  onToggle,
  pushToolbarHelp,
  compact,
}: {
  fullWidth: boolean;
  onToggle: () => void;
  pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  /** Match SplitSiteColumnPicker `compact` sizing. */
  compact?: boolean;
}) {
  return (
    <HintTooltip side="bottom" title={HINT_CONTROLS.wide.title} description={HINT_CONTROLS.wide.description} action={HINT_CONTROLS.wide.action}>
      <button
        type="button"
        onClick={() => {
          pushToolbarHelp("ctrl-wide", HINT_CONTROLS.wide);
          onToggle();
        }}
        aria-label={fullWidth ? "Normal width" : "Wide layout"}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border border-border font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
          compact ? cn(COMPACT_TOOLBAR_ROW, "w-7 px-0") : "size-8"
        )}
      >
        {fullWidth ? <Minimize2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> : <Maximize2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      </button>
    </HintTooltip>
  );
}

/** Exit wide / full-width — same row as site + AI Tips / Heatmap / Zoom / Wide (not on the screenshot). */
function ScreenshotWideExitButton({
  "aria-label": ariaLabel,
  title,
  onClose,
}: {
  "aria-label": string;
  title?: string;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      title={title ?? ariaLabel}
      aria-label={ariaLabel}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center self-stretch rounded-lg border border-border bg-background/95 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </button>
  );
}

function SplitSiteColumnPicker({
  sites,
  valueIdx,
  onSelect,
  compact,
  aiTips,
  zoom,
  heatmap,
  wideLayout,
}: {
  sites: SiteEntry[];
  valueIdx: number;
  onSelect: (idx: number) => void;
  /** Tighter pill for stacked layout above section chips. */
  compact?: boolean;
  /** AI Tips on screenshots — global toggle, same button on every column. */
  aiTips?: {
    active: boolean;
    onToggle: () => void;
    pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  };
  /** Per-site zoom — left of Heatmap. */
  zoom?: {
    zoomIdx: number;
    onZoomOut: () => void;
    onZoomIn: () => void;
    pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  };
  /** Heatmap toggle to the right of the URL row (per site). */
  heatmap?: {
    active: boolean;
    onToggle: () => void;
    pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  };
  /** Wide layout control to the right of the URL row (same for every column). */
  wideLayout?: {
    fullWidth: boolean;
    onToggle: () => void;
    pushToolbarHelp: (id: string, hint: ToolbarHintContent) => void;
  };
}) {
  const site = sites[valueIdx];
  if (!site) return null;
  const picker = (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 items-center rounded-lg border border-border font-semibold text-muted-foreground transition-colors hover:text-foreground",
        compact ? cn(COMPACT_TOOLBAR_ROW, "gap-1 px-2 py-0 text-[10px]") : "gap-1.5 px-2.5 py-1.5 text-[11px]"
      )}
    >
      {site.isUser && (
        <span className="shrink-0 rounded bg-emerald-600/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
          You
        </span>
      )}
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 truncate font-semibold uppercase tracking-wide text-foreground hover:underline decoration-primary/60 underline-offset-2"
        title={site.url}
      >
        {site.domain}
      </a>
      <span
        className={cn(
          "shrink-0 font-bold tabular-nums",
          site.overallScore != null ? sColor(site.overallScore) : "text-muted-foreground"
        )}
      >
        {site.overallScore != null ? `${site.overallScore.toFixed(1)}/10` : "—"}
      </span>
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md p-0.5 text-primary transition-colors hover:bg-primary/10"
        aria-label="Open site in new tab"
      >
        <ExternalLink className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded-md p-0.5 text-primary transition-colors hover:bg-primary/10"
            aria-label="Other site for this column"
          >
            <ChevronDown className={cn(compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5", "opacity-90")} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="max-w-[min(280px,calc(100vw-2rem))]">
          {sites.map((s, i) => (
            <DropdownMenuItem
              key={`${i}-${s.url}`}
              className="gap-2"
              onClick={() => onSelect(i)}
            >
              {s.isUser && (
                <span className="rounded bg-primary/15 px-1 py-0.5 text-[8px] font-bold uppercase text-primary">You</span>
              )}
              <span className="flex-1 truncate">{s.domain}</span>
              {i === valueIdx ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (!wideLayout && !heatmap && !aiTips && !zoom) return picker;

  return (
    <div className="flex w-full min-w-0 flex-wrap items-stretch justify-start gap-2">
      {/* Site + dropdown first; then tools — entire group stays left (no flex-1 stretch across the row). */}
      <div className="min-w-0 shrink">{picker}</div>
      <div className="flex shrink-0 items-stretch gap-1">
        {aiTips ? (
          <AiTipsColumnButton
            active={aiTips.active}
            onToggle={aiTips.onToggle}
            pushToolbarHelp={aiTips.pushToolbarHelp}
            compact={compact}
          />
        ) : null}
        {heatmap ? (
          <HeatmapColumnButton
            active={heatmap.active}
            onToggle={heatmap.onToggle}
            pushToolbarHelp={heatmap.pushToolbarHelp}
            compact={compact}
          />
        ) : null}
        {zoom ? (
          <ZoomColumnControls
            zoomIdx={zoom.zoomIdx}
            onZoomOut={zoom.onZoomOut}
            onZoomIn={zoom.onZoomIn}
            pushToolbarHelp={zoom.pushToolbarHelp}
            compact={compact}
          />
        ) : null}
        {wideLayout ? (
          <WideLayoutButton
            fullWidth={wideLayout.fullWidth}
            onToggle={wideLayout.onToggle}
            pushToolbarHelp={wideLayout.pushToolbarHelp}
            compact={compact}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

/** Back + history switcher at the start of the compare toolbar (e.g. full insights header). */
export interface CompareToolbarNavProps {
  currentDomain: string;
  /** Matches `HistoryEntry.id` for the open report when found in history (avoids disabling wrong row if domain repeats). */
  currentHistoryEntryId: string | null;
  historyEntries: HistoryEntry[];
  onBack: () => void;
  onSelectHistoryEntry: (entry: HistoryEntry) => void;
}

interface Props {
  result: AnalysisResult;
  url: string;
  /** When set with `onCompareSiteIdxChange`, selection is controlled (e.g. dashboard header tabs). */
  compareSiteIdx?: number;
  onCompareSiteIdxChange?: (idx: number) => void;
  /** When set, the VIEW + ANALYZE toolbar is portaled into this node (e.g. dashboard header). */
  compareToolbarSlot?: HTMLElement | null;
  compareToolbarNav?: CompareToolbarNavProps | null;
  /** Icon-only re-audit action shown near back/history controls in compare toolbar. */
  onReaudit?: () => void;
  /** Shown as icon-only control after the analysis history dropdown when `compareToolbarNav` is set. */
  onNewAnalysis?: () => void;
  /** Re-run full analysis (home → progress) with this competitor URL list; omit for read-only / shared views. */
  onRerunAnalysisWithCompetitors?: (competitorUrls: string[]) => void;
}

export function ScreenshotCompare({
  result,
  url,
  compareSiteIdx: controlledIdx,
  onCompareSiteIdxChange,
  compareToolbarSlot,
  compareToolbarNav,
  onReaudit,
  onNewAnalysis,
  onRerunAnalysisWithCompetitors,
}: Props) {
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
  const zoneLens: ZoneLens = "balanced";
  const [sectionDeepDive, setSectionDeepDive] = useState<SectionDeepDivePayload | null>(null);
  /** Section bands always on (Zones toggle removed). */
  const showZones = true;
  const [fullWidth, setFullWidth] = useState(false);
  /** Split / compare / slider: show only one column at a time (like Single); toggled per-site Wide control. Does not hide the analysis panel. */
  const [wideSoloSide, setWideSoloSide] = useState<"left" | "right" | null>(null);
  const [viewMode, setViewMode] = useState<ToolbarViewMode>("compare");
  const [splitLeftIdx, setSplitLeftIdx] = useState(0);
  const [splitRightIdx, setSplitRightIdx] = useState(1);
  /** Split/Compare: start with a 2-column grid of all competitors; pick one to open full screenshot on the right. */
  const [rightPaneMode, setRightPaneMode] = useState<"grid" | "detail">("grid");
  const splitIdxInitRef = useRef(false);
  /** Per-site screenshot zoom (keyed by URL so columns stay independent). */
  const [zoomIdxByUrl, setZoomIdxByUrl] = useState<Record<string, number>>({});
  /** Null = neutral (no analyze mode selected); layer behaves as baseline "compare" (no tint). */
  const [analyzeMode, setAnalyzeMode] = useState<ToolbarOverlayMode | null>(null);
  const effectiveOverlay: ToolbarOverlayMode = analyzeMode ?? "compare";
  /** Per-site: attention heatmap on that screenshot; when non-empty, analyze mode is attention (fetch + panel). */
  const [heatmapEnabledUrls, setHeatmapEnabledUrls] = useState<string[]>([]);

  const [planFocusTick, setPlanFocusTick] = useState(0);
  const [quickWinDismissed, setQuickWinDismissed] = useState(false);
  /** Stacked “what / problem / how” cards from toolbar clicks; newest first. */
  const [toolbarHelpCards, setToolbarHelpCards] = useState<Array<{ id: string } & ToolbarHintContent>>([]);
  const pushToolbarHelp = useCallback((id: string, hint: ToolbarHintContent) => {
    setToolbarHelpCards((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      return [{ id, ...hint }, ...rest].slice(0, 12);
    });
  }, []);
  const dismissToolbarHelp = useCallback((id: string) => {
    setToolbarHelpCards((prev) => prev.filter((c) => c.id !== id));
  }, []);
  const toggleHeatmapUrl = useCallback((siteUrl: string) => {
    setHeatmapEnabledUrls((prev) => (prev.includes(siteUrl) ? prev.filter((u) => u !== siteUrl) : [...prev, siteUrl]));
  }, []);

  const zoomIdxFor = (siteUrl: string) => zoomIdxByUrl[siteUrl] ?? 0;
  const zoomLevelFor = (siteUrl: string) => ZOOM_LEVELS[zoomIdxFor(siteUrl)] ?? 1;
  const bumpZoom = useCallback((siteUrl: string, delta: -1 | 1) => {
    setZoomIdxByUrl((m) => {
      const cur = m[siteUrl] ?? 0;
      const next = delta < 0 ? Math.max(0, cur - 1) : Math.min(ZOOM_LEVELS.length - 1, cur + 1);
      if (next === cur) return m;
      return { ...m, [siteUrl]: next };
    });
  }, []);

  const zoomColumnProps = (siteUrl: string) => ({
    zoomIdx: zoomIdxFor(siteUrl),
    onZoomOut: () => {
      pushToolbarHelp("ctrl-zoom-out", HINT_CONTROLS.zoomOut);
      bumpZoom(siteUrl, -1);
    },
    onZoomIn: () => {
      pushToolbarHelp("ctrl-zoom-in", HINT_CONTROLS.zoomIn);
      bumpZoom(siteUrl, 1);
    },
    pushToolbarHelp,
  });

  useEffect(() => {
    if (heatmapEnabledUrls.length > 0) setAnalyzeMode("attention");
    else setAnalyzeMode(null);
  }, [heatmapEnabledUrls]);

  useEffect(() => {
    if (viewMode === "single") setWideSoloSide(null);
  }, [viewMode]);

  const sites: SiteEntry[] = useMemo(() => {
    const list: SiteEntry[] = [];
    const ud = getDomain(url), ua = result.userAnalysis ?? {};
    const us = SECTION_KEYS.map((k) => sectionScoreForScreenshot(ua, k));
    const uavg = Math.round((us.reduce((a, b) => a + b, 0) / us.length) * 10) / 10;
    list.push({ url, domain: ud, isUser: true, screenshotUrl: result.targetScreenshotUrl ?? null, analysis: ua, annotations: buildAnnotations(ua), overallScore: result.synthesis?.overall_score ?? uavg });
    for (const comp of result.competitors ?? []) {
      const cd = getDomain(comp.url), ca = comp.analysis ?? {};
      const cs = SECTION_KEYS.map((k) => sectionScoreForScreenshot(ca, k));
      const cavg = Math.round((cs.reduce((a, b) => a + b, 0) / cs.length) * 10) / 10;
      list.push({ url: comp.url, domain: cd, isUser: false, screenshotUrl: comp.screenshotUrl ?? null, analysis: ca, annotations: buildAnnotations(ca), overallScore: cavg });
    }
    return list;
  }, [result, url]);

  const userSite = sites[0];
  const activeSite = sites[activeIdx] ?? sites[0];

  const captureUserSectionCrop = useCallback(
    async (sectionKey: SectionOrderKey) => {
      if (!userSite?.screenshotUrl) return null;
      const cta = userSite.annotations.find((a) => a.sectionKey === "CTA");
      return cropSectionToJpegBase64(
        userSite.screenshotUrl,
        sectionKey,
        cta ? { top: cta.top, height: cta.height } : null
      );
    },
    [userSite?.screenshotUrl, userSite?.annotations]
  );

  const {
    previewOpen,
    previewLoading,
    previewBtnLoading,
    previewData,
    cropDataUrl,
    previewTargetRow,
    runSectionPreviewForRow,
    closePreview,
  } = useSectionPreview({
    pageUrl: url,
    result,
    captureSectionCrop: captureUserSectionCrop,
  });

  const { safeLeft, safeRight } = useMemo(() => {
    const n = sites.length;
    if (n < 2) return { safeLeft: 0, safeRight: 0 };
    const L = Math.min(Math.max(0, splitLeftIdx), n - 1);
    const R = Math.min(Math.max(0, splitRightIdx), n - 1);
    return { safeLeft: L, safeRight: R };
  }, [sites.length, splitLeftIdx, splitRightIdx]);

  const splitLeftSite = sites[safeLeft];
  const splitRightSite = sites.length > 1 ? sites[safeRight] : null;

  const sectionPreviewPlacement = useMemo((): "inline-right" | "popup" | "modal" => {
    if (viewMode === "single") {
      return activeSite.isUser ? "popup" : "modal";
    }
    if (viewMode === "split" || viewMode === "compare") {
      if (!splitLeftSite || !splitRightSite) return "modal";
      if (wideSoloSide !== null) return "popup";
      if (splitRightSite.isUser) return "popup";
      if (splitLeftSite.isUser && !splitRightSite.isUser) return "inline-right";
    }
    return "modal";
  }, [viewMode, activeSite, splitLeftSite, splitRightSite, wideSoloSide]);

  const showInlineSectionPreview = useMemo(
    () =>
      previewOpen &&
      sectionPreviewPlacement === "inline-right" &&
      (viewMode === "split" || viewMode === "compare") &&
      wideSoloSide === null,
    [previewOpen, sectionPreviewPlacement, viewMode, wideSoloSide]
  );

  /** Competitor (or other column) for user-centric metrics when the right column is your site. */
  const vsSite = useMemo(() => {
    if (sites.length < 2) return null;
    if (splitRightSite && splitRightSite.url !== userSite.url) return splitRightSite;
    return sites.find((s) => !s.isUser) ?? null;
  }, [sites, splitRightSite, userSite]);

  const attentionCacheRef = useRef<Map<string, AttentionHeatmapResponse>>(new Map());
  const [attentionState, setAttentionState] = useState<{
    key: string | null;
    loading: boolean;
    error: boolean;
    data: AttentionHeatmapResponse | null;
  }>({ key: null, loading: false, error: false, data: null });
  const [attentionLayerVisible, setAttentionLayerVisible] = useState<Record<string, boolean>>({});
  const [attentionUpgradeDismissed, setAttentionUpgradeDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("ll_attention_upgrade_dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (analyzeMode !== "attention") return;
    const leftS = splitLeftSite;
    const rightS = splitRightSite;
    if (!leftS?.screenshotUrl || !rightS?.screenshotUrl) {
      setAttentionState({ key: null, loading: false, error: true, data: null });
      return;
    }
    const cacheKey = `${leftS.screenshotUrl}|${rightS.screenshotUrl}`;
    const cached = attentionCacheRef.current.get(cacheKey);
    if (cached) {
      setAttentionState({ key: cacheKey, loading: false, error: false, data: cached });
      return;
    }
    let cancelled = false;
    setAttentionState({ key: cacheKey, loading: true, error: false, data: null });
    (async () => {
      try {
        const [yEnc, cEnc] = await Promise.all([
          screenshotUrlToImageBase64(leftS.screenshotUrl),
          screenshotUrlToImageBase64(rightS.screenshotUrl),
        ]);
        if (cancelled) return;
        const raw = await fetchAttentionHeatmap({
          yourScreenshotBase64: yEnc.base64,
          competitorScreenshotBase64: cEnc.base64,
          yourMediaType: yEnc.mediaType,
          competitorMediaType: cEnc.mediaType,
          competitorName: rightS.domain,
        });
        if (cancelled) return;
        const data = normalizeAttentionResponse(raw);
        attentionCacheRef.current.set(cacheKey, data);
        setAttentionState({ key: cacheKey, loading: false, error: false, data });
      } catch {
        if (cancelled) return;
        setAttentionState({ key: cacheKey, loading: false, error: true, data: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analyzeMode, splitLeftSite?.screenshotUrl, splitRightSite?.screenshotUrl, splitRightSite?.domain]);

  /** When Attention is turned on, switch from Single → Original (split) so both heatmaps are visible side by side. */
  const attentionViewBootRef = useRef(false);
  useEffect(() => {
    if (analyzeMode !== "attention") {
      attentionViewBootRef.current = false;
      return;
    }
    if (sites.length < 2 || viewMode !== "single") return;
    if (!attentionViewBootRef.current) {
      attentionViewBootRef.current = true;
      setViewMode("split");
    }
  }, [analyzeMode, sites.length, viewMode]);

  const getAttentionOverlay = useCallback(
    (site: SiteEntry, splitColumn?: "left" | "right") => {
      if (effectiveOverlay !== "attention") return undefined;
      if (!heatmapEnabledUrls.includes(site.url)) return undefined;
      if (viewMode === "slider") return undefined;
      const data = attentionState.data;
      const loading = attentionState.loading;
      const err = attentionState.error;
      const isLeftColumn =
        splitColumn != null ? splitColumn === "left" : site.url === splitLeftSite?.url;
      const realZones = isLeftColumn ? data?.your?.zones ?? null : data?.competitor?.zones ?? null;
      const useDemo = loading || err || !realZones?.length;
      const zones: typeof ATTENTION_DEMO_ZONES = useDemo ? ATTENTION_DEMO_ZONES : (realZones ?? ATTENTION_DEMO_ZONES);
      const layerKey = splitColumn != null ? `att:${splitColumn}` : site.url;
      return {
        zones,
        layerVisible: attentionLayerVisible[layerKey] !== false,
        onLayerVisibleChange: (v: boolean) => setAttentionLayerVisible((prev) => ({ ...prev, [layerKey]: v })),
        loading,
        showPlaceholder: false,
      };
    },
    [effectiveOverlay, viewMode, attentionState, attentionLayerVisible, splitLeftSite?.url, heatmapEnabledUrls]
  );

  const attentionInsight = useMemo(() => {
    if (analyzeMode !== "attention") return null;
    if (!splitRightSite) {
      return {
        loading: false,
        error: true,
        comparison: null,
        your: null,
        competitor: null,
        competitorName: "Competitor",
        showUpgradePrompt: false,
        onDismissUpgrade: () => {},
      };
    }
    return {
      loading: attentionState.loading,
      error: attentionState.error,
      comparison: attentionState.data?.comparison ?? null,
      your: attentionState.data?.your ?? null,
      competitor: attentionState.data?.competitor ?? null,
      competitorName: splitRightSite.domain,
      showUpgradePrompt:
        !attentionUpgradeDismissed && !attentionState.loading && !attentionState.error && attentionState.data != null,
      onDismissUpgrade: () => {
        try {
          sessionStorage.setItem("ll_attention_upgrade_dismissed", "1");
        } catch {
          /* ignore */
        }
        setAttentionUpgradeDismissed(true);
      },
    };
  }, [analyzeMode, splitRightSite, attentionState, attentionUpgradeDismissed]);

  const toolbarContext: ToolbarContext = useMemo(
    () => ({
      viewMode,
      analyzeMode: analyzeMode as ToolbarContext["analyzeMode"],
      zoneLens,
    }),
    [viewMode, analyzeMode, zoneLens]
  );
  const toolbarContextKey = `${viewMode}|${analyzeMode ?? ""}|${zoneLens}`;

  const heatmapGapPairByKey = useMemo(() => {
    const o: Record<string, { user: number | null; comp: number | null }> = {};
    const isPair = viewMode === "split" || viewMode === "compare" || viewMode === "slider";
    const L = isPair ? splitLeftSite : userSite;
    const R = isPair ? splitRightSite : vsSite;
    if (!L || !R) return o;
    for (const key of SECTION_KEYS) {
      const u = L.annotations.find((a) => a.sectionKey === key)?.score ?? null;
      const c = R.annotations.find((a) => a.sectionKey === key)?.score ?? null;
      o[key] = { user: u, comp: c };
    }
    return o;
  }, [viewMode, splitLeftSite, splitRightSite, userSite, vsSite]);

  const hideCompetitorRefs = viewMode === "single" && activeSite.isUser;

  const sitesKey = useMemo(() => sites.map((s) => s.url).join("|"), [sites]);
  const defaultVsIdx = useMemo(() => defaultVsSiteIndex(sites), [sites]);

  useEffect(() => {
    splitIdxInitRef.current = false;
  }, [sitesKey]);

  useEffect(() => {
    setRightPaneMode("grid");
  }, [sitesKey]);

  useEffect(() => {
    if (!controlled) return;
    if (controlledIdx === 0) {
      setRightPaneMode("grid");
      return;
    }
    setRightPaneMode("detail");
    setSplitRightIdx(controlledIdx!);
  }, [controlled, controlledIdx]);

  useEffect(() => {
    if (rightPaneMode !== "grid") return;
    const leftUrl = splitLeftSite?.url;
    if (!leftUrl) return;
    setHeatmapEnabledUrls((prev) => prev.filter((u) => u === leftUrl));
  }, [rightPaneMode, splitLeftSite?.url]);

  useEffect(() => {
    if (sites.length < 2) return;
    if (!splitIdxInitRef.current) {
      setSplitLeftIdx(0);
      setSplitRightIdx(defaultVsIdx);
      splitIdxInitRef.current = true;
    }
  }, [sites.length, defaultVsIdx, sitesKey]);

  useEffect(() => {
    if (sites.length < 2) return;
    setSplitLeftIdx((i) => Math.min(i, sites.length - 1));
    setSplitRightIdx((i) => Math.min(i, sites.length - 1));
  }, [sites.length]);

  useEffect(() => { if (sites.length < 2 && viewMode !== "single") setViewMode("single"); }, [sites.length, viewMode]);
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

    const narrativeDomain =
      activeSite.isUser && sites.length > 1 ? sites[1]!.domain : activeSite.domain;

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
      winNarrative: buildCompetitorWinNarrative(result, narrativeDomain),
      stealThree: stealTopThree(result, narrativeDomain),
      abVariants: abVariantsFromResult(result),
      dataCoverage: dataCoveragePct(result.targetScreenshotUrl ?? null, heroText),
      gapConfidence: result.gaps?.[0]?.confidence,
    };
  }, [result, sites, userSite, activeSite.domain, activeSite.isUser]);

  const simulateItems = useMemo(
    () => fillMissingSectionSimulateItems(buildSimulateItems(result, decisionBundle.gapItems), result),
    [result, decisionBundle.gapItems]
  );
  const [simulateChecked, setSimulateChecked] = useState<Record<string, boolean>>({});
  const [aiTipsVisible, setAiTipsVisible] = useState(true);
  const competitorOverallScores = useMemo(
    () => sites.filter((s) => !s.isUser).map((s) => s.overallScore).filter((n): n is number => n != null),
    [sites]
  );
  const onSimulateToggle = useCallback((id: string, checked: boolean) => {
    setSimulateChecked((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const sectionPreviewPopupRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const sectionPreviewPopupWinRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!previewOpen || sectionPreviewPlacement !== "popup") {
      if (sectionPreviewPopupRootRef.current) {
        try {
          sectionPreviewPopupRootRef.current.unmount();
        } catch {
          /* ignore */
        }
        sectionPreviewPopupRootRef.current = null;
      }
      if (sectionPreviewPopupWinRef.current && !sectionPreviewPopupWinRef.current.closed) {
        sectionPreviewPopupWinRef.current.close();
      }
      sectionPreviewPopupWinRef.current = null;
      return;
    }
    const w = window.open("", "_blank", "width=960,height=800,scrollbars=yes");
    if (!w) {
      toast.error("Не вдалося відкрити вікно. Дозвольте спливаючі вікна для перегляду прев’ю.");
      closePreview();
      return;
    }
    sectionPreviewPopupWinRef.current = w;
    w.document.documentElement.innerHTML = "";
    const htmlEl = w.document.documentElement;
    htmlEl.setAttribute("lang", "en");
    const head = w.document.createElement("head");
    const meta = w.document.createElement("meta");
    meta.setAttribute("charset", "utf-8");
    head.appendChild(meta);
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
      head.appendChild(el.cloneNode(true));
    });
    w.document.documentElement.insertBefore(head, w.document.body);
    w.document.body.className = document.body.className;
    const root = createRoot(w.document.body);
    sectionPreviewPopupRootRef.current = root;
    return () => {
      try {
        root.unmount();
      } catch {
        /* ignore */
      }
      if (!w.closed) w.close();
      sectionPreviewPopupRootRef.current = null;
      sectionPreviewPopupWinRef.current = null;
    };
  }, [previewOpen, sectionPreviewPlacement, closePreview]);

  useEffect(() => {
    if (!previewOpen || sectionPreviewPlacement !== "popup" || !sectionPreviewPopupRootRef.current) return;
    sectionPreviewPopupRootRef.current.render(
      <SectionAiPreviewModal
        embedded
        open
        onClose={() => {
          closePreview();
          if (sectionPreviewPopupWinRef.current && !sectionPreviewPopupWinRef.current.closed) {
            sectionPreviewPopupWinRef.current.close();
          }
        }}
        sectionTitle={previewTargetRow?.sectionLabel ?? "Section"}
        estFallback={previewTargetRow?.estAfter ?? 0}
        cropDataUrl={cropDataUrl}
        preview={previewData}
        loading={previewLoading}
        onAddToPlan={() => {
          if (previewTargetRow) {
            onSimulateToggle(previewTargetRow.id, true);
            toast(`Added to plan · ${previewTargetRow.sectionLabel}`, { duration: 2500, position: "bottom-center" });
          }
        }}
      />
    );
  }, [
    previewOpen,
    sectionPreviewPlacement,
    previewData,
    previewLoading,
    cropDataUrl,
    previewTargetRow,
    closePreview,
    onSimulateToggle,
  ]);

  const simulateAiLabelRows = useMemo(
    () =>
      buildSimulateAiLabelRows(result, simulateItems, {
        scoresBySection: Object.fromEntries(userSite.annotations.map((a) => [a.sectionKey, a.score])) as Record<
          string,
          number | null
        >,
        summariesBySection: Object.fromEntries(userSite.annotations.map((a) => [a.sectionKey, a.summary])),
        vsDomain: vsSite?.domain ?? null,
        ctaAnnotation: (() => {
          const c = userSite.annotations.find((a) => a.sectionKey === "CTA");
          return c ? { top: c.top, height: c.height } : null;
        })(),
      }),
    [result, simulateItems, userSite.annotations, vsSite?.domain]
  );

  const simulateOverlayRows = useMemo(() => {
    const rows = simulateItems.filter((i) => simulateChecked[i.id]);
    const byKey = new Map<string, { sectionKey: string; pillText: string }>();
    for (const r of rows) {
      const short = r.oneLineFix.length > 72 ? `${r.oneLineFix.slice(0, 69)}…` : r.oneLineFix;
      const pill = `Add: ${short}`;
      const prev = byKey.get(r.sectionKey);
      if (!prev) byKey.set(r.sectionKey, { sectionKey: r.sectionKey, pillText: pill });
      else byKey.set(r.sectionKey, { sectionKey: r.sectionKey, pillText: `${prev.pillText} · ${pill}` });
    }
    return [...byKey.values()];
  }, [simulateItems, simulateChecked]);

  const competitorAhead =
    !activeSite.isUser &&
    userSite.overallScore != null &&
    activeSite.overallScore != null &&
    activeSite.overallScore > userSite.overallScore;

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

  /** User vs selected peer (for chips, plan, quick win). */
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

  const unifiedOverlayMode: CompareOverlayLayerMode =
    effectiveOverlay === "mobile" ? "compare" : (effectiveOverlay as CompareOverlayLayerMode);

  /** Attention API: left screenshot → your zones, right → competitor zones. */
  const attentionZonesForSite = useCallback(
    (site: SiteEntry) => {
      if (effectiveOverlay !== "attention") return null;
      const data = attentionState.data;
      if (!data || !splitLeftSite || !splitRightSite) return null;
      if (site.url === splitLeftSite.url) return data.your?.zones ?? null;
      if (site.url === splitRightSite.url) return data.competitor?.zones ?? null;
      return null;
    },
    [effectiveOverlay, attentionState.data, splitLeftSite, splitRightSite]
  );

  /** Per-section user − site scores (positive ⇒ user leads); used to filter competitor AI tips in heatmap mode. */
  const sectionDeltaUserMinusSite = useCallback(
    (site: SiteEntry) => {
      const o: Record<string, number | null> = {};
      for (const k of SECTION_KEYS) {
        const u = userSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
        const t = site.annotations.find((a) => a.sectionKey === k)?.score ?? null;
        o[k] = u != null && t != null ? Math.round((u - t) * 10) / 10 : null;
      }
      return o;
    },
    [userSite.annotations]
  );

  /** Unified dot → pill → card for every Analyze overlay mode. */
  const aiLabelsModeActive = aiTipsVisible && (viewMode === "split" || viewMode === "compare");

  const buildRowsAndItemsForSite = useCallback(
    (site: SiteEntry): { rows: SimulateAiLabelRow[]; items: SimulateImprovementItem[] } => {
      if (site.isUser) {
        return { rows: simulateAiLabelRows, items: simulateItems };
      }
      const compResult: AnalysisResult = {
        ...result,
        userAnalysis: site.analysis,
        gaps: undefined,
        uxHints: undefined,
        copySuggestions: undefined,
        competitors: [],
      };
      const rawItems = fillMissingSectionSimulateItems(buildSimulateItems(compResult, []), compResult);
      const items = rawItems.map((it) => ({ ...it, id: `c:${encodeURIComponent(site.url)}:${it.id}` }));
      const rows = buildSimulateAiLabelRows(compResult, items, {
        scoresBySection: Object.fromEntries(site.annotations.map((a) => [a.sectionKey, a.score])) as Record<
          string,
          number | null
        >,
        summariesBySection: Object.fromEntries(site.annotations.map((a) => [a.sectionKey, a.summary])),
        vsDomain: userSite.domain,
        ctaAnnotation: (() => {
          const c = site.annotations.find((a) => a.sectionKey === "CTA");
          return c ? { top: c.top, height: c.height } : null;
        })(),
      });
      return { rows, items };
    },
    [result, simulateAiLabelRows, simulateItems, userSite.domain]
  );

  const aiLabelsSlotForSite = useCallback(
    (site: SiteEntry) => {
      if (!aiLabelsModeActive) return null;
      const { rows: baseRows, items: siteItems } = buildRowsAndItemsForSite(site);
      const deltaForUnified = site.isUser ? sectionDeltaVsCompetitor : sectionDeltaUserMinusSite(site);
      const unifiedRows = buildUnifiedAiLabelRowsForMode(baseRows, unifiedOverlayMode, {
        sectionDeltaVsCompetitor: deltaForUnified,
        attentionZones: attentionZonesForSite(site),
        annotations: site.annotations.map((a) => ({
          sectionKey: a.sectionKey,
          top: a.top,
          height: a.height,
          score: a.score,
        })),
        competitorPerspective: !site.isUser,
      });
      if (unifiedRows.length === 0) return null;
      return (
        <AiLabelMarkers
          rows={unifiedRows}
          simulateChecked={simulateChecked}
          onSimulateToggle={onSimulateToggle}
          userOverall={site.isUser ? decisionBundle.overall : site.overallScore ?? null}
          simulateItems={siteItems}
          competitorOverallScores={competitorOverallScores}
          previewEnabled={site.isUser}
          onPreviewImproved={runSectionPreviewForRow}
          previewBtnLoading={previewBtnLoading}
        />
      );
    },
    [
      aiLabelsModeActive,
      buildRowsAndItemsForSite,
      sectionDeltaVsCompetitor,
      sectionDeltaUserMinusSite,
      attentionZonesForSite,
      unifiedOverlayMode,
      simulateChecked,
      onSimulateToggle,
      decisionBundle.overall,
      competitorOverallScores,
      runSectionPreviewForRow,
      previewBtnLoading,
    ]
  );

  /** Right column minus left (split/compare overlays). */
  const sectionDeltaLR = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!splitLeftSite || !splitRightSite) return out;
    for (const k of SECTION_KEYS) {
      const L = splitLeftSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
      const R = splitRightSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
      out[k] = L != null && R != null ? Math.round((R - L) * 10) / 10 : null;
    }
    return out;
  }, [splitLeftSite, splitRightSite]);

  const showProblemIndicators =
    ((viewMode === "split" || viewMode === "compare") &&
      (effectiveOverlay === "compare" || effectiveOverlay === "mobile")) ||
    (viewMode === "single" && effectiveOverlay === "compare");

  const eyeOrderByKey = useMemo(() => {
    const pairView = viewMode === "split" || viewMode === "compare";
    const left = pairView ? splitLeftSite : userSite;
    const right = pairView ? splitRightSite : vsSite;
    if (!left) return {};
    if (!right) {
      const sorted = [...left.annotations].sort((a, b) => a.top - b.top);
      const m: Record<string, number> = {};
      sorted.forEach((a, i) => {
        m[a.sectionKey] = i + 1;
      });
      return m;
    }
    const scored: { key: string; absGap: number }[] = [];
    for (const a of left.annotations) {
      const u = a.score;
      const c = right.annotations.find((x) => x.sectionKey === a.sectionKey)?.score ?? null;
      if (u == null || c == null) continue;
      const gap = c - u;
      scored.push({ key: a.sectionKey, absGap: Math.abs(gap) });
    }
    scored.sort((a, b) => b.absGap - a.absGap);
    const m: Record<string, number> = {};
    scored.slice(0, 3).forEach((s, i) => {
      m[s.key] = i + 1;
    });
    return m;
  }, [viewMode, userSite, vsSite, splitLeftSite, splitRightSite]);

  const competitorScoresForUser = useMemo(() => {
    if (!vsSite) return undefined;
    const m: Record<string, number | null> = {};
    for (const k of SECTION_KEYS) {
      m[k] = vsSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
    }
    return m;
  }, [vsSite]);

  const competitorScoresForSplitLeft = useMemo(() => {
    if (!splitRightSite) return undefined;
    const m: Record<string, number | null> = {};
    for (const k of SECTION_KEYS) {
      m[k] = splitRightSite.annotations.find((a) => a.sectionKey === k)?.score ?? null;
    }
    return m;
  }, [splitRightSite]);

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

  const toolbarFilteredSectionCount = useMemo(() => {
    let n = 0;
    for (const key of SECTION_KEYS) {
      const u = userSite.annotations.find((a) => a.sectionKey === key)?.score ?? null;
      const c = vsSite?.annotations.find((a) => a.sectionKey === key)?.score ?? null;
      if (sectionPassesToolbarFilters(toolbarContext, key, u, c)) n++;
    }
    return n;
  }, [toolbarContext, userSite, vsSite]);

  const openSectionMore = useCallback((ann: Annotation) => {
    setSectionDeepDive({
      sectionKey: ann.sectionKey,
      label: ann.label,
      score: ann.score,
      fullText: ann.fullText,
      watchPoints: annotationBulletPoints(ann.fullText, 5),
    });
  }, []);

  const selectSplitLeft = useCallback((i: number) => {
    if (sites.length < 2) return;
    setSplitLeftIdx(i);
  }, [sites.length]);

  const selectSplitRight = useCallback((i: number) => {
    if (sites.length < 2) return;
    setSplitRightIdx(i);
    setRightPaneMode("detail");
  }, [sites.length]);

  const competitorSiteEntries = useMemo(
    () =>
      sites
        .map((site, siteIndex) => ({ site, siteIndex }))
        .filter((x) => !x.site.isUser),
    [sites]
  );

  const showCompetitorPickGrid =
    (viewMode === "split" || viewMode === "compare") &&
    wideSoloSide === null &&
    rightPaneMode === "grid" &&
    competitorSiteEntries.length > 0;

  const pickCompetitorFromGrid = useCallback(
    (siteIndex: number) => {
      setSplitRightIdx(siteIndex);
      setRightPaneMode("detail");
      setExpandedPin(null);
      setActiveIdx(siteIndex);
    },
    [setActiveIdx]
  );

  const existingCompetitorUrls = useMemo(
    () =>
      result.competitors
        .map((c) => c.url)
        .filter((u): u is string => typeof u === "string" && Boolean(u.trim())),
    [result.competitors]
  );

  const canAddCompetitor =
    Boolean(onRerunAnalysisWithCompetitors) && existingCompetitorUrls.length < MAX_COMPETITORS;

  const [addCompetitorOpen, setAddCompetitorOpen] = useState(false);
  const [addCompetitorInput, setAddCompetitorInput] = useState("");

  const submitAddCompetitor = useCallback(() => {
    if (!onRerunAnalysisWithCompetitors) return;
    const normalized = normalizeCompetitorUrlInput(addCompetitorInput);
    if (!normalized) {
      toast.error("Enter a competitor URL or domain.");
      return;
    }
    const newDomain = getDomain(normalized);
    if (getDomain(url) === newDomain) {
      toast.error("That's your own site — pick a competitor.");
      return;
    }
    if (existingCompetitorUrls.some((u) => getDomain(u) === newDomain)) {
      toast.error("That competitor is already in this report.");
      return;
    }
    const next = [...existingCompetitorUrls, normalized].slice(0, MAX_COMPETITORS);
    toast.success("Starting full comparison with the new competitor…");
    onRerunAnalysisWithCompetitors(next);
    setAddCompetitorOpen(false);
    setAddCompetitorInput("");
  }, [addCompetitorInput, existingCompetitorUrls, onRerunAnalysisWithCompetitors, url]);

  const backToCompetitorGrid = useCallback(() => {
    setRightPaneMode("grid");
    setActiveIdx(0);
    setExpandedPin(null);
  }, [setActiveIdx]);

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
      winNarrative={decisionBundle.winNarrative}
      stealThree={decisionBundle.stealThree}
      abVariants={decisionBundle.abVariants}
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
          : {
              userScore: userSite.overallScore,
              rank: decisionBundle.rank?.rank ?? null,
              totalRanked: decisionBundle.rank?.total ?? 0,
              losing: decisionBundle.losing,
              conversion: decisionBundle.conversion,
              mainIssue: decisionBundle.conversion.mainIssue,
            }
      }
      quickWin={quickWin}
      onQuickWinDismiss={() => setQuickWinDismissed(true)}
      onQuickWinPlan={() => setPlanFocusTick((n) => n + 1)}
      threeSecondInsight={centerInsight}
      sectionDeepDive={sectionDeepDive}
      onCloseSectionDeepDive={() => setSectionDeepDive(null)}
      focusPlanTick={planFocusTick}
      toolbarContext={toolbarContext}
      toolbarContextKey={toolbarContextKey}
      hideCompetitorRefs={hideCompetitorRefs}
      toolbarFilteredSectionCount={toolbarFilteredSectionCount}
      sectionDeltaVsCompetitor={sectionDeltaVsCompetitor}
      vsDomain={vsSite?.domain ?? null}
      lensAnnotations={userSite.annotations}
      lensVs={
        vsSite
          ? {
              domain: vsSite.domain,
              bySection: Object.fromEntries(
                SECTION_KEYS.map((k) => [k, vsSite.annotations.find((a) => a.sectionKey === k)?.score ?? null])
              ),
            }
          : null
      }
      attentionInsight={attentionInsight}
      toolbarHelpCards={toolbarHelpCards}
      onDismissToolbarHelp={dismissToolbarHelp}
      simulateItems={simulateItems}
      simulateChecked={simulateChecked}
      onSimulateToggle={onSimulateToggle}
      competitorOverallScores={competitorOverallScores}
      onCollapseRightPanel={() => {
        pushToolbarHelp("right-panel-close", HINT_CONTROLS.rightPanelToggle);
        setFullWidth(true);
      }}
    />
  );

  const compareToolbarEl = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          {/* ANALYZE — Back + History */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {compareToolbarNav ? (
              <div className="mr-1 flex shrink-0 items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={compareToolbarNav.onBack}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-7 max-w-[min(11rem,36vw)] items-center gap-1 rounded-lg border border-border px-2 py-0 text-left text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Analysis history"
                    >
                      <span className="min-w-0 truncate">{compareToolbarNav.currentDomain}</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-[min(320px,60vh)] w-[min(280px,calc(100vw-2rem))] overflow-y-auto">
                    {compareToolbarNav.historyEntries.length === 0 ? (
                      <div className="px-2 py-2 text-xs leading-snug text-muted-foreground">
                        No saved analyses yet. Run a check from the home page.
                      </div>
                    ) : (
                      compareToolbarNav.historyEntries.map((e) => {
                        const isCurrent =
                          compareToolbarNav.currentHistoryEntryId != null &&
                          e.id === compareToolbarNav.currentHistoryEntryId;
                        return (
                          <DropdownMenuItem
                            key={e.id}
                            disabled={isCurrent}
                            onClick={() => compareToolbarNav.onSelectHistoryEntry(e)}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate font-medium",
                                isCurrent && "text-primary"
                              )}
                            >
                              {e.domain}
                            </span>
                            {e.score != null && (
                              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                                {e.score.toFixed(1)}
                              </span>
                            )}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {onReaudit ? (
                  <button
                    type="button"
                    onClick={onReaudit}
                    aria-label="Re-audit from scratch"
                    title="Re-audit from scratch"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
                {onNewAnalysis ? (
                  <button
                    type="button"
                    onClick={onNewAnalysis}
                    aria-label="New Analysis"
                    title="New Analysis"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {!controlled && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <HintTooltip side="bottom" title={HINT_CONTROLS.prevSite.title} description={HINT_CONTROLS.prevSite.description}>
            <button
              type="button"
              onClick={() => {
                pushToolbarHelp("nav-prev", HINT_CONTROLS.prevSite);
                handlePrev();
              }}
              className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </HintTooltip>
          {sites.map((s, i) => (
            <SiteTab
              key={s.url}
              site={s}
              active={i === activeIdx}
              onClick={() => {
                pushToolbarHelp(`site-tab-${s.domain}`, hintSiteTab(s.isUser, s.domain, deltaVsYou(s)));
                setActiveIdx(i);
                setExpandedPin(null);
              }}
              delta={deltaVsYou(s)}
            />
          ))}
          <HintTooltip side="bottom" title={HINT_CONTROLS.nextSite.title} description={HINT_CONTROLS.nextSite.description}>
            <button
              type="button"
              onClick={() => {
                pushToolbarHelp("nav-next", HINT_CONTROLS.nextSite);
                handleNext();
              }}
              className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </HintTooltip>
        </div>
      )}

      {compareToolbarNav
        ? compareToolbarSlot === undefined
          ? compareToolbarEl
          : compareToolbarSlot
            ? createPortal(compareToolbarEl, compareToolbarSlot)
            : null
        : null}

      {/* Center (scrollable) | Right panel — left column fit-content height; right fills viewport band */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden min-w-0",
          "lg:flex-row lg:items-stretch",
          fullWidth ? "lg:gap-0" : "lg:gap-4"
        )}
      >
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:min-w-0 lg:max-h-full lg:self-stretch">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {viewMode === "single" &&
                (activeSite.screenshotUrl ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="flex min-w-0 shrink-0 items-stretch gap-1.5">
                      <div className="min-w-0 flex-1">
                        <SplitSiteColumnPicker
                          compact
                          sites={sites}
                          valueIdx={activeIdx}
                          onSelect={(idx) => {
                            if (controlled) pushToolbarHelp("vs-column-single", HINT_CONTROLS.vsSelect);
                            setActiveIdx(idx);
                            setExpandedPin(null);
                          }}
                          aiTips={{
                            active: aiTipsVisible,
                            onToggle: () => setAiTipsVisible((v) => !v),
                            pushToolbarHelp,
                          }}
                          zoom={zoomColumnProps(activeSite.url)}
                          heatmap={{
                            active: heatmapEnabledUrls.includes(activeSite.url),
                            onToggle: () => toggleHeatmapUrl(activeSite.url),
                            pushToolbarHelp,
                          }}
                          wideLayout={{
                            fullWidth,
                            onToggle: () => setFullWidth((v) => !v),
                            pushToolbarHelp,
                          }}
                        />
                      </div>
                      {fullWidth ? (
                        <ScreenshotWideExitButton
                          aria-label="Restore analysis panel"
                          title="Exit full width"
                          onClose={() => setFullWidth(false)}
                        />
                      ) : null}
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <ScreenshotFrame
                        site={activeSite}
                        showZones={showZones}
                        expandedPin={expandedPin}
                        zoom={zoomLevelFor(activeSite.url)}
                        overlayMode={effectiveOverlay}
                        sectionNavTick={sectionNavTick}
                        zoneLens={zoneLens}
                        deltaByKey={activeSite.isUser ? undefined : sectionDeltaByKey}
                        problemIndicators={showProblemIndicators}
                        eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                        competitorScores={
                          showProblemIndicators && activeSite.isUser && vsSite ? competitorScoresForUser : undefined
                        }
                        heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                        heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                        attentionOverlay={getAttentionOverlay(activeSite)}
                        simulateOverlayRows={activeSite.isUser ? simulateOverlayRows : null}
                        simulateAiLabelsSlot={aiLabelsSlotForSite(activeSite)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No screenshot.
                  </div>
                ))}

              {(viewMode === "split" || viewMode === "compare") && splitLeftSite && splitRightSite && (
                <>
                  {wideSoloSide === null ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:flex-row md:items-stretch md:gap-3">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div className="min-w-0 shrink-0">
                          <SplitSiteColumnPicker
                            compact
                            sites={sites}
                            valueIdx={safeLeft}
                            onSelect={(idx) => {
                              pushToolbarHelp("vs-column-left", HINT_CONTROLS.vsSelect);
                              selectSplitLeft(idx);
                            }}
                            aiTips={{
                              active: aiTipsVisible,
                              onToggle: () => setAiTipsVisible((v) => !v),
                              pushToolbarHelp,
                            }}
                            zoom={zoomColumnProps(splitLeftSite.url)}
                            heatmap={{
                              active: heatmapEnabledUrls.includes(splitLeftSite.url),
                              onToggle: () => toggleHeatmapUrl(splitLeftSite.url),
                              pushToolbarHelp,
                            }}
                            wideLayout={{
                              fullWidth: false,
                              onToggle: () => setWideSoloSide((s) => (s === "left" ? null : "left")),
                              pushToolbarHelp,
                            }}
                          />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                          <ScreenshotFrame
                            site={splitLeftSite}
                            showZones={showZones}
                            expandedPin={expandedPin}
                            zoom={zoomLevelFor(splitLeftSite.url)}
                            overlayMode={effectiveOverlay}
                            sectionNavTick={sectionNavTick}
                            zoneLens={zoneLens}
                            deltaByKey={viewMode === "compare" ? sectionDeltaLR : undefined}
                            problemIndicators={showProblemIndicators}
                            eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                            competitorScores={
                              showProblemIndicators && splitLeftSite.isUser ? competitorScoresForSplitLeft : undefined
                            }
                            compareDiffMode={viewMode === "compare"}
                            heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                            heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                            attentionOverlay={getAttentionOverlay(splitLeftSite, "left")}
                            simulateOverlayRows={splitLeftSite.isUser ? simulateOverlayRows : null}
                            simulateAiLabelsSlot={aiLabelsSlotForSite(splitLeftSite)}
                          />
                        </div>
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                        {showInlineSectionPreview ? (
                          <>
                            <div className="flex min-w-0 max-w-full shrink-0 items-stretch justify-start gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  pushToolbarHelp("ai-preview-close", HINT_CONTROLS.vsSelect);
                                  closePreview();
                                }}
                                aria-label="Close AI preview"
                                className={cn(
                                  "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
                                  COMPACT_TOOLBAR_ROW,
                                  "w-7 px-0"
                                )}
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                              </button>
                              <div className="flex min-h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/15 px-2.5 py-1">
                                <span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                  AI preview
                                </span>
                                {previewTargetRow ? (
                                  <span className="truncate text-[10px] font-semibold text-foreground" title={previewTargetRow.sectionLabel}>
                                    {previewTargetRow.sectionLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                              <SectionAiPreviewModal
                                variant="compareColumn"
                                open
                                onClose={closePreview}
                                sectionTitle={previewTargetRow?.sectionLabel ?? "Section"}
                                estFallback={previewTargetRow?.estAfter ?? 0}
                                cropDataUrl={cropDataUrl}
                                preview={previewData}
                                loading={previewLoading}
                                onAddToPlan={() => {
                                  if (previewTargetRow) {
                                    onSimulateToggle(previewTargetRow.id, true);
                                    toast(`Added to plan · ${previewTargetRow.sectionLabel}`, {
                                      duration: 2500,
                                      position: "bottom-center",
                                    });
                                  }
                                }}
                              />
                            </div>
                          </>
                        ) : showCompetitorPickGrid ? (
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                            {/* Spacer: same height as left toolbar row so card grid aligns with screenshot */}
                            <div className={cn("min-w-0 shrink-0", COMPACT_TOOLBAR_ROW)} aria-hidden />
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl bg-muted/15 px-2 pb-2 pt-0 scrollbar-hide">
                              <div className="grid grid-cols-2 gap-2">
                                {competitorSiteEntries.map(({ site, siteIndex }) => (
                                  <button
                                    key={site.url}
                                    type="button"
                                    onClick={() => {
                                      pushToolbarHelp(`competitor-grid-${site.domain}`, HINT_CONTROLS.vsSelect);
                                      pickCompetitorFromGrid(siteIndex);
                                    }}
                                    className={cn(
                                      "flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 text-left text-card-foreground shadow-sm transition-colors",
                                      "hover:border-primary/45 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                      "dark:border-zinc-600/70 dark:bg-[#0a0a0a] dark:shadow-none dark:hover:border-primary/50 dark:hover:bg-zinc-950"
                                    )}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <img
                                        src={competitorGridFaviconUrl(site.domain)}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="h-6 w-6 shrink-0 rounded-md bg-muted ring-1 ring-border dark:bg-zinc-900 dark:ring-zinc-700/80"
                                      />
                                      <span className="min-w-0 truncate font-mono text-[11px] font-medium tracking-tight text-foreground">
                                        {site.domain}
                                      </span>
                                    </div>
                                    <div className="overflow-hidden rounded-lg bg-muted ring-1 ring-border dark:bg-zinc-950 dark:ring-zinc-800/90">
                                      {site.screenshotUrl ? (
                                        <img
                                          src={site.screenshotUrl}
                                          alt=""
                                          className="aspect-[16/10] max-h-[min(160px,28vh)] w-full object-cover object-top"
                                          loading="lazy"
                                          draggable={false}
                                        />
                                      ) : (
                                        <div className="flex aspect-[16/10] max-h-[min(160px,28vh)] w-full items-center justify-center px-2 text-center font-mono text-[10px] text-muted-foreground">
                                          No screenshot
                                        </div>
                                      )}
                                    </div>
                                    <div className="h-px w-full shrink-0 bg-border dark:bg-zinc-800" aria-hidden />
                                    <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                      Section scores
                                    </p>
                                    <ul className="flex flex-col gap-1 font-mono text-[10px]">
                                      {SECTION_KEYS.map((key) => {
                                        const sc = sectionScoreForScreenshot(site.analysis, key);
                                        return (
                                          <li
                                            key={key}
                                            className="flex items-baseline justify-between gap-2 leading-tight"
                                          >
                                            <span className="min-w-0 truncate text-muted-foreground">
                                              {SECTION_ZONES[key].label}
                                            </span>
                                            <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                                              {sc.toFixed(1)}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </button>
                                ))}
                                {canAddCompetitor ? (
                                  <button
                                    type="button"
                                    onClick={() => setAddCompetitorOpen(true)}
                                    className={cn(
                                      "flex min-h-[min(280px,40vh)] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/40 p-4 text-center shadow-none transition-colors",
                                      "hover:border-primary/50 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                      "dark:border-zinc-600/80 dark:bg-[#0a0a0a]/80 dark:hover:border-primary/45 dark:hover:bg-zinc-950/80"
                                    )}
                                    aria-label="Add competitor"
                                  >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground dark:border-zinc-600 dark:bg-zinc-900">
                                      <Plus className="h-6 w-6" strokeWidth={2} aria-hidden />
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-foreground">Add competitor</span>
                                    <span className="max-w-[11rem] font-mono text-[9px] leading-snug text-muted-foreground">
                                      Full re-analysis with your site + current competitors + this URL
                                    </span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex min-w-0 max-w-full shrink-0 items-stretch justify-start gap-1.5">
                              {competitorSiteEntries.length > 0 ? (
                                <HintTooltip
                                  side="bottom"
                                  title="All competitors"
                                  description="Return to the grid to pick another competitor site."
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      pushToolbarHelp("competitor-grid-back", HINT_CONTROLS.vsSelect);
                                      backToCompetitorGrid();
                                    }}
                                    aria-label="All competitors"
                                    className={cn(
                                      "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
                                      COMPACT_TOOLBAR_ROW,
                                      "w-7 px-0"
                                    )}
                                  >
                                    <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                  </button>
                                </HintTooltip>
                              ) : null}
                              <div className="min-w-0 max-w-full shrink">
                                <SplitSiteColumnPicker
                                  compact
                                  sites={sites}
                                  valueIdx={safeRight}
                                  onSelect={(idx) => {
                                    pushToolbarHelp("vs-column-right", HINT_CONTROLS.vsSelect);
                                    selectSplitRight(idx);
                                  }}
                                  aiTips={{
                                    active: aiTipsVisible,
                                    onToggle: () => setAiTipsVisible((v) => !v),
                                    pushToolbarHelp,
                                  }}
                                  zoom={zoomColumnProps(splitRightSite.url)}
                                  heatmap={{
                                    active: heatmapEnabledUrls.includes(splitRightSite.url),
                                    onToggle: () => toggleHeatmapUrl(splitRightSite.url),
                                    pushToolbarHelp,
                                  }}
                                  wideLayout={{
                                    fullWidth: false,
                                    onToggle: () => setWideSoloSide((s) => (s === "right" ? null : "right")),
                                    pushToolbarHelp,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                              <ScreenshotFrame
                                site={splitRightSite}
                                showZones={showZones}
                                expandedPin={expandedPin}
                                zoom={zoomLevelFor(splitRightSite.url)}
                                overlayMode={effectiveOverlay}
                                sectionNavTick={sectionNavTick}
                                zoneLens={zoneLens}
                                deltaByKey={sectionDeltaLR}
                                problemIndicators={showProblemIndicators}
                                eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                                competitorScores={undefined}
                                compareDiffMode={viewMode === "compare"}
                                heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                                heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                                attentionOverlay={getAttentionOverlay(splitRightSite, "right")}
                                simulateOverlayRows={splitRightSite.isUser ? simulateOverlayRows : null}
                                simulateAiLabelsSlot={aiLabelsSlotForSite(splitRightSite)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : wideSoloSide === "left" ? (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                      <div className="flex min-w-0 shrink-0 items-stretch gap-1.5">
                        <div className="min-w-0 flex-1">
                          <SplitSiteColumnPicker
                            compact
                            sites={sites}
                            valueIdx={safeLeft}
                            onSelect={(idx) => {
                              pushToolbarHelp("vs-column-left", HINT_CONTROLS.vsSelect);
                              selectSplitLeft(idx);
                            }}
                            aiTips={{
                              active: aiTipsVisible,
                              onToggle: () => setAiTipsVisible((v) => !v),
                              pushToolbarHelp,
                            }}
                            zoom={zoomColumnProps(splitLeftSite.url)}
                            heatmap={{
                              active: heatmapEnabledUrls.includes(splitLeftSite.url),
                              onToggle: () => toggleHeatmapUrl(splitLeftSite.url),
                              pushToolbarHelp,
                            }}
                            wideLayout={{
                              fullWidth: true,
                              onToggle: () => setWideSoloSide((s) => (s === "left" ? null : "left")),
                              pushToolbarHelp,
                            }}
                          />
                        </div>
                        <ScreenshotWideExitButton
                          aria-label="Exit full-width column"
                          title="Exit full width"
                          onClose={() => setWideSoloSide(null)}
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <ScreenshotFrame
                          site={splitLeftSite}
                          showZones={showZones}
                          expandedPin={expandedPin}
                          zoom={zoomLevelFor(splitLeftSite.url)}
                          overlayMode={effectiveOverlay}
                          sectionNavTick={sectionNavTick}
                          zoneLens={zoneLens}
                          deltaByKey={viewMode === "compare" ? sectionDeltaLR : undefined}
                          problemIndicators={showProblemIndicators}
                          eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                          competitorScores={
                            showProblemIndicators && splitLeftSite.isUser ? competitorScoresForSplitLeft : undefined
                          }
                          compareDiffMode={viewMode === "compare"}
                          heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                          heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                          attentionOverlay={getAttentionOverlay(splitLeftSite, "left")}
                          simulateOverlayRows={splitLeftSite.isUser ? simulateOverlayRows : null}
                          simulateAiLabelsSlot={aiLabelsSlotForSite(splitLeftSite)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                      <div className="flex min-w-0 shrink-0 items-stretch gap-1.5">
                        <div className="min-w-0 flex-1">
                          <SplitSiteColumnPicker
                            compact
                            sites={sites}
                            valueIdx={safeRight}
                            onSelect={(idx) => {
                              pushToolbarHelp("vs-column-right", HINT_CONTROLS.vsSelect);
                              selectSplitRight(idx);
                            }}
                            aiTips={{
                              active: aiTipsVisible,
                              onToggle: () => setAiTipsVisible((v) => !v),
                              pushToolbarHelp,
                            }}
                            zoom={zoomColumnProps(splitRightSite.url)}
                            heatmap={{
                              active: heatmapEnabledUrls.includes(splitRightSite.url),
                              onToggle: () => toggleHeatmapUrl(splitRightSite.url),
                              pushToolbarHelp,
                            }}
                            wideLayout={{
                              fullWidth: true,
                              onToggle: () => setWideSoloSide((s) => (s === "right" ? null : "right")),
                              pushToolbarHelp,
                            }}
                          />
                        </div>
                        <ScreenshotWideExitButton
                          aria-label="Exit full-width column"
                          title="Exit full width"
                          onClose={() => setWideSoloSide(null)}
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <ScreenshotFrame
                          site={splitRightSite}
                          showZones={showZones}
                          expandedPin={expandedPin}
                          zoom={zoomLevelFor(splitRightSite.url)}
                          overlayMode={effectiveOverlay}
                          sectionNavTick={sectionNavTick}
                          zoneLens={zoneLens}
                          deltaByKey={sectionDeltaLR}
                          problemIndicators={showProblemIndicators}
                          eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                          competitorScores={undefined}
                          compareDiffMode={viewMode === "compare"}
                          heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                          heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                          attentionOverlay={getAttentionOverlay(splitRightSite, "right")}
                          simulateOverlayRows={splitRightSite.isUser ? simulateOverlayRows : null}
                          simulateAiLabelsSlot={aiLabelsSlotForSite(splitRightSite)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {viewMode === "slider" &&
                splitLeftSite &&
                splitRightSite &&
                splitLeftSite.screenshotUrl &&
                splitRightSite.screenshotUrl && (
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    {wideSoloSide === null ? (
                      <>
                        <div className="flex min-w-0 shrink-0 gap-2 md:gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <a
                              href={splitLeftSite.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-foreground hover:underline decoration-primary/60 underline-offset-2"
                              title={splitLeftSite.url}
                            >
                              {splitLeftSite.domain}
                            </a>
                            <div className="flex shrink-0 items-center gap-1">
                              <AiTipsColumnButton
                                active={aiTipsVisible}
                                onToggle={() => setAiTipsVisible((v) => !v)}
                                pushToolbarHelp={pushToolbarHelp}
                                compact
                              />
                              <ZoomColumnControls {...zoomColumnProps(splitLeftSite.url)} compact />
                              <HeatmapColumnButton
                                active={heatmapEnabledUrls.includes(splitLeftSite.url)}
                                onToggle={() => toggleHeatmapUrl(splitLeftSite.url)}
                                pushToolbarHelp={pushToolbarHelp}
                                compact
                              />
                              <WideLayoutButton
                                fullWidth={false}
                                onToggle={() => setWideSoloSide((s) => (s === "left" ? null : "left"))}
                                pushToolbarHelp={pushToolbarHelp}
                                compact
                              />
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <a
                              href={splitRightSite.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-foreground hover:underline decoration-primary/60 underline-offset-2"
                              title={splitRightSite.url}
                            >
                              {splitRightSite.domain}
                            </a>
                            <div className="flex shrink-0 items-center gap-1">
                              <AiTipsColumnButton
                                active={aiTipsVisible}
                                onToggle={() => setAiTipsVisible((v) => !v)}
                                pushToolbarHelp={pushToolbarHelp}
                                compact
                              />
                              <ZoomColumnControls {...zoomColumnProps(splitRightSite.url)} compact />
                              <HeatmapColumnButton
                                active={heatmapEnabledUrls.includes(splitRightSite.url)}
                                onToggle={() => toggleHeatmapUrl(splitRightSite.url)}
                                pushToolbarHelp={pushToolbarHelp}
                                compact
                              />
                              <WideLayoutButton
                                fullWidth={false}
                                onToggle={() => setWideSoloSide((s) => (s === "right" ? null : "right"))}
                                pushToolbarHelp={pushToolbarHelp}
                                compact
                              />
                            </div>
                          </div>
                        </div>
                        <SliderCompare
                          left={splitLeftSite}
                          right={splitRightSite}
                          leftLabel={splitLeftSite.domain}
                          rightLabel={splitRightSite.domain}
                          leftZoom={zoomLevelFor(splitLeftSite.url)}
                          rightZoom={zoomLevelFor(splitRightSite.url)}
                        />
                      </>
                    ) : wideSoloSide === "left" ? (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div className="flex min-w-0 shrink-0 items-stretch gap-1.5">
                          <div className="min-w-0 flex-1">
                            <SplitSiteColumnPicker
                              compact
                              sites={sites}
                              valueIdx={safeLeft}
                              onSelect={(idx) => {
                                pushToolbarHelp("vs-column-left", HINT_CONTROLS.vsSelect);
                                selectSplitLeft(idx);
                              }}
                              aiTips={{
                                active: aiTipsVisible,
                                onToggle: () => setAiTipsVisible((v) => !v),
                                pushToolbarHelp,
                              }}
                              zoom={zoomColumnProps(splitLeftSite.url)}
                              heatmap={{
                                active: heatmapEnabledUrls.includes(splitLeftSite.url),
                                onToggle: () => toggleHeatmapUrl(splitLeftSite.url),
                                pushToolbarHelp,
                              }}
                              wideLayout={{
                                fullWidth: true,
                                onToggle: () => setWideSoloSide((s) => (s === "left" ? null : "left")),
                                pushToolbarHelp,
                              }}
                            />
                          </div>
                          <ScreenshotWideExitButton
                            aria-label="Exit full-width column"
                            title="Exit full width"
                            onClose={() => setWideSoloSide(null)}
                          />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                          <ScreenshotFrame
                            site={splitLeftSite}
                            showZones={showZones}
                            expandedPin={expandedPin}
                            zoom={zoomLevelFor(splitLeftSite.url)}
                            overlayMode={effectiveOverlay}
                            sectionNavTick={sectionNavTick}
                            zoneLens={zoneLens}
                            deltaByKey={undefined}
                            problemIndicators={showProblemIndicators}
                            eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                            competitorScores={
                              showProblemIndicators && splitLeftSite.isUser ? competitorScoresForSplitLeft : undefined
                            }
                            compareDiffMode={false}
                            heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                            heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                            attentionOverlay={getAttentionOverlay(splitLeftSite, "left")}
                            simulateOverlayRows={splitLeftSite.isUser ? simulateOverlayRows : null}
                            simulateAiLabelsSlot={aiLabelsSlotForSite(splitLeftSite)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                        <div className="flex min-w-0 shrink-0 items-stretch gap-1.5">
                          <div className="min-w-0 flex-1">
                            <SplitSiteColumnPicker
                              compact
                              sites={sites}
                              valueIdx={safeRight}
                              onSelect={(idx) => {
                                pushToolbarHelp("vs-column-right", HINT_CONTROLS.vsSelect);
                                selectSplitRight(idx);
                              }}
                              aiTips={{
                                active: aiTipsVisible,
                                onToggle: () => setAiTipsVisible((v) => !v),
                                pushToolbarHelp,
                              }}
                              zoom={zoomColumnProps(splitRightSite.url)}
                              heatmap={{
                                active: heatmapEnabledUrls.includes(splitRightSite.url),
                                onToggle: () => toggleHeatmapUrl(splitRightSite.url),
                                pushToolbarHelp,
                              }}
                              wideLayout={{
                                fullWidth: true,
                                onToggle: () => setWideSoloSide((s) => (s === "right" ? null : "right")),
                                pushToolbarHelp,
                              }}
                            />
                          </div>
                          <ScreenshotWideExitButton
                            aria-label="Exit full-width column"
                            title="Exit full width"
                            onClose={() => setWideSoloSide(null)}
                          />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                          <ScreenshotFrame
                            site={splitRightSite}
                            showZones={showZones}
                            expandedPin={expandedPin}
                            zoom={zoomLevelFor(splitRightSite.url)}
                            overlayMode={effectiveOverlay}
                            sectionNavTick={sectionNavTick}
                            zoneLens={zoneLens}
                            deltaByKey={undefined}
                            problemIndicators={showProblemIndicators}
                            eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                            competitorScores={undefined}
                            compareDiffMode={false}
                            heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                            heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                            attentionOverlay={getAttentionOverlay(splitRightSite, "right")}
                            simulateOverlayRows={splitRightSite.isUser ? simulateOverlayRows : null}
                            simulateAiLabelsSlot={aiLabelsSlotForSite(splitRightSite)}
                          />
                        </div>
                      </div>
                    )}
                    {effectiveOverlay === "attention" && (
                      <p className="shrink-0 text-[10px] text-center text-muted-foreground leading-snug px-2">
                        Heatmap overlays work in Single, Original, or Split. Switch view to see predicted attention on each full screenshot side by side.
                      </p>
                    )}
                  </div>
                )}
            </div>

            <div className="shrink-0 space-y-2">
              {zoneLens === "delta" && (viewMode === "split" || viewMode === "compare" || !activeSite.isUser) && splitRightSite && (
                <p className="text-center text-[10px] text-muted-foreground dark:text-muted-foreground/90">
                  {splitLeftSite?.isUser && !splitRightSite?.isUser
                    ? "🟢 Competitor advantage · 🔴 Your advantage"
                    : !splitLeftSite?.isUser && splitRightSite?.isUser
                      ? "🟢 Your advantage · 🔴 Competitor advantage"
                      : splitLeftSite?.isUser || splitRightSite?.isUser
                        ? "🟢 Higher on the right · 🔴 Higher on the left"
                        : `🟢 ${splitRightSite.domain} · 🔴 ${splitLeftSite?.domain ?? ""}`}
                </p>
              )}

              {effectiveOverlay === "attention" && viewMode !== "slider" && (
                <p className="text-[10px] text-center text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "rgba(255, 85, 20, 0.5)" }} />
                    High (red/orange)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "rgba(255, 210, 40, 0.4)" }} />
                    Medium (yellow)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "rgba(55, 125, 255, 0.3)" }} />
                    Low (blue)
                  </span>
                </p>
              )}

            </div>
          </div>
          {fullWidth && (
            <HintTooltip
              side="left"
              title={HINT_CONTROLS.rightPanelToggle.title}
              description={HINT_CONTROLS.rightPanelToggle.description}
              action={HINT_CONTROLS.rightPanelToggle.action}
            >
              <button
                type="button"
                onClick={() => {
                  pushToolbarHelp("right-panel-open", HINT_CONTROLS.rightPanelToggle);
                  setFullWidth(false);
                }}
                className="absolute right-0 top-0 z-20 hidden h-[calc(2.25rem*0.9)] w-7 translate-y-0.5 items-center justify-center rounded-l-lg border border-border border-r-0 bg-background/95 pr-0.5 text-muted-foreground shadow-md backdrop-blur-sm hover:bg-muted hover:text-foreground lg:flex"
                aria-label="Open analysis panel"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
            </HintTooltip>
          )}
        </div>

        <div
          className={cn(
            "relative hidden min-h-0 shrink-0 flex-col overflow-hidden lg:flex",
            "lg:h-full lg:max-h-full lg:min-h-0 lg:self-stretch",
            "motion-safe:transition-[width,max-width,opacity] motion-safe:duration-300 motion-safe:ease-out",
            "motion-reduce:transition-none",
            fullWidth
              ? "lg:pointer-events-none lg:w-0 lg:max-w-0 lg:opacity-0"
              : "lg:w-[352px] lg:max-w-[352px] lg:opacity-100"
          )}
          aria-hidden={fullWidth}
        >
          <div className="flex h-full min-h-0 w-[352px] min-w-[352px] flex-col overflow-hidden">
            {actionPanel}
          </div>
        </div>
      </div>

      {!controlled && (
        <div className="grid shrink-0 gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(sites.length, 5)}, 1fr)` }}>
          {sites.map((site, i) => {
            const h = hintSiteTab(site.isUser, site.domain, deltaVsYou(site));
            return (
              <HintTooltip key={site.url} side="top" title={h.title} description={h.description} action={h.action}>
                <button
                  type="button"
                  onClick={() => {
                    pushToolbarHelp(`site-grid-${site.domain}`, hintSiteTab(site.isUser, site.domain, deltaVsYou(site)));
                    setActiveIdx(i);
                    setExpandedPin(null);
                  }}
                  className={cn("rounded-xl border p-2.5 text-left transition-all w-full", i === activeIdx ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30")}
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
                          title={`${SECTION_ZONES[key].label}: ${s?.toFixed(1) ?? "—"}`}
                        />
                      );
                    })}
                  </div>
                </button>
              </HintTooltip>
            );
          })}
        </div>
      )}
    </div>

    {sectionPreviewPlacement === "modal" && previewOpen ? (
      <SectionAiPreviewModal
        open
        onClose={closePreview}
        sectionTitle={previewTargetRow?.sectionLabel ?? "Section"}
        estFallback={previewTargetRow?.estAfter ?? 0}
        cropDataUrl={cropDataUrl}
        preview={previewData}
        loading={previewLoading}
        onAddToPlan={() => {
          if (previewTargetRow) {
            onSimulateToggle(previewTargetRow.id, true);
            toast(`Added to plan · ${previewTargetRow.sectionLabel}`, { duration: 2500, position: "bottom-center" });
          }
        }}
      />
    ) : null}

    <Dialog
      open={addCompetitorOpen}
      onOpenChange={(open) => {
        setAddCompetitorOpen(open);
        if (!open) setAddCompetitorInput("");
      }}
    >
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add competitor</DialogTitle>
          <DialogDescription>
            Runs the same full analysis pipeline as your main comparison: your site plus the competitors below, including
            this URL (up to {MAX_COMPETITORS} competitors total).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="add-competitor-url" className="sr-only">
            Competitor URL
          </label>
          <Input
            id="add-competitor-url"
            placeholder="competitor.com or https://…"
            value={addCompetitorInput}
            onChange={(e) => setAddCompetitorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitAddCompetitor();
              }
            }}
            autoComplete="url"
            className="font-mono text-sm"
          />
          {existingCompetitorUrls.length > 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Keeping: {existingCompetitorUrls.map((u) => getDomain(u)).join(", ")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setAddCompetitorOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submitAddCompetitor}>
            Run comparison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

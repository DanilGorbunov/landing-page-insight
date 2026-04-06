import { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
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
  GalleryHorizontal,
  Columns2,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart3,
  MousePointer2,
  Type,
  Flame,
  ArrowLeftRight,
  Shield,
  BookOpen,
  Timer,
  Target,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HintTooltip } from "@/components/HintTooltip";
import {
  ZoneAnchorPopup,
  ZonePortalTooltip,
  useHoverTooltipDelay,
} from "@/components/visual/VisualZoneLayers";
import {
  HINT_VIEW,
  HINT_VIEW_SLIDER,
  HINT_ANALYZE,
  HINT_LENS,
  HINT_CONTROLS,
  hintSiteTab,
} from "@/lib/compareUiHints";
import {
  DecisionActionPanel,
  CompareOverlayLayer,
  type CompareOverlayLayerMode,
} from "@/components/CompareDecisionPanels";
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
import type { SectionDeepDivePayload } from "@/components/CompareDecisionPanels";
import {
  type ToolbarContext,
  type ToolbarViewMode,
  getRightPanelHeader,
  formatToolbarContextForEmpty,
  sectionPassesToolbarFilters,
  countHotSections,
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

/** Section tabs on screenshots: in light UI theme use frosted dark chip + light text so labels stay readable on any screenshot. */
function screenshotPinSurface(score: number | null) {
  return cn(
    "border-white/[0.18] bg-zinc-950/[0.78] shadow-md shadow-black/25",
    score == null && "dark:border-muted-foreground/40 dark:bg-muted/60 dark:shadow-lg",
    score != null && score >= 7.5 && "dark:border-primary/60 dark:bg-primary/10 dark:shadow-lg",
    score != null && score >= 5 && score < 7.5 && "dark:border-amber-500/60 dark:bg-amber-500/10 dark:shadow-lg",
    score != null && score < 5 && "dark:border-red-500/60 dark:bg-red-500/10 dark:shadow-lg"
  );
}

function screenshotPinScoreClass(score: number | null) {
  if (score == null) return "text-zinc-400 dark:text-muted-foreground";
  if (score >= 7.5) return "text-emerald-300 dark:text-primary";
  if (score >= 5) return "text-amber-300 dark:text-amber-500";
  return "text-red-300 dark:text-red-500";
}

function ScoreIcon({ score }: { score: number | null }) {
  if (score == null) return null;
  if (score >= 7.5) return <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400 dark:text-primary" />;
  if (score >= 5) return <Lightbulb className="h-3 w-3 shrink-0 text-amber-400 dark:text-amber-500" />;
  return <AlertTriangle className="h-3 w-3 shrink-0 text-red-400 dark:text-red-500" />;
}

/** Toolbar overlay modes: layer modes + mobile frame (no extra SVG layer). */
type ToolbarOverlayMode = CompareOverlayLayerMode | "mobile";

const CIRCLED_EYE_ORDER = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

/** Section chip bottom bar: reflects user-site score band for that section (same as before). */
function chipUnderlineClass(score: number | null) {
  if (score == null) return "bg-muted-foreground/40 dark:bg-muted-foreground/50";
  if (score < 7) return "bg-red-500";
  if (score < 8) return "bg-amber-500";
  return "bg-primary";
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

function gapDetailForSection(sectionKey: string, gaps: CriticalGap[] | undefined): CriticalGap | undefined {
  return gaps?.find((gap) => matchesSectionKey(gap.area, sectionKey));
}

function buildZoneTooltipLines(
  ann: Annotation,
  args: {
    overlayMode: ToolbarOverlayMode;
    siteIsUser: boolean;
    compareDiffMode: boolean;
    sectionDelta: number | null;
    gapRow?: CriticalGap;
    vsDomain: string | null;
    /** When set, compare diff copy uses domains instead of "your page" / "You". */
    compareThisDomain?: string | null;
    eyeOrd: number | undefined;
  }
): { title: string; lines: string[] } | null {
  const { overlayMode, compareDiffMode, sectionDelta, gapRow, vsDomain, compareThisDomain, eyeOrd } = args;
  const sc = ann.score;
  const baseTitle =
    eyeOrd != null && eyeOrd <= 3 && vsDomain
      ? `Priority ${eyeOrd}: ${ann.label}${sc != null ? ` — ${sc.toFixed(1)}/10` : ""}`
      : `${ann.label}${sc != null ? ` — ${sc.toFixed(1)}/10` : ""}`;
  const title = `⚠️ ${baseTitle}`;
  const lines: string[] = [];

  if (overlayMode === "heatmap") {
    if (sectionDelta != null) {
      if (sectionDelta > 0.35) {
        lines.push(
          args.siteIsUser
            ? "Competitor is notably stronger in this band — tighten proof and clarity."
            : "The other page is notably stronger in this band — tighten proof and clarity."
        );
      } else if (sectionDelta < -0.35) {
        lines.push(
          args.siteIsUser
            ? "You're stronger here — keep this advantage visible."
            : "This page is stronger here — keep this advantage visible."
        );
      } else lines.push("Roughly even — small changes can shift perception.");
    } else {
      lines.push("Gap heat highlights score differences across the page.");
    }
  } else if (overlayMode === "conversion" && sc != null) {
    if (sc >= 8) lines.push("Strong: visitors likely understand what to do next.");
    else if (sc >= 6) lines.push("Needs improvement — reduce friction and clarify the primary ask.");
    else lines.push("Weak — visitors may hesitate or bounce before converting.");
  } else if (overlayMode === "attention") {
    lines.push(`Visual focus area: ${ann.label}. Open the Insight tab for narrative context.`);
  } else if (overlayMode === "copy") {
    lines.push(gapRow?.problem ?? ann.summary.slice(0, 200));
  } else {
    if (gapRow?.problem) lines.push(gapRow.problem);
    else if (ann.summary?.trim()) lines.push(ann.summary.length > 220 ? `${ann.summary.slice(0, 217)}…` : ann.summary);
  }

  if (compareDiffMode && vsDomain && sectionDelta != null) {
    const d = sectionDelta;
    const selfLabel = compareThisDomain?.trim();
    if (args.siteIsUser && !selfLabel) {
      lines.push(
        d > 0.08
          ? `${vsDomain} leads this section by ${d.toFixed(1)} pts vs your page.`
          : d < -0.08
            ? `You lead by ${Math.abs(d).toFixed(1)} pts vs ${vsDomain}.`
            : "Essentially tied on this section."
      );
    } else if (selfLabel) {
      lines.push(
        d > 0.08
          ? `${vsDomain} leads this section by ${d.toFixed(1)} pts vs ${selfLabel}.`
          : d < -0.08
            ? `${selfLabel} leads by ${Math.abs(d).toFixed(1)} pts vs ${vsDomain}.`
            : "Essentially tied on this section."
      );
    }
  }

  const filtered = lines.map((l) => l.trim()).filter(Boolean);
  if (filtered.length === 0) return null;
  return { title, lines: filtered.slice(0, 4) };
}

function SectionZoneInteractiveHitbox({
  ann,
  zoneTooltipFor,
  onZoneMore,
}: {
  ann: Annotation;
  zoneTooltipFor: (ann: Annotation) => { title: string; lines: string[] } | null;
  onZoneMore: (ann: Annotation) => void;
}) {
  const hitRef = useRef<HTMLDivElement | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipRect, setTipRect] = useState<DOMRect | null>(null);
  const [tipContent, setTipContent] = useState<{ title: string; lines: string[] } | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const { show, hide } = useHoverTooltipDelay();

  const syncRect = useCallback(() => {
    if (hitRef.current) setTipRect(hitRef.current.getBoundingClientRect());
  }, []);

  return (
    <>
      <div
        ref={hitRef}
        role="presentation"
        className="absolute inset-0 z-[18] cursor-pointer"
        style={{ pointerEvents: "auto" }}
        onMouseEnter={() => {
          const content = zoneTooltipFor(ann);
          if (!content) return;
          show(() => {
            syncRect();
            setTipContent(content);
            setTipOpen(true);
          });
        }}
        onMouseLeave={() => {
          hide(() => {
            setTipOpen(false);
            setTipRect(null);
            setTipContent(null);
          });
        }}
        onClick={(e) => {
          e.stopPropagation();
          syncRect();
          setTipOpen(false);
          setPopupOpen(true);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          syncRect();
          setPopupOpen(true);
        }}
      />
      <ZonePortalTooltip
        open={Boolean(tipOpen && tipContent && !popupOpen)}
        anchorRect={tipRect}
        title={tipContent?.title ?? ""}
        lines={tipContent?.lines ?? []}
      />
      <ZoneAnchorPopup
        open={popupOpen}
        anchorRect={tipRect}
        onClose={() => setPopupOpen(false)}
        title={ann.label}
        scoreLine={ann.score != null ? `Score: ${ann.score.toFixed(1)}/10` : undefined}
        body={
          ann.preview?.trim()
            ? ann.preview.length > 420
              ? `${ann.preview.slice(0, 417)}…`
              : ann.preview
            : ann.summary
        }
        onMore={() => onZoneMore(ann)}
      />
    </>
  );
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
  const pinSummary =
    ann.summary.length > 200 ? `${ann.summary.slice(0, 200).trim()}…` : ann.summary;
  const pinAction =
    ann.score != null && ann.score < 7
      ? "Click to expand the text; “More” opens actions in the right panel."
      : "Stronger section — compare with the matching zone on the competitor screenshot.";
  return (
    <div className="absolute z-[25] pointer-events-auto" style={{ top: `${ann.top + ann.height / 2}%`, [side]: "6px", transform: "translateY(-50%)", maxWidth: "min(320px,44vw)" }}>
      <HintTooltip
        disabled={expanded}
        side={side === "left" ? "right" : "left"}
        title={`${ann.label} — ${ann.score != null ? ann.score.toFixed(1) : "—"}/10`}
        description={pinSummary}
        action={pinAction}
      >
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px] font-semibold backdrop-blur-md transition-all cursor-pointer select-none",
            screenshotPinSurface(ann.score),
            expanded && "ring-2 ring-primary/40"
          )}
        >
          <ScoreIcon score={ann.score} />
          <span className="text-zinc-100 dark:text-foreground">{ann.label}</span>
          {ann.score != null && (
            <span className={cn("tabular-nums font-bold", screenshotPinScoreClass(ann.score))}>{ann.score.toFixed(1)}</span>
          )}
        </button>
      </HintTooltip>
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

type ZoneLens = "balanced" | "hot" | "delta";

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
  compareDiffMode,
  zoneTooltipFor,
  onZoneMore,
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
  /** VIEW Compare: green = competitor does better, red = you do better (uses comp−user delta). */
  compareDiffMode?: boolean;
  /** Hover/click interactions on section bands (Compare + visual overlays). */
  zoneTooltipFor?: (ann: Annotation) => { title: string; lines: string[] } | null;
  onZoneMore?: (ann: Annotation) => void;
}) {
  if (!show) return null;
  return (
    <>
      {annotations.map((a) => {
        const sc = a.score;
        const isHot = zoneLens === "hot" && sc != null && sc < 7;
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
        const cd = compareDiffMode && deltaByKey && deltaByKey[a.sectionKey] != null ? deltaByKey[a.sectionKey]! : null;
        const compareDiffClass =
          compareDiffMode && cd != null
            ? cd > 0.08
              ? "border-primary/50 bg-primary/20 z-[2]"
              : cd < -0.08
                ? "border-red-500/50 bg-red-500/20 z-[2]"
                : "border-border/60 bg-muted/20 z-[1]"
            : null;
        return (
          <div
            key={a.sectionKey}
            className={cn(
              "absolute left-0 right-0 pointer-events-none transition-colors rounded-lg",
              !compareDiffMode && !lowScoreProblem && "border-t border-b",
              compareDiffMode && compareDiffClass,
              !compareDiffMode &&
                (sc != null && sc >= 7.5
                  ? "border-primary/25 bg-primary/[0.08]"
                  : sc != null && sc >= 5
                    ? "border-amber-500/25 bg-amber-500/[0.08]"
                    : sc != null
                      ? "border-red-500/30 bg-red-500/[0.1]"
                      : "border-muted-foreground/10 bg-muted/5"),
              !compareDiffMode && lowScoreProblem && "z-[4] border-2 border-dashed border-red-500 dark:border-red-400",
              isHot && "ring-2 ring-red-500/40 ring-inset animate-pulse z-[1]"
            )}
            style={{ top: `${a.top}%`, height: `${a.height}%` }}
          >
            {dTint != null && dTint !== 0 && (
              <div
                className={cn(
                  "absolute inset-0 rounded-lg z-[3]",
                  dTint > 0 ? "bg-primary/20 dark:bg-primary/25" : "bg-red-500/20 dark:bg-red-500/25"
                )}
              />
            )}
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
            {isHot && !theyBetter && (
              <div className="absolute right-1 top-1 z-[2] rounded bg-red-600/95 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow">
                Hot zone
              </div>
            )}
            {zoneTooltipFor && onZoneMore && (
              <SectionZoneInteractiveHitbox ann={a} zoneTooltipFor={zoneTooltipFor} onZoneMore={onZoneMore} />
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
  compareDiffMode,
  heatmapGapPairByKey,
  heatmapGapOnCompetitorOnly,
  attentionOverlay,
  zoneTooltipFor,
  onZoneMore,
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
  compareDiffMode?: boolean;
  heatmapGapPairByKey?: Record<string, { user: number | null; comp: number | null }>;
  heatmapGapOnCompetitorOnly?: boolean;
  zoneTooltipFor?: (ann: Annotation) => { title: string; lines: string[] } | null;
  onZoneMore?: (ann: Annotation) => void;
  /** Analyze → Attention: Claude Vision heatmap + toggle. */
  attentionOverlay?: {
    zones: AttentionZone[] | null;
    layerVisible: boolean;
    onLayerVisibleChange: (v: boolean) => void;
    loading: boolean;
    showPlaceholder: boolean;
  } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [first5sFoldPct, setFirst5sFoldPct] = useState<number | null>(null);

  const layerMode: CompareOverlayLayerMode = overlayMode === "mobile" ? "compare" : overlayMode;
  const mobileFrame = overlayMode === "mobile";
  const attForLayer =
    layerMode === "attention" && attentionOverlay
      ? {
          zones: attentionOverlay.zones,
          visible: attentionOverlay.layerVisible,
          showPlaceholder: attentionOverlay.showPlaceholder,
        }
      : null;

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
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-1.5">
      {attentionOverlay && overlayMode === "attention" && !attentionOverlay.loading && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-lg border border-border/80 bg-muted/40 px-1.5 py-1">
          <button
            type="button"
            onClick={() => attentionOverlay.onLayerVisibleChange(false)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors",
              !attentionOverlay.layerVisible ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            📸 Original
          </button>
          <button
            type="button"
            onClick={() => attentionOverlay.onLayerVisibleChange(true)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors",
              attentionOverlay.layerVisible ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            🧠 Heatmap
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-border bg-muted/20 scrollbar-hide"
        style={{ cursor: zoom > 1 ? "grab" : undefined }}
      >
      <div
        className={cn(
          "relative overflow-hidden inline-block min-w-full origin-top transition-transform duration-150 ease-out",
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
          deltaLensTint={deltaLensTint}
          compareDiffMode={compareDiffMode}
          zoneTooltipFor={zoneTooltipFor}
          onZoneMore={onZoneMore}
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
          first5sTopPct={layerMode === "first5s" ? first5sFoldPct : null}
          heatmapGapPairByKey={heatmapGapPairByKey}
          heatmapGapOnCompetitorOnly={heatmapGapOnCompetitorOnly}
          siteIsUser={site.isUser}
          attention={attForLayer}
          onAttentionZoneMore={
            onZoneMore && showZones && layerMode === "attention"
              ? () => {
                  const ann = site.annotations.find((a) => a.sectionKey === "hero") ?? site.annotations[0];
                  onZoneMore(ann);
                }
              : undefined
          }
        />
        {attentionOverlay?.loading && overlayMode === "attention" && (
          <div className="pointer-events-none absolute inset-0 z-[24] flex flex-col items-center justify-center gap-2 rounded-xl bg-background/75 backdrop-blur-sm px-4 text-center transition-opacity duration-300">
            <span className="text-2xl" aria-hidden>
              🧠
            </span>
            <p className="text-xs font-semibold text-foreground">Analyzing attention patterns…</p>
            <p className="text-[10px] text-muted-foreground max-w-[240px] leading-snug">Claude Vision is scoring visual hierarchy. This can take up to a minute.</p>
          </div>
        )}
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
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-border bg-muted/30 select-none scrollbar-hide">
        <div className="relative min-h-[120px]">
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

function SplitSiteColumnPicker({
  sites,
  valueIdx,
  onSelect,
  compact,
}: {
  sites: SiteEntry[];
  valueIdx: number;
  onSelect: (idx: number) => void;
  /** Tighter pill for stacked layout above section chips. */
  compact?: boolean;
}) {
  const site = sites[valueIdx];
  if (!site) return null;
  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 items-center rounded-lg border border-border font-semibold text-muted-foreground transition-colors hover:text-foreground",
        compact ? "gap-1 px-2 py-1 text-[10px]" : "gap-1.5 px-2.5 py-1.5 text-[11px]"
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
}

/** Section score chips (Hero, CTA, …). Scores reflect `chipSite` (column being viewed). */
function SectionChipsStrip({
  chipSite,
  sortedSectionKeys,
  zoneLens,
  expandedPin,
  onSelectSection,
  userSite,
  vsSite,
  activeSite,
  tooltipCompareDomain,
  result,
  compact,
}: {
  chipSite: SiteEntry;
  sortedSectionKeys: readonly string[];
  zoneLens: ZoneLens;
  expandedPin: string | null;
  onSelectSection: (key: string) => void;
  userSite: SiteEntry;
  vsSite: SiteEntry | null;
  activeSite: SiteEntry;
  tooltipCompareDomain: string | null;
  result: AnalysisResult;
  /** Shorter labels + minimal vertical padding (row under URL). */
  compact?: boolean;
}) {
  return (
    <div className="flex w-max min-w-0 max-w-none flex-nowrap items-center gap-1.5">
      {sortedSectionKeys.map((key) => {
        const ann = chipSite.annotations.find((a) => a.sectionKey === key);
        const uSc = userSite.annotations.find((a) => a.sectionKey === key)?.score ?? null;
        const compSc =
          vsSite?.annotations.find((a) => a.sectionKey === key)?.score ??
          (!activeSite.isUser ? activeSite.annotations.find((a) => a.sectionKey === key)?.score : null);
        const gapPts = uSc != null && compSc != null ? Math.round((uSc - compSc) * 10) / 10 : null;
        const priority = sectionPriorityFromGap(key, result.gaps, uSc);
        const insightLine = userSite.annotations.find((a) => a.sectionKey === key)?.summary ?? "—";
        const gapRow = gapDetailForSection(key, result.gaps);
        const chipUser = chipUnderlineClass(uSc);
        const greySectionChip =
          (zoneLens === "hot" && uSc != null && uSc >= 7) ||
          (zoneLens === "delta" && uSc != null && compSc != null && !(compSc > uSc));
        return (
          <Tooltip key={key} delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelectSection(key)}
                className={cn(
                  "group relative inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border font-semibold transition-colors",
                  compact ? "gap-0.5 px-2 pb-1.5 pt-1 text-[10px]" : "gap-1 px-2.5 pb-2 pt-1.5 text-[11px]",
                  expandedPin === key
                    ? "border-amber-500/60 bg-amber-500/10 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10"
                    : "border-border hover:border-border/80 hover:bg-muted/40",
                  greySectionChip && "opacity-45 grayscale"
                )}
              >
                <span className="inline-flex items-baseline gap-0.5">
                  <span
                    className={cn(
                      expandedPin === key
                        ? "text-amber-950 dark:text-amber-100"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {compact ? SECTION_ZONES[key].short : SECTION_ZONES[key].label}
                  </span>
                  {ann?.score != null && (
                    <span className={cn("tabular-nums font-bold", sColor(ann.score))}>{ann.score.toFixed(1)}</span>
                  )}
                </span>
                <span className={cn("absolute bottom-0 left-1 right-1 h-[2px] rounded-full", chipUser)} aria-hidden />
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
              {gapRow && (
                <div className="mt-2 border-t border-white/15 pt-2 space-y-1">
                  <p className="text-[10px] leading-snug text-amber-100/95">
                    <span className="font-bold">Issue: </span>
                    {gapRow.problem}
                  </p>
                  <p className="text-[10px] leading-snug text-emerald-100/95">
                    <span className="font-bold">Fix: </span>
                    {gapRow.recommendation}
                  </p>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  result: AnalysisResult;
  url: string;
  /** When set with `onCompareSiteIdxChange`, selection is controlled (e.g. dashboard header tabs). */
  compareSiteIdx?: number;
  onCompareSiteIdxChange?: (idx: number) => void;
  /** When set, the VIEW + ANALYZE toolbar is portaled into this node (e.g. dashboard header). */
  compareToolbarSlot?: HTMLElement | null;
}

export function ScreenshotCompare({
  result,
  url,
  compareSiteIdx: controlledIdx,
  onCompareSiteIdxChange,
  compareToolbarSlot,
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
  const [zoneLens, setZoneLens] = useState<ZoneLens>("balanced");
  const [sectionDeepDive, setSectionDeepDive] = useState<SectionDeepDivePayload | null>(null);
  const [showPins, setShowPins] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [fullWidth, setFullWidth] = useState(false);
  const [viewMode, setViewMode] = useState<ToolbarViewMode>("compare");
  const [splitLeftIdx, setSplitLeftIdx] = useState(0);
  const [splitRightIdx, setSplitRightIdx] = useState(1);
  const splitIdxInitRef = useRef(false);
  const [zoomIdx, setZoomIdx] = useState(0);
  /** Null = neutral (no analyze mode selected); layer behaves as baseline "compare" (no tint). */
  const [analyzeMode, setAnalyzeMode] = useState<ToolbarOverlayMode | null>(null);
  const effectiveOverlay: ToolbarOverlayMode = analyzeMode ?? "compare";

  const [fixMode, setFixMode] = useState(false);
  const [simplifyCEO, setSimplifyCEO] = useState(false);
  const [planFocusTick, setPlanFocusTick] = useState(0);
  const [quickWinDismissed, setQuickWinDismissed] = useState(false);
  const [narrowViewport, setNarrowViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setNarrowViewport(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const zoom = ZOOM_LEVELS[zoomIdx] ?? 1;

  const moreMenuLooksActive = Boolean(
    zoneLens === "delta" ||
      (analyzeMode &&
        (analyzeMode === "trust" ||
          analyzeMode === "readability" ||
          (narrowViewport && ["attention", "copy", "first5s"].includes(analyzeMode))))
  );

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

  const { safeLeft, safeRight } = useMemo(() => {
    const n = sites.length;
    if (n < 2) return { safeLeft: 0, safeRight: 0 };
    const L = Math.min(Math.max(0, splitLeftIdx), n - 1);
    const R = Math.min(Math.max(0, splitRightIdx), n - 1);
    return { safeLeft: L, safeRight: R };
  }, [sites.length, splitLeftIdx, splitRightIdx]);

  const splitLeftSite = sites[safeLeft];
  const splitRightSite = sites.length > 1 ? sites[safeRight] : null;

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
        /** Demo + API zones always drive HeatmapOverlay; legacy gradient placeholder off. */
        showPlaceholder: false,
      };
    },
    [effectiveOverlay, viewMode, attentionState, attentionLayerVisible, splitLeftSite?.url]
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

  const zoneTooltipForSite = useCallback(
    (site: SiteEntry) => (ann: Annotation) => {
      const gapRow = gapDetailForSection(ann.sectionKey, result.gaps);
      const eyeOrd = eyeOrderByKey?.[ann.sectionKey];
      const pairMode = viewMode === "split" || viewMode === "compare";
      let sectionDelta: number | null = null;
      let vsDomainTip: string | null = null;
      let compareThisDomain: string | undefined;

      if (pairMode && splitLeftSite && splitRightSite) {
        const L = splitLeftSite.annotations.find((a) => a.sectionKey === ann.sectionKey)?.score ?? null;
        const R = splitRightSite.annotations.find((a) => a.sectionKey === ann.sectionKey)?.score ?? null;
        if (L != null && R != null) {
          if (site.url === splitLeftSite.url) {
            sectionDelta = Math.round((R - L) * 10) / 10;
            vsDomainTip = splitRightSite.domain;
          } else {
            sectionDelta = Math.round((L - R) * 10) / 10;
            vsDomainTip = splitLeftSite.domain;
          }
          compareThisDomain = site.domain;
        }
      } else {
        sectionDelta = sectionDeltaVsCompetitor?.[ann.sectionKey] ?? null;
        vsDomainTip = vsSite?.domain ?? null;
      }

      return buildZoneTooltipLines(ann, {
        overlayMode: effectiveOverlay,
        siteIsUser: site.isUser,
        compareDiffMode: viewMode === "compare",
        sectionDelta,
        gapRow,
        vsDomain: vsDomainTip,
        compareThisDomain,
        eyeOrd,
      });
    },
    [
      effectiveOverlay,
      result.gaps,
      eyeOrderByKey,
      sectionDeltaVsCompetitor,
      vsSite?.domain,
      viewMode,
      splitLeftSite,
      splitRightSite,
    ]
  );

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

  const tooltipCompareDomain = vsSite?.domain ?? (!activeSite.isUser ? activeSite.domain : null);

  const hotSectionCount = useMemo(
    () => countHotSections(userSite.annotations.map((a) => a.score)),
    [userSite.annotations]
  );

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
  }, [sites.length]);

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
      hotSectionCount={hotSectionCount}
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
    />
  );

  const compareToolbarEl = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          {/* ANALYZE — Attention → HOT → Gap heat … → First 5s → More */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <HintTooltip
              side="bottom"
              title={HINT_ANALYZE.attention.title}
              description={HINT_ANALYZE.attention.description}
              action={HINT_ANALYZE.attention.action}
            >
              <button
                type="button"
                onClick={() => setAnalyzeMode((prev) => (prev === "attention" ? null : "attention"))}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors max-md:hidden",
                  analyzeMode === "attention"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                Attention
              </button>
            </HintTooltip>

            <HintTooltip
              side="bottom"
              title={HINT_LENS.hot.title}
              description={HINT_LENS.hot.description}
              action={HINT_LENS.hot.action}
            >
              <button
                type="button"
                onClick={() => setZoneLens((prev) => (prev === "hot" ? "balanced" : "hot"))}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                  zoneLens === "hot"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Flame className="h-3.5 w-3.5 shrink-0" />
                HOT{hotSectionCount > 0 ? ` (${hotSectionCount})` : ""}
              </button>
            </HintTooltip>

            {(
              [
                { id: "heatmap" as const, label: "Gap heat", icon: BarChart3, narrow: false },
                { id: "copy" as const, label: "Copy", icon: Type, narrow: true },
                { id: "conversion" as const, label: "Conversion", icon: Target, narrow: false },
                { id: "first5s" as const, label: "First 5s", icon: Timer, narrow: true },
              ] as const
            ).map(({ id, label, icon: I, narrow }) => {
              const hint = HINT_ANALYZE[id];
              return (
                <HintTooltip key={id} side="bottom" title={hint.title} description={hint.description} action={hint.action}>
                  <button
                    type="button"
                    onClick={() => setAnalyzeMode((prev) => (prev === id ? null : id))}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                      analyzeMode === id
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-border text-muted-foreground hover:text-foreground",
                      narrow && "max-md:hidden"
                    )}
                  >
                    <I className="h-3.5 w-3.5" />
                    {label}
                  </button>
                </HintTooltip>
              );
            })}

            <DropdownMenu>
              <Tooltip delayDuration={280}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors border-border text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        moreMenuLooksActive && "border-amber-500/50 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                      )}
                    >
                      More
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[min(320px,calc(100vw-2rem))] space-y-1.5 p-3 text-left">
                  <p className="text-xs font-semibold leading-snug text-foreground">{HINT_CONTROLS.moreMenu.title}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{HINT_CONTROLS.moreMenu.description}</p>
                  <p className="mt-1 border-t border-border pt-2 text-[11px] leading-relaxed text-foreground/95">
                    <span className="font-medium">Action: </span>
                    <span className="text-muted-foreground">{HINT_CONTROLS.moreMenu.action}</span>
                  </p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-48">
                <div className="md:hidden">
                  <DropdownMenuItem onClick={() => setAnalyzeMode((p) => (p === "attention" ? null : "attention"))}>
                    <MousePointer2 className="h-3.5 w-3.5 mr-2" />
                    Attention
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAnalyzeMode((p) => (p === "copy" ? null : "copy"))}>
                    <Type className="h-3.5 w-3.5 mr-2" />
                    Copy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAnalyzeMode((p) => (p === "first5s" ? null : "first5s"))}>
                    <Timer className="h-3.5 w-3.5 mr-2" />
                    First 5s
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>
                <DropdownMenuItem
                  disabled={sites.length < 2}
                  title={`${HINT_VIEW_SLIDER.title}: ${HINT_VIEW_SLIDER.description} ${HINT_VIEW_SLIDER.action}`}
                  onClick={() => {
                    setViewMode("slider");
                  }}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 mr-2" />
                  Slider
                </DropdownMenuItem>
                <DropdownMenuItem
                  title={`${HINT_ANALYZE.trust.title}: ${HINT_ANALYZE.trust.description}`}
                  onClick={() => setAnalyzeMode((p) => (p === "trust" ? null : "trust"))}
                >
                  <Shield className="h-3.5 w-3.5 mr-2" />
                  Trust
                </DropdownMenuItem>
                <DropdownMenuItem
                  title={`${HINT_ANALYZE.readability.title}: ${HINT_ANALYZE.readability.description}`}
                  onClick={() => setAnalyzeMode((p) => (p === "readability" ? null : "readability"))}
                >
                  <BookOpen className="h-3.5 w-3.5 mr-2" />
                  Read
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={activeSite.isUser}
                  title={`${HINT_LENS.delta.title}: ${HINT_LENS.delta.description}`}
                  onClick={() => setZoneLens((p) => (p === "delta" ? "balanced" : "delta"))}
                  className="gap-2 font-semibold"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">Δ VS YOU</span>
                  {zoneLens === "delta" && <Check className="h-3.5 w-3.5 shrink-0" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
          <div className="flex items-center gap-1.5">
            <HintTooltip side="bottom" title={HINT_VIEW.single.title} description={HINT_VIEW.single.description} action={HINT_VIEW.single.action}>
              <button
                type="button"
                onClick={() => setViewMode("single")}
                aria-label="Single"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border p-1.5 text-[11px] font-semibold transition-colors",
                  viewMode === "single" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </HintTooltip>
            <HintTooltip side="bottom" title={HINT_VIEW.split.title} description={HINT_VIEW.split.description} action={HINT_VIEW.split.action} disabled={sites.length < 2}>
              <button
                type="button"
                disabled={sites.length < 2}
                onClick={() => setViewMode("split")}
                aria-label="Split"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border p-1.5 text-[11px] font-semibold transition-colors",
                  viewMode === "split" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  sites.length < 2 && "opacity-40 cursor-not-allowed"
                )}
              >
                <GalleryHorizontal className="h-3.5 w-3.5" />
              </button>
            </HintTooltip>
            <HintTooltip side="bottom" title={HINT_VIEW.compare.title} description={HINT_VIEW.compare.description} action={HINT_VIEW.compare.action} disabled={sites.length < 2}>
              <button
                type="button"
                disabled={sites.length < 2}
                onClick={() => setViewMode("compare")}
                aria-label="Compare"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border p-1.5 text-[11px] font-semibold transition-colors",
                  viewMode === "compare" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  sites.length < 2 && "opacity-40 cursor-not-allowed"
                )}
              >
                <Columns2 className="h-3.5 w-3.5" />
              </button>
            </HintTooltip>
          </div>
          <span className="hidden h-4 w-px shrink-0 bg-border/70 sm:block" aria-hidden />
          <div className="flex items-center gap-1.5">
            <HintTooltip side="bottom" title={HINT_CONTROLS.pins.title} description={HINT_CONTROLS.pins.description} action={HINT_CONTROLS.pins.action}>
              <button
                type="button"
                onClick={() => setShowPins((v) => !v)}
                aria-label="Pins"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg border p-1.5 text-[11px] font-semibold transition-colors",
                  showPins ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {showPins ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            </HintTooltip>
            <HintTooltip side="bottom" title={HINT_CONTROLS.zones.title} description={HINT_CONTROLS.zones.description} action={HINT_CONTROLS.zones.action}>
              <button type="button" onClick={() => setShowZones((v) => !v)} className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold", showZones ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>Zones</button>
            </HintTooltip>
            <HintTooltip side="bottom" title={HINT_CONTROLS.wide.title} description={HINT_CONTROLS.wide.description} action={HINT_CONTROLS.wide.action}>
              <button
                type="button"
                onClick={() => setFullWidth((v) => !v)}
                aria-label={fullWidth ? "Normal width" : "Wide"}
                className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {fullWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </HintTooltip>
          </div>
          <span className="hidden h-4 w-px shrink-0 bg-border/70 sm:block" aria-hidden />
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <HintTooltip side="bottom" title={HINT_CONTROLS.zoomOut.title} description={HINT_CONTROLS.zoomOut.description} action={HINT_CONTROLS.zoomOut.action} disabled={zoomIdx === 0}>
              <button type="button" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} className="p-1 rounded hover:bg-muted disabled:opacity-40"><ZoomOut className="h-3 w-3" /></button>
            </HintTooltip>
            <span className="text-[10px] font-mono font-bold w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <HintTooltip side="bottom" title={HINT_CONTROLS.zoomIn.title} description={HINT_CONTROLS.zoomIn.description} action={HINT_CONTROLS.zoomIn.action} disabled={zoomIdx >= ZOOM_LEVELS.length - 1}>
              <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} disabled={zoomIdx >= ZOOM_LEVELS.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-40"><ZoomIn className="h-3 w-3" /></button>
            </HintTooltip>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {!controlled && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <HintTooltip side="bottom" title={HINT_CONTROLS.prevSite.title} description={HINT_CONTROLS.prevSite.description}>
            <button type="button" onClick={handlePrev} className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </HintTooltip>
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
          <HintTooltip side="bottom" title={HINT_CONTROLS.nextSite.title} description={HINT_CONTROLS.nextSite.description}>
            <button type="button" onClick={handleNext} className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </HintTooltip>
        </div>
      )}

      {compareToolbarSlot === undefined
        ? compareToolbarEl
        : compareToolbarSlot
          ? createPortal(compareToolbarEl, compareToolbarSlot)
          : null}

      {/* Center (scrollable) | Right panel — left column fit-content height; right fills viewport band */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden min-w-0",
          !fullWidth && "lg:flex-row lg:items-stretch"
        )}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:min-w-0 lg:max-h-full lg:self-stretch">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {viewMode === "slider" && (
              <div className="w-full min-w-0 shrink-0 overflow-x-auto scrollbar-hide">
                <SectionChipsStrip
                  compact
                  chipSite={activeSite}
                  sortedSectionKeys={sortedSectionKeys}
                  zoneLens={zoneLens}
                  expandedPin={expandedPin}
                  onSelectSection={(key) => {
                    setExpandedPin(key);
                    setSectionNavTick((n) => n + 1);
                  }}
                  userSite={userSite}
                  vsSite={vsSite}
                  activeSite={activeSite}
                  tooltipCompareDomain={tooltipCompareDomain}
                  result={result}
                />
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {viewMode === "single" &&
                (activeSite.screenshotUrl ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div
                      className={cn(
                        "grid w-full min-w-0 shrink-0 items-start gap-x-2 gap-y-1",
                        controlled ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1"
                      )}
                    >
                      {controlled && (
                        <div className="min-w-0">
                          <SplitSiteColumnPicker
                            compact
                            sites={sites}
                            valueIdx={activeIdx}
                            onSelect={setActiveIdx}
                          />
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex min-w-0 justify-end overflow-x-auto scrollbar-hide",
                          !controlled && "col-span-full"
                        )}
                      >
                        <SectionChipsStrip
                          compact
                          chipSite={activeSite}
                          sortedSectionKeys={sortedSectionKeys}
                          zoneLens={zoneLens}
                          expandedPin={expandedPin}
                          onSelectSection={(key) => {
                            setExpandedPin(key);
                            setSectionNavTick((n) => n + 1);
                          }}
                          userSite={userSite}
                          vsSite={vsSite}
                          activeSite={activeSite}
                          tooltipCompareDomain={tooltipCompareDomain}
                          result={result}
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <ScreenshotFrame
                        site={activeSite}
                        showZones={showZones}
                        showPins={showPins}
                        expandedPin={expandedPin}
                        setExpandedPin={setExpandedPin}
                        zoom={zoom}
                        overlayMode={effectiveOverlay}
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
                        heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                        heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                        attentionOverlay={getAttentionOverlay(activeSite)}
                        zoneTooltipFor={showZones ? zoneTooltipForSite(activeSite) : undefined}
                        onZoneMore={showZones ? openSectionMore : undefined}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    No screenshot.
                  </div>
                ))}

              {(viewMode === "split" || viewMode === "compare") && splitLeftSite && splitRightSite && (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden md:flex-row md:items-stretch md:gap-3">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="grid w-full min-w-0 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
                      <div className="min-w-0">
                        <SplitSiteColumnPicker
                          compact
                          sites={sites}
                          valueIdx={safeLeft}
                          onSelect={selectSplitLeft}
                        />
                      </div>
                      <div className="flex min-w-0 justify-end overflow-x-auto scrollbar-hide">
                        <SectionChipsStrip
                          compact
                          chipSite={splitLeftSite}
                          sortedSectionKeys={sortedSectionKeys}
                          zoneLens={zoneLens}
                          expandedPin={expandedPin}
                          onSelectSection={(key) => {
                            setExpandedPin(key);
                            setSectionNavTick((n) => n + 1);
                          }}
                          userSite={userSite}
                          vsSite={vsSite}
                          activeSite={activeSite}
                          tooltipCompareDomain={tooltipCompareDomain}
                          result={result}
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <ScreenshotFrame
                        site={splitLeftSite}
                        showZones={showZones}
                        showPins={showPins}
                        expandedPin={expandedPin}
                        setExpandedPin={setExpandedPin}
                        zoom={zoom}
                        overlayMode={effectiveOverlay}
                        sectionNavTick={sectionNavTick}
                        zoneLens={zoneLens}
                        deltaByKey={viewMode === "compare" ? sectionDeltaLR : undefined}
                        onSectionMore={openSectionMore}
                        problemIndicators={showProblemIndicators}
                        eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                        competitorScores={
                          showProblemIndicators && splitLeftSite.isUser ? competitorScoresForSplitLeft : undefined
                        }
                        deltaLensTint={false}
                        compareDiffMode={viewMode === "compare"}
                        heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                        heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                        attentionOverlay={getAttentionOverlay(splitLeftSite, "left")}
                        zoneTooltipFor={showZones ? zoneTooltipForSite(splitLeftSite) : undefined}
                        onZoneMore={showZones ? openSectionMore : undefined}
                      />
                    </div>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="grid w-full min-w-0 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1">
                      <div className="min-w-0">
                        <SplitSiteColumnPicker
                          compact
                          sites={sites}
                          valueIdx={safeRight}
                          onSelect={selectSplitRight}
                        />
                      </div>
                      <div className="flex min-w-0 justify-end overflow-x-auto scrollbar-hide">
                        <SectionChipsStrip
                          compact
                          chipSite={splitRightSite}
                          sortedSectionKeys={sortedSectionKeys}
                          zoneLens={zoneLens}
                          expandedPin={expandedPin}
                          onSelectSection={(key) => {
                            setExpandedPin(key);
                            setSectionNavTick((n) => n + 1);
                          }}
                          userSite={userSite}
                          vsSite={vsSite}
                          activeSite={activeSite}
                          tooltipCompareDomain={tooltipCompareDomain}
                          result={result}
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <ScreenshotFrame
                        site={splitRightSite}
                        showZones={showZones}
                        showPins={showPins}
                        expandedPin={expandedPin}
                        setExpandedPin={setExpandedPin}
                        zoom={zoom}
                        overlayMode={effectiveOverlay}
                        sectionNavTick={sectionNavTick}
                        zoneLens={zoneLens}
                        deltaByKey={sectionDeltaLR}
                        onSectionMore={openSectionMore}
                        problemIndicators={showProblemIndicators}
                        eyeOrderByKey={showProblemIndicators ? eyeOrderByKey : undefined}
                        competitorScores={undefined}
                        deltaLensTint={zoneLens === "delta"}
                        compareDiffMode={viewMode === "compare"}
                        heatmapGapPairByKey={effectiveOverlay === "heatmap" ? heatmapGapPairByKey : undefined}
                        heatmapGapOnCompetitorOnly={effectiveOverlay === "heatmap"}
                        attentionOverlay={getAttentionOverlay(splitRightSite, "right")}
                        zoneTooltipFor={showZones ? zoneTooltipForSite(splitRightSite) : undefined}
                        onZoneMore={showZones ? openSectionMore : undefined}
                      />
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "slider" &&
                splitLeftSite &&
                splitRightSite &&
                splitLeftSite.screenshotUrl &&
                splitRightSite.screenshotUrl && (
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <SliderCompare
                      left={splitLeftSite}
                      right={splitRightSite}
                      leftLabel={splitLeftSite.domain}
                      rightLabel={splitRightSite.domain}
                    />
                    {effectiveOverlay === "attention" && (
                      <p className="shrink-0 text-[10px] text-center text-muted-foreground leading-snug px-2">
                        Attention heatmap overlays work in Single, Original, or Split. Switch view to see predicted attention on each full screenshot side by side.
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

              {!activeSite.isUser && userSite && (
                <div className="rounded-xl border border-dashed border-border p-2.5 bg-muted/20">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    Δ vs you
                  </p>
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
                            <span
                              className={cn(
                                "font-bold",
                                d > 0 ? "text-primary" : d < 0 ? "text-red-500" : "text-muted-foreground"
                              )}
                            >
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
          </div>
        </div>

        {!fullWidth && (
          <div className="hidden min-h-0 w-[391px] max-w-[391px] shrink-0 flex-col overflow-hidden lg:flex lg:h-full lg:max-h-full lg:min-h-0 lg:self-stretch">
            {actionPanel}
          </div>
        )}
      </div>

      {fullWidth && (
        <div className="max-h-[min(88vh,900px)] min-h-0 shrink-0 overflow-y-auto">{actionPanel}</div>
      )}

      {!controlled && (
        <div className="grid shrink-0 gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(sites.length, 5)}, 1fr)` }}>
          {sites.map((site, i) => {
            const h = hintSiteTab(site.isUser, site.domain, deltaVsYou(site));
            return (
              <HintTooltip key={site.url} side="top" title={h.title} description={h.description} action={h.action}>
                <button
                  type="button"
                  onClick={() => {
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
  );
}

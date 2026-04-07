import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeSimulateProjection, type SimulateImprovementItem } from "@/lib/simulateWhatIf";
import type { SimulateAiLabelRow } from "@/lib/simulateAiLabels";

const DOT = { red: "#E24B4A", amber: "#EF9F27", green: "#1D9E75" } as const;
const DOT_SIZE_PX = 14;
const BASE_DOT_SHADOW = "0 2px 6px rgba(0,0,0,0.25)";
const SESSION_HINTS_SEEN = "hints_seen";
const INTRO_MS = 3000;

function scoreToDotColor(score: number): (typeof DOT)[keyof typeof DOT] {
  if (score < 6) return DOT.red;
  if (score < 8) return DOT.amber;
  return DOT.green;
}

function scoreEmoji(score: number): string {
  if (score < 6) return "🔴";
  if (score < 8) return "🟡";
  return "🟢";
}

function marginalLift(
  itemId: string,
  base: number | null,
  items: SimulateImprovementItem[],
  checked: Record<string, boolean>,
  competitorOverallScores: number[]
): number {
  const a = { ...checked, [itemId]: false };
  const b = { ...checked, [itemId]: true };
  const p0 = computeSimulateProjection(base, items, a, competitorOverallScores).projected;
  const p1 = computeSimulateProjection(base, items, b, competitorOverallScores).projected;
  return Math.round((p1 - p0) * 10) / 10;
}

function pulseClassForScore(score: number, seen: boolean): string | null {
  if (seen || score >= 8) return null;
  if (score < 6) return "animate-ai-dot-pulse-red";
  return "animate-ai-dot-pulse-amber";
}

export function AiLabelMarkers({
  rows,
  simulateChecked,
  onSimulateToggle,
  userOverall,
  simulateItems,
  competitorOverallScores,
  onFirstDotInteraction,
}: {
  rows: SimulateAiLabelRow[];
  simulateChecked: Record<string, boolean>;
  onSimulateToggle: (id: string, checked: boolean) => void;
  userOverall: number | null;
  simulateItems: SimulateImprovementItem[];
  competitorOverallScores: number[];
  /** Hides hints bar after first interaction with any dot. */
  onFirstDotInteraction?: () => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; line: { x1: number; y1: number; x2: number; y2: number } | null } | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [showIntroPills, setShowIntroPills] = useState(true);
  const [postCollapseBounce, setPostCollapseBounce] = useState(false);
  const introTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [pulseSeen, setPulseSeen] = useState<Record<string, boolean>>({});
  const firstInteractionDone = useRef(false);

  const [showFirstTooltip, setShowFirstTooltip] = useState(false);
  const [firstTooltipReady, setFirstTooltipReady] = useState(false);
  const [firstTooltipPos, setFirstTooltipPos] = useState<{ top: number; left: number } | null>(null);

  const firstDotId = useMemo(() => {
    if (rows.length === 0) return null;
    return [...rows].sort((a, b) => a.topPct - b.topPct)[0].id;
  }, [rows]);

  const rowsKey = useMemo(() => rows.map((r) => r.id).join("|"), [rows]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_HINTS_SEEN) === "1") {
        setShowFirstTooltip(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setShowFirstTooltip(true);
  }, [rowsKey]);

  useEffect(() => {
    if (!showFirstTooltip) {
      setFirstTooltipReady(false);
      return;
    }
    const t = setTimeout(() => setFirstTooltipReady(true), INTRO_MS + 400);
    return () => clearTimeout(t);
  }, [showFirstTooltip, rowsKey]);

  useEffect(() => {
    if (rows.length === 0) return;
    introTimersRef.current.forEach(clearTimeout);
    introTimersRef.current = [];
    setShowIntroPills(true);
    const t1 = setTimeout(() => {
      setShowIntroPills(false);
      const t2 = setTimeout(() => {
        setPostCollapseBounce(true);
        const t3 = setTimeout(() => setPostCollapseBounce(false), 450);
        introTimersRef.current.push(t3);
      }, 200);
      introTimersRef.current.push(t2);
    }, INTRO_MS);
    introTimersRef.current.push(t1);
    return () => {
      introTimersRef.current.forEach(clearTimeout);
      introTimersRef.current = [];
    };
  }, [rowsKey, rows.length]);

  const dismissFirstTooltipOnly = useCallback(() => {
    setShowFirstTooltip(false);
    try {
      sessionStorage.setItem(SESSION_HINTS_SEEN, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const markFirstDotInteractionOnly = useCallback(() => {
    if (!firstInteractionDone.current) {
      firstInteractionDone.current = true;
      onFirstDotInteraction?.();
    }
  }, [onFirstDotInteraction]);

  const onDotInteract = useCallback(() => {
    markFirstDotInteractionOnly();
    dismissFirstTooltipOnly();
  }, [markFirstDotInteractionOnly, dismissFirstTooltipOnly]);

  useEffect(() => {
    if (!showFirstTooltip || !firstTooltipReady) return;
    const onAny = () => dismissFirstTooltipOnly();
    window.addEventListener("pointerdown", onAny, true);
    window.addEventListener("keydown", onAny, true);
    return () => {
      window.removeEventListener("pointerdown", onAny, true);
      window.removeEventListener("keydown", onAny, true);
    };
  }, [showFirstTooltip, firstTooltipReady, dismissFirstTooltipOnly]);

  const updateFirstTooltipPos = useCallback(() => {
    if (!showFirstTooltip || !firstTooltipReady || !firstDotId) {
      setFirstTooltipPos(null);
      return;
    }
    const el = dotRefs.current.get(firstDotId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFirstTooltipPos({
      top: r.top - 8,
      left: r.left + r.width / 2,
    });
  }, [showFirstTooltip, firstTooltipReady, firstDotId]);

  useLayoutEffect(() => {
    updateFirstTooltipPos();
  }, [updateFirstTooltipPos, showIntroPills, rowsKey, postCollapseBounce]);

  useEffect(() => {
    if (!showFirstTooltip || !firstTooltipReady) return;
    const onScrollOrResize = () => updateFirstTooltipPos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showFirstTooltip, firstTooltipReady, updateFirstTooltipPos]);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const onEnterMarker = useCallback(
    (id: string) => {
      clearLeaveTimer();
      setHoverId(id);
      setPulseSeen((p) => ({ ...p, [id]: true }));
      markFirstDotInteractionOnly();
      dismissFirstTooltipOnly();
    },
    [clearLeaveTimer, markFirstDotInteractionOnly, dismissFirstTooltipOnly]
  );

  const onLeaveMarker = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setHoverId(null), 300);
  }, [clearLeaveTimer]);

  const closeCard = useCallback(() => setOpenCardId(null), []);

  const openRow = rows.find((r) => r.id === openCardId);
  const openRowLift = openRow
    ? marginalLift(openRow.id, userOverall, simulateItems, simulateChecked, competitorOverallScores)
    : 0;

  useLayoutEffect(() => {
    if (!openCardId || !openRow) {
      setCardPos(null);
      return;
    }
    const dotEl = dotRefs.current.get(openCardId);
    if (!dotEl) return;
    const dr = dotEl.getBoundingClientRect();
    const cw = 280;
    const ch = 360;
    const gap = 12;
    const cx = dr.left + dr.width / 2;
    const cy = dr.top + dr.height / 2;
    let left = dr.right + gap;
    let top = dr.top;
    if (left + cw > window.innerWidth - 8) left = dr.left - cw - gap;
    if (left < 8) left = 8;
    if (top + ch > window.innerHeight - 8) top = Math.max(8, dr.top - ch - gap);
    if (top < 8) top = dr.bottom + gap;
    left = Math.min(left, window.innerWidth - cw - 8);
    const x1 = cx;
    const y1 = cy;
    const x2 = left < cx ? left + cw : left;
    const y2 = top + 40;
    setCardPos({ top, left, line: { x1, y1, x2, y2 } });
  }, [openCardId, openRow, rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCard();
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t)) return;
      if (openCardId && dotRefs.current.get(openCardId)?.contains(t)) return;
      for (const el of dotRefs.current.values()) {
        if (el?.contains(t)) return;
      }
      closeCard();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [openCardId, closeCard]);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[20] min-h-full">
        {rows.map((row, i) => {
          const checked = !!simulateChecked[row.id];
          const fill = scoreToDotColor(row.score);
          const hover = hoverId === row.id;
          const growRight = row.leftPct <= 72;
          const showPill = showIntroPills || hover;
          const seenPulse = !!pulseSeen[row.id];
          const pulseCls = !showIntroPills ? pulseClassForScore(row.score, seenPulse) : null;

          return (
            <div
              key={row.id}
              className="pointer-events-auto absolute flex items-center gap-0"
              style={{
                top: `${row.topPct}%`,
                left: `${row.leftPct}%`,
                transform: "translate(-50%, -50%)",
                flexDirection: growRight ? "row" : "row-reverse",
              }}
              onMouseEnter={() => onEnterMarker(row.id)}
              onMouseLeave={onLeaveMarker}
              onPointerDownCapture={() => {
                onDotInteract();
                setPulseSeen((p) => ({ ...p, [row.id]: true }));
              }}
            >
              <motion.div
                ref={(el) => {
                  if (el) dotRefs.current.set(row.id, el);
                  else dotRefs.current.delete(row.id);
                }}
                className="relative z-[21] shrink-0"
                initial={false}
                animate={{
                  scale: postCollapseBounce ? [1, 1.15, 1] : 1,
                }}
                transition={
                  postCollapseBounce
                    ? { duration: 0.45, times: [0, 0.45, 1], ease: "easeOut" }
                    : { type: "spring", stiffness: 420, damping: 28, delay: i * 0.06 }
                }
              >
                <span
                  className={cn("block rounded-full border-2 border-white", pulseCls)}
                  style={{
                    width: DOT_SIZE_PX,
                    height: DOT_SIZE_PX,
                    backgroundColor: checked ? DOT.green : fill,
                    boxShadow: BASE_DOT_SHADOW,
                  }}
                  aria-hidden
                />
                {checked ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold leading-none text-white">
                    ✓
                  </span>
                ) : null}
              </motion.div>

              <AnimatePresence>
                {showPill ? (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn("z-[22] overflow-hidden", growRight ? "ml-1.5 origin-left" : "mr-1.5 origin-right")}
                  >
                    <div
                      className="flex h-8 min-w-0 items-center gap-2 rounded-full border-[1.5px] bg-white py-1 pl-2.5 pr-1 shadow-sm dark:bg-zinc-950"
                      style={{ borderColor: checked ? DOT.green : fill }}
                    >
                      <span className="text-[13px] font-semibold leading-none text-foreground whitespace-nowrap">
                        {checked ? "Added ✓" : `${scoreEmoji(row.score)} ${row.sectionLabel} · ${row.score.toFixed(1)}`}
                      </span>
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-white shadow-sm hover:brightness-110"
                        aria-label={checked ? "Remove from Simulate" : "Open suggestion"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDotInteract();
                          if (checked) {
                            onSimulateToggle(row.id, false);
                            toast(`Removed ${row.sectionLabel} from Simulate`, { duration: 2500, position: "bottom-center" });
                          } else {
                            setOpenCardId(row.id);
                          }
                        }}
                      >
                        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {showFirstTooltip &&
        firstTooltipReady &&
        firstTooltipPos &&
        firstDotId &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[101] max-w-[220px] -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-3 py-2 text-[11px] font-medium text-popover-foreground shadow-lg"
            style={{ top: firstTooltipPos.top, left: firstTooltipPos.left }}
            role="tooltip"
          >
            <span className="block leading-snug">Click to see AI fix →</span>
            <div
              className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-popover"
              aria-hidden
            />
          </div>,
          document.body
        )}

      {openRow &&
        cardPos &&
        createPortal(
          <>
            {cardPos.line ? (
              <svg className="pointer-events-none fixed inset-0 z-[99]" aria-hidden>
                <line
                  x1={cardPos.line.x1}
                  y1={cardPos.line.y1}
                  x2={cardPos.line.x2}
                  y2={cardPos.line.y2}
                  stroke={scoreToDotColor(openRow.score)}
                  strokeWidth={2}
                  strokeOpacity={0.45}
                />
              </svg>
            ) : null}
            <div
              ref={cardRef}
              className="fixed z-[100] w-[280px] rounded-xl border border-border bg-white p-0 shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:bg-zinc-950 dark:shadow-black/40"
              style={{ top: cardPos.top, left: cardPos.left }}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {openRow.sectionLabel} · {openRow.score.toFixed(1)} → est. {openRow.estAfter.toFixed(1)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                  onClick={closeCard}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[min(52vh,380px)] space-y-3 overflow-y-auto px-3 py-2.5 text-[11px] leading-relaxed">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Problem</p>
                  <p className="mt-1 text-foreground">{openRow.whatISee}</p>
                </div>
                {(openRow.suggestedCopy || openRow.competitorLine) && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Fix this</p>
                    <p className="mt-1 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-foreground">
                      {openRow.suggestedCopy || openRow.competitorLine}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pb-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    onClick={() => {
                      const t = openRow.suggestedCopy || openRow.whatISee;
                      void navigator.clipboard.writeText(t);
                      toast("Copied", { duration: 2000, position: "bottom-center" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1D9E75] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
                    onClick={() => {
                      if (simulateChecked[openRow.id]) {
                        onSimulateToggle(openRow.id, false);
                        toast(`Removed ${openRow.sectionLabel}`, { duration: 2500, position: "bottom-center" });
                      } else {
                        onSimulateToggle(openRow.id, true);
                        toast(`Added to plan · +${openRowLift.toFixed(1)} pts`, { duration: 2500, position: "bottom-center" });
                      }
                      closeCard();
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {simulateChecked[openRow.id] ? "✓ Added" : `Add to Simulate +${openRowLift.toFixed(1)}`}
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

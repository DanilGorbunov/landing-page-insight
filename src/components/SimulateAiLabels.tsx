import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeSimulateProjection, type SimulateImprovementItem } from "@/lib/simulateWhatIf";
import type { SimulateAiLabelRow } from "@/lib/simulateAiLabels";

const DOT = { red: "#E24B4A", amber: "#EF9F27", green: "#1D9E75" } as const;

function scoreToDotColor(score: number): (typeof DOT)[keyof typeof DOT] {
  if (score < 6) return DOT.red;
  if (score < 8) return DOT.amber;
  return DOT.green;
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

export function SimulateAiLabels({
  rows,
  simulateChecked,
  onSimulateToggle,
  userOverall,
  simulateItems,
  competitorOverallScores,
}: {
  rows: SimulateAiLabelRow[];
  simulateChecked: Record<string, boolean>;
  onSimulateToggle: (id: string, checked: boolean) => void;
  userOverall: number | null;
  simulateItems: SimulateImprovementItem[];
  competitorOverallScores: number[];
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; line: { x1: number; y1: number; x2: number; y2: number } | null } | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const cardRef = useRef<HTMLDivElement | null>(null);

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
    },
    [clearLeaveTimer]
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
    const ch = 320;
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
            >
              <motion.div
                ref={(el) => {
                  if (el) dotRefs.current.set(row.id, el);
                  else dotRefs.current.delete(row.id);
                }}
                className="relative z-[21] shrink-0 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
                style={{ width: 10, height: 10, backgroundColor: checked ? DOT.green : fill }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 24, delay: i * 0.2 }}
              >
                {checked ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </motion.div>

              <AnimatePresence>
                {hover ? (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={cn("z-[22] overflow-hidden", growRight ? "ml-1 origin-left" : "mr-1 origin-right")}
                  >
                    <div
                      className="flex h-7 min-w-0 items-center gap-1.5 rounded-full border-[1.5px] bg-white py-1 pl-2 pr-1 shadow-sm dark:bg-zinc-950"
                      style={{ borderColor: checked ? DOT.green : fill }}
                    >
                      <span className="text-[12px] font-semibold leading-none text-foreground whitespace-nowrap">
                        {checked ? "Added ✓" : `${row.sectionLabel} · ${row.score.toFixed(1)}`}
                      </span>
                      <button
                        type="button"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-white shadow-sm hover:brightness-110"
                        aria-label={checked ? "Remove from plan" : "Open suggestion"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (checked) {
                            onSimulateToggle(row.id, false);
                            toast(`Removed ${row.sectionLabel} from plan`, { duration: 2500, position: "bottom-center" });
                          } else {
                            setOpenCardId(row.id);
                          }
                        }}
                      >
                        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Plus className="h-3 w-3" strokeWidth={2.5} />}
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

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
                  strokeWidth={1.5}
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
                  <p className="text-sm font-semibold text-foreground">{openRow.sectionLabel}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {openRow.score.toFixed(1)} → {openRow.estAfter.toFixed(1)}
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
              <div className="max-h-[min(50vh,360px)] space-y-3 overflow-y-auto px-3 py-2.5 text-[11px] leading-relaxed">
                <p className="text-foreground">&ldquo;{openRow.whatISee}&rdquo;</p>
                {openRow.suggestedCopy ? (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Try this</p>
                    <p className="mt-1 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-foreground">{openRow.suggestedCopy}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pb-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
                    onClick={() => {
                      void navigator.clipboard.writeText(openRow.suggestedCopy || openRow.whatISee);
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
                        toast(`${openRow.sectionLabel} · +${openRowLift.toFixed(1)} pts`, { duration: 2500, position: "bottom-center" });
                      }
                      closeCard();
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {simulateChecked[openRow.id] ? "✓ Added" : `Add to plan +${openRowLift.toFixed(1)}`}
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

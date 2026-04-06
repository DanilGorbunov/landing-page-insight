import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Z_POPUP = 10000;

/** Tooltip anchored above the zone — child of the same hover target so there is no gap mouseleave. */
export function ZoneInlineHoverTooltip({
  visible,
  title,
  lines,
  className,
}: {
  visible: boolean;
  title: string;
  lines: string[];
  className?: string;
}) {
  return (
    <div
      role="tooltip"
      className={cn(
        "absolute bottom-full left-1/2 z-[30] mb-1 w-[min(260px,calc(100vw-2rem))] max-w-[260px] -translate-x-1/2 select-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-[13px] leading-snug text-white shadow-xl transition-opacity duration-150 dark:bg-zinc-950",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <p className="font-semibold leading-tight">{title}</p>
      {lines.map((line, i) => (
        <p key={i} className="mt-1.5 text-[12px] font-normal leading-relaxed text-zinc-100/95">
          {line}
        </p>
      ))}
    </div>
  );
}

export function ZoneAnchorPopup({
  open,
  anchorRect,
  onClose,
  title,
  scoreLine,
  body,
  onMore,
  moreLabel = "More details →",
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  title: string;
  scoreLine?: string;
  body: string;
  onMore: () => void;
  moreLabel?: string;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t)) onClose();
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open, onClose]);

  if (!open || !anchorRect || typeof document === "undefined") return null;

  const cardW = 280;
  const margin = 8;
  let left = anchorRect.right + margin;
  if (left + cardW > window.innerWidth - margin) {
    left = anchorRect.left - cardW - margin;
  }
  left = Math.max(margin, left);
  let top = anchorRect.top;
  top = Math.max(margin, Math.min(top, window.innerHeight - 200));

  const node = (
    <div
      ref={popRef}
      role="dialog"
      aria-modal="true"
      className="fixed w-[280px] select-none rounded-lg border border-border bg-card p-3 text-foreground shadow-xl dark:bg-zinc-900 dark:border-zinc-700"
      style={{ left, top, zIndex: Z_POPUP }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {scoreLine && <p className="mt-1 text-[11px] text-muted-foreground">{scoreLine}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={() => {
          onMore();
          onClose();
        }}
        className="mt-3 w-full rounded-lg border border-primary/40 bg-primary/10 py-2 text-[11px] font-bold uppercase tracking-wide text-primary hover:bg-primary/15"
      >
        {moreLabel}
      </button>
    </div>
  );

  return createPortal(node, document.body);
}

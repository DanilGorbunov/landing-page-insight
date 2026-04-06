import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const TIP_DELAY_MS = 200;
const Z_TOOLTIP = 9999;
const Z_POPUP = 10000;

function placeTooltip(rect: DOMRect, tipW: number, tipH: number, margin = 8): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const midY = rect.top + rect.height / 2;
  const placeAbove = midY > vh / 2;
  let top = placeAbove ? rect.top - tipH - margin : rect.bottom + margin;
  let left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(margin, Math.min(left, vw - tipW - margin));
  if (top < margin) top = rect.bottom + margin;
  if (top + tipH > vh - margin) top = Math.max(margin, rect.top - tipH - margin);
  return { left, top };
}

/** Dark floating tooltip (portal) — one visible at a time per instance. */
export function ZonePortalTooltip({
  open,
  anchorRect,
  title,
  lines,
  className,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  title: string;
  lines: string[];
  className?: string;
}) {
  if (!open || !anchorRect || typeof document === "undefined") return null;
  const tipW = 260;
  const tipH = 120;
  const pos = placeTooltip(anchorRect, tipW, tipH);

  const node = (
    <div
      role="tooltip"
      className={cn(
        "fixed rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-[13px] leading-snug text-white shadow-xl dark:bg-zinc-950 max-w-[260px]",
        className
      )}
      style={{
        left: pos.left,
        top: pos.top,
        width: tipW,
        zIndex: Z_TOOLTIP,
        pointerEvents: "none",
      }}
    >
      <p className="font-semibold leading-tight">{title}</p>
      {lines.map((line, i) => (
        <p key={i} className="mt-1.5 text-[12px] font-normal leading-relaxed text-zinc-100/95">
          {line}
        </p>
      ))}
    </div>
  );

  return createPortal(node, document.body);
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
      className="fixed w-[280px] rounded-lg border border-border bg-card p-3 text-foreground shadow-xl dark:bg-zinc-900 dark:border-zinc-700"
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

export function useHoverTooltipDelay() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, TIP_DELAY_MS);
  }, []);
  const hide = useCallback((fn?: () => void) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    fn?.();
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { show, hide };
}

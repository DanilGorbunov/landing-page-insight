import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { renderSectionPreviewOverlay, validateSectionPreviewChanges } from "@/lib/sectionPreviewCanvas";
import type { SectionPreviewResponse } from "@/types/sectionPreview";

export type SectionAiPreviewVariant = "default" | "compareColumn";

export function SectionAiPreviewModal({
  open,
  onClose,
  sectionTitle,
  estFallback,
  cropDataUrl,
  preview,
  loading,
  onAddToPlan,
  embedded = false,
  variant = "default",
}: {
  open: boolean;
  onClose: () => void;
  sectionTitle: string;
  estFallback: number;
  cropDataUrl: string | null;
  preview: SectionPreviewResponse | null;
  loading: boolean;
  onAddToPlan: () => void;
  /** No overlay — fills parent (e.g. compare column or popup window) */
  embedded?: boolean;
  /** compareColumn: same scroll frame as screenshot column, minimal chrome */
  variant?: SectionAiPreviewVariant;
}) {
  const est = preview?.estimatedScore ?? estFallback;
  const compareColumn = variant === "compareColumn";

  const [overlayLoading, setOverlayLoading] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const iframeSrcDoc = useMemo(() => {
    if (!preview?.htmlPatch) return "";
    const safe = preview.htmlPatch.replace(/<\/script/gi, "<\\/script");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
      *{box-sizing:border-box}
      body{margin:0;padding:12px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.45;color:#0f172a;background:#fff}
      @media (prefers-color-scheme:dark){body{color:#f8fafc;background:#0b1220}}
    </style></head><body>${safe}</body></html>`;
  }, [preview?.htmlPatch]);

  const textBundle = useMemo(() => {
    if (!preview) return "";
    const parts = [preview.headline, preview.subheadline, preview.ctaText].filter(Boolean);
    return parts.join("\n\n");
  }, [preview]);

  const previewKey = preview
    ? `${preview.explanation ?? ""}|${preview.htmlPatch ?? ""}|${JSON.stringify(preview.changes ?? [])}`
    : "";

  const imgMax = embedded && !compareColumn ? "max-h-[min(32vh,280px)]" : "";
  const iframeH = embedded && !compareColumn ? "h-[min(32vh,280px)]" : "min-h-[240px]";

  useEffect(() => {
    if (!open) {
      setSnapshotUrl(null);
      setUseIframeFallback(false);
      setOverlayLoading(false);
    }
  }, [open]);

  useEffect(() => {
    setSnapshotUrl(null);
    setUseIframeFallback(false);
  }, [previewKey]);

  /** Canvas overlay: screenshot + drawn change boxes; invalid coords → iframe */
  useEffect(() => {
    if (!open || loading || !preview || !cropDataUrl) {
      return;
    }

    setOverlayLoading(true);
    setUseIframeFallback(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const changes = preview.changes;
      if (!validateSectionPreviewChanges(changes, w, h)) {
        setUseIframeFallback(true);
        setOverlayLoading(false);
        return;
      }
      try {
        const url = renderSectionPreviewOverlay(img, changes);
        setSnapshotUrl(url);
      } catch {
        setUseIframeFallback(true);
      } finally {
        setOverlayLoading(false);
      }
    };
    img.onerror = () => {
      setUseIframeFallback(true);
      setOverlayLoading(false);
    };
    img.src = cropDataUrl;
  }, [open, loading, cropDataUrl, previewKey, preview]);

  const copyHtml = () => {
    if (!preview?.htmlPatch) return;
    void navigator.clipboard.writeText(preview.htmlPatch);
    toast.success("HTML copied");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copyText = () => {
    if (!textBundle) {
      toast.info("No text fields in preview");
      return;
    }
    void navigator.clipboard.writeText(textBundle);
    toast.success("Text copied");
  };

  const showRightGenerating = loading;
  const showRightRendering =
    !loading && preview && !snapshotUrl && !useIframeFallback && overlayLoading;

  if (!open) return null;

  /** Matches ScreenshotCompare `ScreenshotFrame` scroll shell */
  const compareScrollShell = "relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-border bg-background scrollbar-hide";

  if (compareColumn) {
    return (
      <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
        <div className={compareScrollShell} role="region" aria-label="AI improvement preview">
          <div className="relative inline-block min-w-full">
            {showRightGenerating ? (
              <div className="flex min-h-[200px] items-center justify-center px-4 text-sm text-muted-foreground">
                Generating preview…
              </div>
            ) : !preview ? (
              <div className="flex min-h-[200px] items-center justify-center px-4 text-sm text-muted-foreground">
                No preview yet.
              </div>
            ) : useIframeFallback ? (
              <iframe
                title="AI preview"
                className="block min-h-[min(70vh,800px)] w-full border-0 bg-white"
                sandbox="allow-same-origin"
                srcDoc={iframeSrcDoc}
              />
            ) : snapshotUrl ? (
              <img
                src={snapshotUrl}
                alt=""
                className="block h-auto w-full max-w-none select-none"
                draggable={false}
              />
            ) : showRightRendering ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 py-12">
                <div className="h-16 w-full max-w-xs animate-pulse rounded-lg bg-muted" />
                <p className="text-sm text-muted-foreground">Rendering preview…</p>
              </div>
            ) : (
              <iframe
                title="AI preview"
                className="block min-h-[min(70vh,800px)] w-full border-0 bg-white"
                sandbox="allow-same-origin"
                srcDoc={iframeSrcDoc}
              />
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border bg-muted/15 px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground">
            Est.{" "}
            <span className="font-bold tabular-nums text-foreground">{typeof est === "number" ? est.toFixed(1) : "—"}</span>
            /10
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" disabled={!preview?.htmlPatch} onClick={copyHtml}>
              Copy HTML
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" disabled={!textBundle} onClick={copyText}>
              Copy text
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn("h-7 bg-[#1D9E75] px-2 text-[10px] text-white hover:brightness-110")}
              disabled={loading}
              onClick={() => {
                onAddToPlan();
                onClose();
              }}
            >
              Add to plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const card = (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        embedded ? "max-h-full min-h-0 w-full flex-1 shadow-none" : "max-h-[min(92vh,900px)] w-full max-w-2xl shadow-2xl"
      )}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <h2 className="truncate text-sm font-semibold text-foreground">{sectionTitle} — AI Improvement Preview</h2>
        </div>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-b border-border">
        <p className="shrink-0 bg-muted/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          AI suggestion
        </p>
        <div className="min-h-0 flex-1 overflow-auto bg-background p-2">
          {showRightGenerating ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Generating preview…</div>
          ) : !preview ? (
            <div className="p-4 text-xs text-muted-foreground">No preview yet.</div>
          ) : useIframeFallback ? (
            <iframe
              title="AI HTML preview"
              className={cn("w-full rounded-md border border-border bg-white", iframeH)}
              sandbox="allow-same-origin"
              srcDoc={iframeSrcDoc}
            />
          ) : snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt="AI suggestion"
              className={cn("mx-auto w-full object-contain", imgMax || "max-h-[min(48vh,420px)]")}
            />
          ) : showRightRendering ? (
            <div className="flex h-[min(40vh,360px)] flex-col items-center justify-center gap-2 px-4">
              <div className="h-24 w-full max-w-xs animate-pulse rounded-lg bg-muted" />
              <p className="text-sm text-muted-foreground">Rendering preview…</p>
            </div>
          ) : (
            <iframe
              title="AI HTML preview"
              className={cn("w-full rounded-md border border-border bg-white", iframeH)}
              sandbox="allow-same-origin"
              srcDoc={iframeSrcDoc}
            />
          )}
        </div>
        <p className="shrink-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Est. score:{" "}
          <span className="font-bold tabular-nums text-foreground">{typeof est === "number" ? est.toFixed(1) : "—"}</span>
          /10
        </p>
      </div>

      {preview?.explanation ? (
        <p className="border-b border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">{preview.explanation}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
        <Button type="button" variant="outline" size="sm" disabled={!preview?.htmlPatch} onClick={copyHtml}>
          Copy HTML
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!textBundle} onClick={copyText}>
          Copy text
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn("bg-[#1D9E75] text-white hover:brightness-110")}
          disabled={loading}
          onClick={() => {
            onAddToPlan();
            onClose();
          }}
        >
          Add to plan
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">{card}</div>;
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      {card}
    </div>,
    document.body
  );
}

import { useCallback, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FileDown, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn, getDomain } from "@/lib/utils";
import { DashboardNavSidebar, type DashboardNavSidebarProps } from "@/components/DashboardNavSidebar";
import { DashboardReportHeaderBar } from "@/components/DashboardReportHeaderBar";
import {
  readFullInsightsPayload,
  writeFullInsightsPayload,
  readFullInsightsUnlockMeta,
} from "@/lib/reportSession";
import { auditPathForUrl } from "@/lib/auditSlug";
import { downloadFullInsightsPdf } from "@/lib/fullReportPdf";
import { getHistory, resolveCurrentHistoryEntryId, type HistoryEntry } from "@/lib/analysisHistory";

export type DashboardPageShellProps = {
  sidebarProps: DashboardNavSidebarProps;
  banner?: ReactNode;
  mainClassName?: string;
  children: ReactNode;
  showHeaderActions?: boolean;
  /**
   * When set (e.g. audit dashboard), refresh opens the re-audit dialog instead of navigating away immediately.
   */
  onReaudit?: () => void;
};

export function DashboardPageShell({
  sidebarProps,
  banner,
  mainClassName,
  children,
  showHeaderActions = true,
  onReaudit,
}: DashboardPageShellProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pdfLoading, setPdfLoading] = useState(false);

  const payload = readFullInsightsPayload();
  const url = payload?.url ?? null;
  const result = payload?.result ?? null;

  const currentDomain = url ? getDomain(url) : "No report";
  const currentHistoryEntryId = url && result ? resolveCurrentHistoryEntryId(url, result) : null;
  const historyEntries = getHistory();

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/history");
  }, [navigate]);

  const handleSelectHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      const current = readFullInsightsPayload();
      const meta = readFullInsightsUnlockMeta();
      const nextUrl = `https://${entry.domain}`;
      writeFullInsightsPayload({
        url: nextUrl,
        result: entry.result,
        planId: meta?.planId ?? current?.planId ?? "analysis",
        planName: meta?.planName ?? current?.planName ?? "Analysis",
        paidAt: entry.analyzedAt,
      });
      navigate(auditPathForUrl(nextUrl, searchParams.toString()), { replace: true });
    },
    [navigate, searchParams]
  );

  const handleReaudit = useCallback(() => {
    if (onReaudit) {
      onReaudit();
      return;
    }
    if (url && result) {
      navigate("/", { state: { startFreshAnalysis: { url } } });
      return;
    }
    toast.info("Load a report from the home page first.");
  }, [onReaudit, url, result, navigate]);

  const handleNewAnalysis = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleShare = useCallback(() => {
    try {
      const p = readFullInsightsPayload();
      if (!p?.url) {
        toast.error("No report loaded to share");
        return;
      }
      const path = auditPathForUrl(p.url, searchParams.toString());
      const u = new URL(path, window.location.origin);
      u.searchParams.set("shared", "true");
      void navigator.clipboard.writeText(u.toString());
      toast.success("Report link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }, [searchParams]);

  const handlePdf = useCallback(async () => {
    const p = readFullInsightsPayload();
    if (!p?.result) {
      toast.error("No report to export");
      return;
    }
    setPdfLoading(true);
    try {
      await downloadFullInsightsPdf(p);
    } catch (e) {
      console.error(e);
      toast.error("Could not build PDF");
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const reauditDisabled = !result || !url;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardNavSidebar {...sidebarProps} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 bg-background/90 py-1 pl-1 pr-4 backdrop-blur",
            !showHeaderActions && "justify-start"
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-1 items-center overflow-x-auto pb-0.5 sm:px-1">
            <DashboardReportHeaderBar
              currentDomain={currentDomain}
              currentHistoryEntryId={currentHistoryEntryId}
              historyEntries={historyEntries}
              onBack={handleBack}
              onSelectHistoryEntry={handleSelectHistoryEntry}
              onReaudit={handleReaudit}
              onNewAnalysis={sidebarProps.onNewAnalysis ?? handleNewAnalysis}
              reauditDisabled={reauditDisabled}
            />
          </div>
          {showHeaderActions ? (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Link
                to="/pricing"
                state={{ fromReport: true }}
                aria-label="Upgrade PRO"
                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/45 bg-amber-500/12 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-500/20 dark:text-amber-100"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Upgrade PRO</span>
              </Link>
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share report"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                type="button"
                onClick={handlePdf}
                disabled={pdfLoading}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
                )}
              >
                <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{pdfLoading ? "Building…" : "Export PDF"}</span>
              </button>
            </div>
          ) : null}
        </header>

        {banner}

        <main className={cn("min-h-0 flex-1", mainClassName)}>{children}</main>
      </div>
    </div>
  );
}

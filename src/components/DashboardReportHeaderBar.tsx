import { ChevronDown, ChevronLeft, Plus, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/analysisHistory";

export interface DashboardReportHeaderBarProps {
  /** e.g. nike.com — or placeholder when no URL loaded */
  currentDomain: string;
  currentHistoryEntryId: string | null;
  historyEntries: HistoryEntry[];
  onBack: () => void;
  onSelectHistoryEntry: (entry: HistoryEntry) => void;
  /** Re-audit / refresh analysis */
  onReaudit: () => void;
  onNewAnalysis: () => void;
  /** Disable refresh when nothing to re-run */
  reauditDisabled?: boolean;
}

/**
 * Shared header row: back · domain history · refresh · new analysis.
 * Matches dashboard chrome across shell pages.
 */
export function DashboardReportHeaderBar({
  currentDomain,
  currentHistoryEntryId,
  historyEntries,
  onBack,
  onSelectHistoryEntry,
  onReaudit,
  onNewAnalysis,
  reauditDisabled = false,
}: DashboardReportHeaderBarProps) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-label="Back"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 max-w-[min(14rem,42vw)] items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-left text-xs font-semibold text-foreground shadow-sm transition-colors",
              "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="Analysis history"
          >
            <span className="min-w-0 truncate">{currentDomain}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[min(320px,60vh)] w-[min(280px,calc(100vw-2rem))] overflow-y-auto">
          {historyEntries.length === 0 ? (
            <div className="px-2 py-2 text-xs leading-snug text-muted-foreground">
              No saved analyses yet. Run a check from the home page.
            </div>
          ) : (
            historyEntries.map((e) => {
              const isCurrent = currentHistoryEntryId != null && e.id === currentHistoryEntryId;
              return (
                <DropdownMenuItem
                  key={e.id}
                  disabled={isCurrent}
                  onClick={() => onSelectHistoryEntry(e)}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <span className={cn("min-w-0 flex-1 truncate font-medium", isCurrent && "text-primary")}>{e.domain}</span>
                  {e.score != null && (
                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{e.score.toFixed(1)}</span>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={onReaudit}
        disabled={reauditDisabled}
        aria-label="Re-audit from scratch"
        title="Re-audit from scratch"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
          reauditDisabled && "pointer-events-none opacity-40"
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>

      <button
        type="button"
        onClick={onNewAnalysis}
        aria-label="New analysis"
        title="New analysis"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

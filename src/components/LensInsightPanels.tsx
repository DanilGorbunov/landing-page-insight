import { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, MinusCircle } from "lucide-react";
import type { VisualLensSectionModel, VisualLensRow, HotLensIssue, DeltaLensItem, LensRowStatus } from "@/lib/lensPanelContent";

function RowIcon({ status }: { status: LensRowStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />;
  if (status === "bad") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />;
  return <MinusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

function VisualRow({ row }: { row: VisualLensRow }) {
  return (
    <div className="flex gap-2 items-start text-[11px] leading-snug">
      <RowIcon status={row.status} />
      <div className="min-w-0 flex-1">
        <span className="text-muted-foreground">{row.label}: </span>
        <span className="text-foreground font-medium">{row.value}</span>
      </div>
    </div>
  );
}

export function VisualLensCollapsible({ sections }: { sections: VisualLensSectionModel[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );

  return (
    <div className="space-y-2">
      {sections.map((sec) => {
        const isOpen = open[sec.id] ?? true;
        return (
          <div key={sec.id} className="rounded-lg border border-border bg-card/80 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [sec.id]: !isOpen }))}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-muted/25 hover:bg-muted/40 text-left"
            >
              <span className="text-[11px] font-bold text-foreground">{sec.title}</span>
              {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
            {isOpen && (
              <div className="px-2.5 py-2 space-y-2 border-t border-border/80">
                {sec.rows.map((row, i) => (
                  <VisualRow key={`${sec.id}-${i}`} row={row} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HotLensPanel({ issues }: { issues: HotLensIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-3 text-[11px] text-foreground leading-snug">
        <span className="font-semibold">✅ No critical issues found</span> — all sections score 7.0 or above.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((it) => (
        <div
          key={it.sectionKey}
          className={cn(
            "rounded-lg border border-red-500/35 bg-card/90 px-3 py-2.5 space-y-1.5",
            it.priority === "P1" && "border-l-4 border-l-red-500"
          )}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold text-foreground">{it.label}</span>
            <span className="text-[11px] font-bold tabular-nums text-red-600 dark:text-red-400">{it.score.toFixed(1)}/10</span>
          </div>
          <span
            className={cn(
              "inline-flex text-[9px] font-bold uppercase rounded px-1.5 py-0.5",
              it.priority === "P1" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            )}
          >
            {it.priority}
          </span>
          <p className="text-[11px] text-foreground leading-snug">{it.problem}</p>
          {it.competitorNote && (
            <p className="text-[10px] text-muted-foreground leading-snug border-t border-border/60 pt-1.5 mt-1">
              vs competitor: {it.competitorNote}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function DeltaLensPanel({ summary, items }: { summary: string | null; items: DeltaLensItem[] }) {
  if (!summary) {
    return (
      <p className="text-[11px] text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-3 leading-relaxed">
        Select a competitor tab and ensure section scores exist to see where they lead.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-foreground rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-3 leading-relaxed">
        {summary}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-foreground leading-snug">{summary}</p>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.sectionKey} className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2.5 space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold text-foreground">
                {it.label}: <span className="text-red-600 dark:text-red-400 tabular-nums">−{it.gap.toFixed(1)} pts</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] tabular-nums">
              <span className="rounded border border-border bg-background/80 px-2 py-0.5">
                You <span className="font-bold text-foreground">{it.userScore.toFixed(1)}</span>
              </span>
              <span className="rounded border border-border bg-background/80 px-2 py-0.5">
                Them <span className="font-bold text-primary">{it.compScore.toFixed(1)}</span>
              </span>
            </div>
            {it.narrative && <p className="text-[11px] text-muted-foreground leading-snug">{it.narrative}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

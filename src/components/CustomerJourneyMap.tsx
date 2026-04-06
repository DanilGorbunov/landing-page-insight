import type { JourneyStage } from "@/types/api";
import { cn } from "@/lib/utils";
import { useState } from "react";

const STATUS_COLORS = {
  addressed: "bg-primary border-primary",
  partial: "bg-amber-400 border-amber-400 dark:bg-amber-500 dark:border-amber-500",
  missing: "bg-destructive border-destructive",
} as const;

const STATUS_NODE_BG = {
  addressed: "bg-primary/10 border-primary/40",
  partial: "bg-amber-400/10 border-amber-400/40 dark:bg-amber-500/10 dark:border-amber-500/40",
  missing: "bg-destructive/10 border-destructive/40",
} as const;

const STATUS_LABELS = {
  addressed: "Addressed",
  partial: "Partial",
  missing: "Missing",
} as const;

export function CustomerJourneyMap({ stages }: { stages: JourneyStage[] }) {
  const [activeStage, setActiveStage] = useState<number | null>(null);

  if (!stages || stages.length === 0) return null;

  const addressed = stages.filter((s) => s.status === "addressed").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {addressed}/{stages.length} stages addressed
        </p>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          {(["addressed", "partial", "missing"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2 w-2 rounded-full", STATUS_COLORS[s])} />
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Horizontal flow */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max mx-auto justify-center">
          {stages.map((stage, i) => (
            <div key={stage.stage} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveStage(activeStage === i ? null : i)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-all cursor-pointer min-w-[90px]",
                  STATUS_NODE_BG[stage.status],
                  activeStage === i && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                <span className={cn("h-3 w-3 rounded-full", STATUS_COLORS[stage.status])} />
                <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                  {stage.stage}
                </span>
              </button>
              {i < stages.length - 1 && (
                <div className="w-6 h-0.5 bg-border shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Evidence detail */}
      {activeStage !== null && stages[activeStage] && (
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_COLORS[stages[activeStage].status])} />
            <span className="text-sm font-semibold text-foreground">{stages[activeStage].stage}</span>
            <span className={cn(
              "ml-auto rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              stages[activeStage].status === "addressed" && "bg-primary/15 text-primary",
              stages[activeStage].status === "partial" && "bg-amber-400/15 text-amber-600 dark:text-amber-400",
              stages[activeStage].status === "missing" && "bg-destructive/15 text-destructive",
            )}>
              {STATUS_LABELS[stages[activeStage].status]}
            </span>
          </div>
          {stages[activeStage].evidence && (
            <p className="text-sm text-muted-foreground leading-relaxed">{stages[activeStage].evidence}</p>
          )}
        </div>
      )}
    </div>
  );
}

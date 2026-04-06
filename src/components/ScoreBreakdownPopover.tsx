import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ScoreBreakdownPayload } from "@/lib/scoreBreakdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Bar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value * 10));
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
      <div
        className="h-full rounded-full bg-primary/90 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ScoreBreakdownPopover({
  sectionTitle,
  triggerClassName,
  children,
  breakdown,
}: {
  sectionTitle: string;
  triggerClassName?: string;
  children: ReactNode;
  breakdown: ScoreBreakdownPayload;
}) {
  const { rows, overall, explanation, hasSubScores } = breakdown;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-baseline gap-0.5 rounded px-0.5 -mx-0.5 border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-help text-left",
            triggerClassName
          )}
          aria-label={`Score methodology for ${sectionTitle}`}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,20rem)] border-gray-800 bg-gray-950 p-3 text-gray-50 shadow-xl"
        align="start"
        sideOffset={6}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{sectionTitle}</p>
        {hasSubScores ? (
          <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between gap-2 text-[11px] mb-0.5">
                  <span className="text-gray-300">{r.label}</span>
                  <span className="tabular-nums font-bold text-white">{r.value.toFixed(1)}</span>
                </div>
                <Bar value={r.value} />
              </div>
            ))}
            {overall != null && (
              <div className="pt-1 border-t border-gray-800 flex justify-between text-[11px]">
                <span className="font-bold text-gray-200">Overall</span>
                <span className="tabular-nums font-bold text-primary">{overall.toFixed(1)}</span>
              </div>
            )}
            {explanation && <p className="text-[10px] text-gray-400 leading-snug pt-1">{explanation}</p>}
          </div>
        ) : (
          <p className="text-[11px] text-gray-300 leading-relaxed">
            Score based on: clarity of message, visual hierarchy, CTA placement, and competitive benchmark.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

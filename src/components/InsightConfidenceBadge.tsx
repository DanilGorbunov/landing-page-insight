import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InsightConfidence } from "@/lib/insightConfidence";

function tooltipText(level: InsightConfidence): string {
  if (level === "High") {
    return "Confidence is high because this insight is supported by screenshot analysis, copy comparison, and competitor examples.";
  }
  if (level === "Medium") {
    return "Confidence is medium — two of three signals (screenshot, copy depth, competitor comparison) are present.";
  }
  return "Confidence is lower — limited screenshot, copy, or competitor context for this insight.";
}

export function InsightConfidenceBadge({ level, className }: { level: InsightConfidence; className?: string }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide cursor-help",
            level === "High" && "border-primary/50 bg-primary/15 text-primary",
            level === "Medium" && "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200",
            level === "Low" && "border-border bg-muted text-muted-foreground",
            className
          )}
        >
          Confidence: {level}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-snug">
        {tooltipText(level)}
      </TooltipContent>
    </Tooltip>
  );
}

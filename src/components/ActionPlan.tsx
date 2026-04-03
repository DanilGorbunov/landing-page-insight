import { Calendar, Zap } from "lucide-react";
import type { ActionPlanItem } from "@/types/api";
import { cn } from "@/lib/utils";

const IMPACT_STYLE: Record<string, string> = {
  High: "bg-destructive/15 text-destructive",
  Medium: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
};

export function ActionPlan({ items }: { items: ActionPlanItem[] }) {
  if (!items || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.week - b.week || (a.impact === "High" ? -1 : 1));

  return (
    <div className="space-y-3">
      {sorted.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-lg border border-border bg-card/25 px-4 py-3"
        >
          <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground">W{item.week}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", IMPACT_STYLE[item.impact])}>
                {item.impact}
              </span>
              <Zap className="h-3 w-3 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground">{item.action}</p>
            {item.rationale && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.rationale}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

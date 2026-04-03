import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import type { BestPracticeCheck } from "@/types/api";
import { cn } from "@/lib/utils";

const IMPACT_COLORS: Record<string, string> = {
  High: "text-destructive",
  Medium: "text-amber-500 dark:text-amber-400",
  Low: "text-muted-foreground",
};

export function BestPracticesChecklist({ checks }: { checks: BestPracticeCheck[] }) {
  if (!checks || checks.length === 0) return null;

  const passed = checks.filter((c) => c.pass === true).length;
  const total = checks.filter((c) => c.pass !== null).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {passed}/{total} checks passed
        </p>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Pass</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> Fail</span>
          <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3 text-muted-foreground" /> Unknown</span>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 text-sm",
              check.pass === true && "bg-emerald-500/5",
              check.pass === false && "bg-destructive/5"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {check.pass === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {check.pass === false && <XCircle className="h-4 w-4 text-destructive" />}
              {check.pass === null && <HelpCircle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{check.label}</span>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", IMPACT_COLORS[check.impact])}>
                  {check.impact}
                </span>
              </div>
              {check.note && (
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{check.note}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

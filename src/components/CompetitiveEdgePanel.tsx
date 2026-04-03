import type { CompetitiveEdgeEntry } from "@/types/api";

const EFFORT_STYLE: Record<string, string> = {
  "Quick Win": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Medium": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "Strategic": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function CompetitiveEdgePanel({ data }: { data: CompetitiveEdgeEntry[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-4">
      {data.map((entry) => (
        <div key={entry.competitor} className="rounded-lg border border-border bg-card/40 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-xs font-semibold text-foreground">{entry.competitor}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{entry.advantages.length} advantages</span>
          </div>

          <div className="divide-y divide-border">
            {entry.advantages.map((adv, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{adv.element}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${EFFORT_STYLE[adv.effort] || EFFORT_STYLE.Medium}`}>
                    {adv.effort}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <div className="rounded bg-green-50 dark:bg-green-950/20 px-2.5 py-1.5">
                    <p className="text-[9px] font-medium text-green-700 dark:text-green-400 mb-0.5">Their approach</p>
                    <p className="text-[11px] text-green-900 dark:text-green-200">{adv.theirApproach}</p>
                  </div>
                  <div className="rounded bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5">
                    <p className="text-[9px] font-medium text-red-700 dark:text-red-400 mb-0.5">Your weakness</p>
                    <p className="text-[11px] text-red-900 dark:text-red-200">{adv.yourWeakness}</p>
                  </div>
                </div>

                <div className="rounded bg-primary/5 border border-primary/20 px-2.5 py-1.5">
                  <p className="text-[9px] font-medium text-primary mb-0.5">Steal this</p>
                  <p className="text-[11px] text-foreground">{adv.stealThis}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

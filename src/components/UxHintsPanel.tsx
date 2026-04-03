import type { UxImprovementHint } from "@/types/api";
import { useState } from "react";

const IMPACT_STYLE: Record<string, string> = {
  High: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Low: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const IMPACT_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  value_prop: "Value Proposition",
  features: "Features",
  social_proof: "Social Proof",
  cta: "CTA",
};

type FilterImpact = "all" | "High" | "Medium" | "Low";

export function UxHintsPanel({ data }: { data: UxImprovementHint[] }) {
  const [filter, setFilter] = useState<FilterImpact>("all");
  if (!data || data.length === 0) return null;

  const sorted = [...data].sort(
    (a, b) => (IMPACT_ORDER[a.impact] ?? 2) - (IMPACT_ORDER[b.impact] ?? 2)
  );

  const filtered = filter === "all" ? sorted : sorted.filter((h) => h.impact === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["all", "High", "Medium", "Low"] as const).map((f) => {
          const count = f === "all" ? data.length : data.filter((h) => h.impact === f).length;
          return (
            <button
              key={f}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.map((hint, i) => (
          <div key={i} className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium rounded bg-muted/50 px-1.5 py-0.5">
                  {SECTION_LABELS[hint.section] || hint.section}
                </span>
                <span className="text-[10px] text-muted-foreground">{hint.score}/10</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${IMPACT_STYLE[hint.impact] || IMPACT_STYLE.Medium}`}>
                  {hint.impact} impact
                </span>
                <span className="text-[10px] text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
                  ~{hint.effort}
                </span>
              </div>
            </div>

            <p className="text-xs font-medium text-foreground">{hint.issue}</p>

            <div className="rounded bg-primary/5 border border-primary/20 px-2.5 py-2">
              <p className="text-[11px] text-foreground">{hint.hint}</p>
            </div>

            <div className="flex items-start justify-between gap-2 text-[10px] text-muted-foreground">
              <span>{hint.impactReason}</span>
              {hint.reference && (
                <span className="shrink-0 text-primary">ref: {hint.reference}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

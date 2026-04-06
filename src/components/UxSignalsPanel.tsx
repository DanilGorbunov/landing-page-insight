import type { UxSignals } from "@/types/api";

type QualityLevel = "strong" | "good" | "optimized" | "spacious" | "balanced" | "cohesive" | "dominant" | "visible" | "minimal" | "professional" | "moderate" | "mostly_consistent" | "adequate" | "stock" | "needs_improvement" | "weak" | "poor" | "cramped" | "inconsistent" | "buried" | "complex" | "low_quality" | "none";

function qualityColor(value: string | null): string {
  if (!value) return "bg-muted text-muted-foreground";
  const good: QualityLevel[] = ["strong", "good", "optimized", "spacious", "balanced", "cohesive", "dominant", "visible", "minimal", "professional"];
  const mid: QualityLevel[] = ["moderate", "mostly_consistent", "adequate", "stock", "needs_improvement"];
  if (good.includes(value as QualityLevel)) return "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary";
  if (mid.includes(value as QualityLevel)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

const SIGNAL_LABELS: Record<string, string> = {
  visualHierarchy: "Visual Hierarchy",
  contrastQuality: "Contrast Quality",
  whitespaceBalance: "Whitespace Balance",
  navigationComplexity: "Navigation Complexity",
  mobileReadiness: "Mobile Readiness",
  ctaProminence: "CTA Prominence",
  colorConsistency: "Color Consistency",
  imageQuality: "Image Quality",
};

const SIGNAL_KEYS = Object.keys(SIGNAL_LABELS) as Array<keyof typeof SIGNAL_LABELS>;

export function UxSignalsPanel({ data }: { data: UxSignals }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SIGNAL_KEYS.map((key) => {
          const val = data[key as keyof UxSignals] as string | null;
          if (val === undefined) return null;
          return (
            <div key={key} className="rounded-lg border border-border bg-card/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{SIGNAL_LABELS[key]}</p>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${qualityColor(val)}`}>
                {val ? val.replace(/_/g, " ") : "n/a"}
              </span>
            </div>
          );
        })}
      </div>

      {data.aboveFoldContent?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Above-fold content</p>
          <div className="flex flex-wrap gap-1.5">
            {data.aboveFoldContent.map((item, i) => (
              <span key={i} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.loadingUxHints?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Loading UX observations</p>
          <ul className="space-y-1">
            {data.loadingUxHints.map((hint, i) => (
              <li key={i} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5 text-primary">•</span>
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.accessibilityFlags?.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1.5">Accessibility flags</p>
          <div className="space-y-1">
            {data.accessibilityFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 rounded bg-red-50 dark:bg-red-950/20 px-2 py-1.5">
                <span className="shrink-0 text-red-500 text-xs">⚠</span>
                <span className="text-[11px] text-red-800 dark:text-red-300">{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

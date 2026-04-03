import { Lightbulb } from "lucide-react";
import type { CopySuggestion } from "@/types/api";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  value_prop: "Value Proposition",
  features: "Features",
  social_proof: "Social Proof",
  cta: "CTA",
};

export function CopySuggestions({ suggestions }: { suggestions: CopySuggestion[] }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="space-y-4">
      {suggestions.map((s, i) => (
        <div key={i} className="rounded-lg border border-border bg-card/25 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {SECTION_LABELS[s.section] || s.section}
          </p>

          {s.current && (
            <div className="mb-3 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Current</p>
              <p className="text-sm text-foreground italic">"{s.current}"</p>
            </div>
          )}

          <div className="space-y-2">
            {s.suggestions.map((text, j) => (
              <div key={j} className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <p className="text-sm text-foreground">"{text}"</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

import { Check, X } from "lucide-react";
import type { DesignPattern } from "@/types/api";
import { cn } from "@/lib/utils";

export function DesignPatterns({ patterns }: { patterns: DesignPattern[] }) {
  if (!patterns || patterns.length === 0) return null;

  const present = patterns.filter((p) => p.present).length;
  const total = patterns.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {present}/{total} patterns detected
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {patterns.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3",
              p.present
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-card/25"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {p.present ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground/50" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", p.present ? "text-foreground" : "text-muted-foreground")}>
                {p.label}
              </p>
              {p.note && (
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{p.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { ReadabilityData } from "@/types/api";
import { cn, getDomain } from "@/lib/utils";

function gradeColor(grade: number | null): string {
  if (grade === null) return "text-muted-foreground";
  if (grade <= 7) return "text-primary";
  if (grade <= 10) return "text-amber-500 dark:text-amber-400";
  return "text-destructive";
}

function easeLabel(ease: number | null): string {
  if (ease === null) return "—";
  if (ease >= 80) return "Very Easy";
  if (ease >= 60) return "Standard";
  if (ease >= 40) return "Difficult";
  return "Very Difficult";
}

export function ReadabilityPanel({ data }: { data: ReadabilityData }) {
  if (!data?.user) return null;

  const sites = [
    { label: getDomain(data.user.url), isUser: true, ...data.user },
    ...data.competitors.map((c) => ({ label: getDomain(c.url), isUser: false, ...c })),
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Pages at 5th–7th grade level convert at ~12.9% vs 2.1% for complex copy.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sites.map((site) => (
          <div
            key={site.url}
            className={cn(
              "rounded-lg border bg-card/25 p-4",
              site.isUser ? "border-primary/40" : "border-border"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("text-sm font-semibold", site.isUser ? "text-primary" : "text-foreground")}>
                {site.label}
              </span>
              {site.isUser && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">You</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={cn("text-2xl font-bold tabular-nums", gradeColor(site.gradeLevel))}>
                  {site.gradeLevel !== null ? site.gradeLevel : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Grade Level</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {site.readingEase !== null ? site.readingEase : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Flesch Ease ({easeLabel(site.readingEase)})</p>
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{site.wordCount}</p>
                <p className="text-[10px] text-muted-foreground">Words</p>
              </div>
              <div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{site.avgSentenceLength}</p>
                <p className="text-[10px] text-muted-foreground">Avg words/sentence</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

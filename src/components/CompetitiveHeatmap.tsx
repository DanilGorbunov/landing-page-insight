import type { AnalysisResult } from "@/types/api";
import { cn } from "@/lib/utils";

const SECTION_KEYS = ["hero", "value proposition", "features", "social proof", "CTA"] as const;

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  "value proposition": "Value Prop",
  features: "Features",
  "social proof": "Social Proof",
  CTA: "CTA",
};

function parseScore(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  return m ? parseFloat(m[1]) : null;
}

function scoreColor(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-primary/20 text-primary";
  if (score >= 6) return "bg-amber-400/20 text-amber-600 dark:text-amber-400";
  if (score >= 4) return "bg-orange-400/20 text-orange-600 dark:text-orange-400";
  return "bg-destructive/20 text-destructive";
}

function getDomain(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

interface Props {
  userUrl: string;
  result: AnalysisResult;
}

export function CompetitiveHeatmap({ userUrl, result }: Props) {
  const sites: { label: string; isUser: boolean; analysis: Record<string, string> | undefined }[] = [
    { label: getDomain(userUrl), isUser: true, analysis: result.userAnalysis },
    ...(result.competitors ?? []).slice(0, 3).map((c) => ({
      label: getDomain(c.url),
      isUser: false,
      analysis: c.analysis,
    })),
  ];

  if (sites.length < 2) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-3 min-w-[100px]">Section</th>
            {sites.map((site) => (
              <th
                key={site.label}
                className={cn(
                  "text-center text-xs font-medium py-2 px-3 min-w-[80px]",
                  site.isUser ? "text-primary" : "text-muted-foreground"
                )}
              >
                {site.label}
                {site.isUser && <span className="block text-[9px] text-primary/60">(You)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECTION_KEYS.map((key) => (
            <tr key={key} className="border-t border-border">
              <td className="py-2 pr-3 text-xs font-medium text-foreground">{SECTION_LABELS[key]}</td>
              {sites.map((site) => {
                const score = parseScore(site.analysis?.[key]);
                return (
                  <td key={site.label} className="py-2 px-3 text-center">
                    <span className={cn("inline-block rounded-md px-2 py-1 text-xs font-bold tabular-nums min-w-[40px]", scoreColor(score))}>
                      {score !== null ? score.toFixed(1) : "—"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Performance row if available */}
          {result.performance?.user?.scores?.performance != null && (
            <tr className="border-t border-border">
              <td className="py-2 pr-3 text-xs font-medium text-foreground">Performance</td>
              {sites.map((site) => {
                const perfSite = site.isUser
                  ? result.performance?.user
                  : result.performance?.competitors?.find((c) => getDomain(c.url) === site.label);
                const score = perfSite?.scores?.performance ?? null;
                const mapped = score !== null ? score / 10 : null;
                return (
                  <td key={site.label} className="py-2 px-3 text-center">
                    <span className={cn("inline-block rounded-md px-2 py-1 text-xs font-bold tabular-nums min-w-[40px]", scoreColor(mapped))}>
                      {score !== null ? score : "—"}
                    </span>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import { Sparkles, ClipboardCopy, Loader2 } from "lucide-react";
import { cn, getDomain } from "@/lib/utils";
import { generateCopyAlternatives, type GenerateCopyVariant } from "@/lib/api";
import type { AnalysisResult } from "@/types/api";
import type { SectionOrderKey } from "@/lib/compareDecisionMetrics";
import { Skeleton } from "@/components/ui/skeleton";

export function CopyGeneratorBlock({
  result,
  sectionKey,
  issue,
  currentCopy: currentCopyOverride,
}: {
  result: AnalysisResult;
  sectionKey: SectionOrderKey;
  issue: string;
  /** Optional override when the recommendation targets a snippet, not the whole section. */
  currentCopy?: string;
}) {
  const currentCopy = currentCopyOverride ?? result.userAnalysis?.[sectionKey] ?? "";

  const { competitorExamples, competitorLabels } = useMemo(() => {
    const examples: string[] = [];
    const labels: string[] = [];
    for (const c of result.competitors ?? []) {
      const t = c.analysis?.[sectionKey];
      if (t && t.trim()) {
        examples.push(t.slice(0, 1200));
        labels.push(getDomain(c.url));
      }
    }
    return { competitorExamples: examples.slice(0, 4), competitorLabels: labels.slice(0, 4) };
  }, [result, sectionKey]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<GenerateCopyVariant[] | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await generateCopyAlternatives({
        section: sectionKey,
        currentCopy,
        competitorExamples,
        issue,
      });
      setVariants(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setVariants(null);
    } finally {
      setLoading(false);
    }
  }, [sectionKey, currentCopy, competitorExamples, issue]);

  const copyVariant = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const attribution =
    competitorLabels.length >= 2
      ? `${competitorLabels[0]} and ${competitorLabels[1]}`
      : competitorLabels.length === 1
        ? competitorLabels[0]
        : "competitors";

  return (
    <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
        )}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        Generate better version
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg bg-muted" />
          <Skeleton className="h-16 w-full rounded-lg bg-muted" />
          <Skeleton className="h-16 w-full rounded-lg bg-muted" />
        </div>
      )}
      {variants != null && variants.length > 0 && !loading && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Based on what works for <span className="font-semibold text-foreground">{attribution}</span>
          </p>
          {variants.map((v, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card/60 p-2.5 space-y-1.5"
            >
              <p className="text-[11px] text-foreground leading-snug">{v.variant}</p>
              {v.reasoning ? (
                <p className="text-[10px] text-muted-foreground leading-snug">{v.reasoning}</p>
              ) : null}
              <button
                type="button"
                onClick={() => copyVariant(v.variant)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold hover:bg-muted"
              >
                <ClipboardCopy className="h-3 w-3" />
                Copy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

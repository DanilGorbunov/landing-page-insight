import { Link } from "react-router-dom";
import { Brain, Eye, Lightbulb, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionComparison, HeatmapAnalysis } from "@/types/attention";

function clampPct(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function EyePathFlow({ label, path, warnCtaNotTop }: { label: string; path: string[]; warnCtaNotTop?: boolean }) {
  const safe = Array.isArray(path) ? path.filter(Boolean) : [];
  const top3 = safe.slice(0, 4);
  const ctaInTop3 = top3.some((s) => /cta|button|call to action/i.test(s));
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-[11px] text-foreground leading-snug flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {top3.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          top3.map((el, i) => (
            <span key={`${el}-${i}`} className="inline-flex items-center gap-1">
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary tabular-nums">
                {i + 1}
              </span>
              <span>{el}</span>
              {i < top3.length - 1 ? <span className="text-muted-foreground">→</span> : null}
            </span>
          ))
        )}
      </p>
      {warnCtaNotTop && !ctaInTop3 && (
        <p className="mt-1.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
          CTA may not be in the first stops on the eye path — risk of lower click-through.
        </p>
      )}
    </div>
  );
}

export function AttentionAnalysisPanel({
  loading,
  error,
  your,
  competitor,
  comparison,
  competitorName,
  showUpgradePrompt,
  onDismissUpgrade,
}: {
  loading: boolean;
  error: boolean;
  your: HeatmapAnalysis | null;
  competitor: HeatmapAnalysis | null;
  comparison: AttentionComparison | null;
  competitorName: string;
  showUpgradePrompt: boolean;
  onDismissUpgrade: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary shrink-0 animate-pulse" />
          <div>
            <p className="text-[11px] font-bold text-foreground">Attention Analysis</p>
            <p className="text-[10px] text-muted-foreground">AI-predicted · visual saliency</p>
          </div>
        </div>
        <ul className="text-[10px] text-muted-foreground space-y-1">
          <li className="flex items-center gap-2">
            <span className="text-primary">✓</span> Screenshots ready
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Claude Vision analyzing visual hierarchy
          </li>
          <li className="flex items-center gap-2 opacity-50">
            <span className="inline-block h-2 w-2 rounded-full border border-border" />
            Comparing attention patterns
          </li>
        </ul>
      </div>
    );
  }

  if (error || !your || !competitor || !comparison) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-foreground">
        <p className="font-semibold flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          Attention analysis unavailable for this screenshot
        </p>
        <p className="text-muted-foreground mt-1 leading-snug">
          Try again later or check that screenshot URLs are reachable. Your compare view still works without the overlay.
        </p>
      </div>
    );
  }

  const yClarity = your.clarityScore ?? null;
  const cClarity = competitor.clarityScore ?? null;
  const yAtt = your.attentionScore ?? null;
  const cAtt = competitor.attentionScore ?? null;

  const clarityDelta =
    yClarity != null && cClarity != null ? Math.round((yClarity - cClarity) * 10) / 10 : null;
  const attDelta = yAtt != null && cAtt != null ? Math.round((yAtt - cAtt) * 10) / 10 : null;

  const ctaYou = clampPct(comparison.ctaAttentionYou ?? your.ctaZone?.attentionPercent ?? null);
  const ctaComp = clampPct(comparison.ctaAttentionCompetitor ?? competitor.ctaZone?.attentionPercent ?? null);
  const mult = comparison.ctaMultiplier ?? (ctaYou > 0 ? ctaComp / ctaYou : null);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Eye className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-foreground">Attention Analysis</p>
            <p className="text-[10px] text-muted-foreground leading-snug">AI-predicted · based on visual saliency principles</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-3 gap-px bg-border text-[9px] font-bold uppercase tracking-wide">
          <div className="bg-muted/50 px-2 py-1.5 text-muted-foreground" />
          <div className="bg-muted/50 px-2 py-1.5 text-center text-foreground">Your site</div>
          <div className="bg-muted/50 px-2 py-1.5 text-center text-foreground truncate">{competitorName}</div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border text-[11px]">
          <div className="bg-card px-2 py-2 text-muted-foreground font-medium">Clarity</div>
          <div className={cn("bg-card px-2 py-2 text-center tabular-nums", clarityDelta != null && clarityDelta >= 0 ? "text-primary" : "text-red-600 dark:text-red-400")}>
            {yClarity != null ? `${Math.round(yClarity)}/100` : "—"}
          </div>
          <div className="bg-card px-2 py-2 text-center tabular-nums text-foreground">
            {cClarity != null ? `${Math.round(cClarity)}/100` : "—"}
            {clarityDelta != null && (
              <span className={cn("ml-1 text-[10px]", clarityDelta >= 0 ? "text-primary" : "text-red-500")}>
                {clarityDelta >= 0 ? "↑" : "↓"}
                {Math.abs(clarityDelta)}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border text-[11px]">
          <div className="bg-card px-2 py-2 text-muted-foreground font-medium">Attention</div>
          <div className={cn("bg-card px-2 py-2 text-center tabular-nums", attDelta != null && attDelta >= 0 ? "text-primary" : "text-red-600 dark:text-red-400")}>
            {yAtt != null ? `${Math.round(yAtt)}/100` : "—"}
          </div>
          <div className="bg-card px-2 py-2 text-center tabular-nums">
            {cAtt != null ? `${Math.round(cAtt)}/100` : "—"}
            {attDelta != null && (
              <span className={cn("ml-1 text-[10px]", attDelta >= 0 ? "text-primary" : "text-red-500")}>
                {attDelta >= 0 ? "↑" : "↓"}
                {Math.abs(attDelta)}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground -mt-1">Green = you&apos;re ahead on that row; red = behind (vs competitor).</p>

      <div className="space-y-2">
        <EyePathFlow label="Your eye path" path={comparison.eyePath?.length ? comparison.eyePath : your.eyePath ?? []} warnCtaNotTop />
        <EyePathFlow label={`${competitorName} eye path`} path={comparison.competitorEyePath?.length ? comparison.competitorEyePath : competitor.eyePath ?? []} />
      </div>

      <div className="rounded-lg border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2.5 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 flex items-center gap-1">
          <Target className="h-3.5 w-3.5" />
          CTA attention gap
        </p>
        <div className="space-y-1.5">
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>Your CTA</span>
              <span className="tabular-nums font-semibold text-foreground">{ctaYou.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${ctaYou}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>{competitorName} CTA</span>
              <span className="tabular-nums font-semibold text-foreground">{ctaComp.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-amber-500/90 transition-all" style={{ width: `${ctaComp}%` }} />
            </div>
          </div>
        </div>
        {mult != null && Number.isFinite(mult) && (
          <p className="text-[11px] text-foreground">
            Competitor gets <span className="font-bold tabular-nums">{mult >= 10 ? mult.toFixed(1) : mult.toFixed(2)}×</span> relative CTA attention score in this model
            {comparison.summary ? ` — ${comparison.summary}` : ""}
          </p>
        )}
      </div>

      <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2 text-[11px] text-foreground leading-snug">
        <p className="font-bold flex items-center gap-1 text-amber-900 dark:text-amber-100 mb-1">
          <Lightbulb className="h-3.5 w-3.5 shrink-0" />
          Key finding
        </p>
        <p>{comparison.keyInsight || "—"}</p>
      </div>

      <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/35 px-3 py-2 text-[11px] leading-snug">
        <p className="font-bold text-emerald-900 dark:text-emerald-100 mb-1 flex items-center gap-1">
          <Target className="h-3.5 w-3.5 shrink-0" />
          Fix this
        </p>
        <p className="text-foreground">{comparison.recommendation || "—"}</p>
        <p className="text-[9px] text-muted-foreground mt-1.5 italic">
          Expected impact varies by page; not a guarantee. Validate with real users and A/B tests.
        </p>
      </div>

      <p className="text-[9px] text-muted-foreground leading-relaxed border-t border-border pt-2">
        AI-predicted attention based on visual saliency principles. Correlation with eye-tracking studies is approximate; does not replace testing with real users.
      </p>

      {showUpgradePrompt && (
        <div className="relative rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDismissUpgrade}
            className="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="text-[10px] text-foreground pr-6 leading-snug min-w-[200px] flex-1">
            Want to track attention changes weekly as competitors update their pages?
          </p>
          <Link
            to="/pricing"
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground hover:opacity-90"
          >
            Upgrade to Pro →
          </Link>
        </div>
      )}
    </div>
  );
}

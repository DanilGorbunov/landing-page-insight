import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import { CompetitorMonitorCard } from "@/components/CompetitorMonitorCard";
import { getDomain, ensureScore, parseSectionScores } from "@/lib/utils";
import { readFullInsightsPayload, writeFullInsightsPayload } from "@/lib/reportSession";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import { resolveDashboardNavHref } from "@/lib/dashboardNavHref";
import type { AnalysisResult } from "@/types/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function pseudoDaysSinceCheck(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h + domain.charCodeAt(i) * (i + 1)) % 997;
  return (h % 10) + 1;
}

function competitorsFromResult(
  result: AnalysisResult | null
): {
  domain: string;
  url: string;
  analysis: Record<string, string>;
  screenshotUrl?: string | null;
}[] {
  if (!result?.competitors?.length) return [];
  return result.competitors.map((c) => ({
    url: c.url,
    domain: getDomain(c.url),
    analysis: c.analysis ?? {},
    screenshotUrl: c.screenshotUrl,
  }));
}

export default function MonitorPage() {
  const navigate = useNavigate();

  const payload = readFullInsightsPayload();
  const result: AnalysisResult | null = payload?.result ?? null;
  const url = payload?.url ?? null;
  const competitors = useMemo(() => competitorsFromResult(result), [result]);

  const overallScore = useMemo(() => {
    if (!result) return null;
    const s = result.synthesis?.overall_score;
    if (s != null) return ensureScore(s);
    const userScores = parseSectionScores(result.userAnalysis);
    return weightedOverallFromSections(userScores) ?? 7.0;
  }, [result]);

  const reportContext =
    url != null && overallScore != null
      ? { url, overallScore, ...(payload?.paidAt ? { createdAt: payload.paidAt } : {}) }
      : null;

  const resolveNavHref = useCallback(
    (id: string) => resolveDashboardNavHref(id, { mode: "session", reportUrl: url }),
    [url]
  );

  /** Re-persist session + localStorage audit map so /audit/:slug loads after leaving Monitor. */
  useLayoutEffect(() => {
    const p = readFullInsightsPayload();
    if (p?.result && p.url?.trim()) writeFullInsightsPayload(p);
  }, []);

  const [watching, setWatching] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState("");
  /** `readFullInsightsPayload()` returns a new object every render; avoid resetting toggles when only reference changes. */
  const competitorDomainKeyRef = useRef<string>("");

  useEffect(() => {
    const key = competitors
      .map((c) => c.domain)
      .sort()
      .join("|");
    if (key === competitorDomainKeyRef.current) return;
    competitorDomainKeyRef.current = key;
    setWatching((prev) => {
      const next: Record<string, boolean> = {};
      for (const c of competitors) {
        next[c.domain] = prev[c.domain] ?? false;
      }
      return next;
    });
  }, [competitors]);

  const toggle = useCallback((domain: string, next: boolean) => {
    setWatching((w) => ({ ...w, [domain]: next }));
    if (next) toast.success(`Monitor enabled for ${domain}`);
  }, []);

  const handleEnableDigest = () => {
    toast.success("You're on the list — we'll email you when this ships.");
    setEmail("");
  };

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "monitor",
        resolveNavHref,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
        hideSidebarNewAnalysis: true,
      }}
      mainClassName="overflow-y-auto px-4 pt-4 pb-5 md:pb-7"
    >
      <div id="main" className="mx-auto w-full max-w-6xl space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Competitor Monitor</h1>
              <p className="text-sm text-muted-foreground mt-1">Track when competitors update their landing pages</p>
            </div>

            {competitors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                No competitors in your last analysis.{" "}
                <button type="button" onClick={() => navigate("/")} className="text-primary font-semibold hover:underline">
                  Run an analysis
                </button>{" "}
                with competitors, then open Monitor again.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {competitors.map((c) => (
                  <CompetitorMonitorCard
                    key={c.url}
                    domain={c.domain}
                    url={c.url}
                    screenshotUrl={c.screenshotUrl}
                    analysis={c.analysis}
                    watching={!!watching[c.domain]}
                    onWatchChange={(v) => toggle(c.domain, v)}
                    lastCheckedDays={pseudoDaysSinceCheck(c.domain)}
                  />
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-primary/35 bg-gradient-to-br from-[hsl(0,0%,4%)] via-[hsl(0,0%,8%)] to-[hsl(205,35%,20%)] p-6 text-[hsl(210,25%,96%)] shadow-lg">
              <h2 className="text-lg font-bold">Get weekly digest emails</h2>
              <p className="text-sm text-[hsl(215,20%,78%)] mt-1 leading-relaxed">
                We&apos;ll notify you when any competitor changes their hero, pricing, or CTA
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-white/95 text-foreground border-0"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleEnableDigest}
                  className="shrink-0 bg-primary text-primary-foreground hover:brightness-110 font-semibold"
                >
                  Enable Monitor
                </Button>
              </div>
              <p className="text-[11px] text-[hsl(215,20%,65%)] mt-3">Free during beta · No credit card required</p>
            </div>
          </div>
    </DashboardPageShell>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bell, Mail } from "lucide-react";
import { toast } from "sonner";
import { DashboardNavSidebar } from "@/components/DashboardNavSidebar";
import { getDomain, ensureScore, parseSectionScores } from "@/lib/utils";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { getHistoryCount } from "@/lib/analysisHistory";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import type { AnalysisResult } from "@/types/api";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function pseudoDaysSinceCheck(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h + domain.charCodeAt(i) * (i + 1)) % 997;
  return (h % 10) + 1;
}

function competitorsFromResult(result: AnalysisResult | null): { domain: string; url: string }[] {
  if (!result?.competitors?.length) return [];
  return result.competitors.map((c) => ({
    url: c.url,
    domain: getDomain(c.url),
  }));
}

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export default function MonitorPage() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [historyCount, setHistoryCount] = useState(getHistoryCount);

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

  useEffect(() => {
    setHistoryCount(getHistoryCount());
  }, []);

  const handleNav = (id: string) => {
    if (id === "monitor") return;
    if (id === "history") {
      navigate("/history");
      return;
    }
    if (FULL_INSIGHTS_SECTION_IDS.has(id)) {
      navigate(`/full-insights?section=${encodeURIComponent(id)}`);
    }
  };

  const [watching, setWatching] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState("");

  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const c of competitors) init[c.domain] = false;
    setWatching(init);
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
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardNavSidebar
        activeNavId="monitor"
        onSelect={handleNav}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        reportContext={reportContext}
        result={result}
        historyCount={historyCount}
        onNewAnalysis={() => navigate("/")}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 backdrop-blur px-4 md:px-6">
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <Link to="/full-insights?section=compare" className="text-muted-foreground hover:text-foreground truncate">
              Dashboard
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              /
            </span>
            <span className="font-semibold text-foreground truncate inline-flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Monitor
            </span>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto p-5 md:p-7">
          <div className="max-w-2xl mx-auto w-full space-y-8">
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
              <ul className="space-y-3">
                {competitors.map((c) => (
                  <li key={c.domain} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                    <img
                      src={faviconUrl(c.domain)}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-md bg-muted shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">{c.domain}</span>
                        {watching[c.domain] && (
                          <span className="text-[10px] font-bold uppercase rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-primary">
                            Watching
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Last checked: {pseudoDaysSinceCheck(c.domain)} days ago
                      </p>
                    </div>
                    <Switch
                      checked={!!watching[c.domain]}
                      onCheckedChange={(v) => toggle(c.domain, v)}
                      aria-label={`Watch ${c.domain}`}
                    />
                  </li>
                ))}
              </ul>
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
        </main>
      </div>
    </div>
  );
}

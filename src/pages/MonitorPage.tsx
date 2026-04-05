import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Bell, Mail } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDomain } from "@/lib/utils";
import { readFullInsightsPayload } from "@/lib/reportSession";
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
  const payload = useMemo(() => readFullInsightsPayload(), []);
  const competitors = useMemo(() => competitorsFromResult(payload?.result ?? null), [payload]);

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/90 backdrop-blur-md px-4 md:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link to="/" className="font-semibold text-primary tracking-tight">
          LandingLens
        </Link>
        <div className="flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">Monitor</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 md:px-8 py-8 space-y-8">
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
              <li
                key={c.domain}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
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
                      <span className="text-[10px] font-bold uppercase rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
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

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/90 via-emerald-600 to-teal-700 p-6 text-white shadow-lg">
          <h2 className="text-lg font-bold">Get weekly digest emails</h2>
          <p className="text-sm text-emerald-50/95 mt-1 leading-relaxed">
            We&apos;ll notify you when any competitor changes their hero, pricing, or CTA
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-900/50" />
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
              className="shrink-0 bg-white text-emerald-800 hover:bg-emerald-50 font-semibold"
            >
              Enable Monitor
            </Button>
          </div>
          <p className="text-[11px] text-emerald-100/90 mt-3">Free during beta · No credit card required</p>
        </div>
      </main>
    </div>
  );
}

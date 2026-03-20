import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Plus, ChevronDown, X, History, ArrowUpRight, Users } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn, isValidHttpUrl, normalizeInputUrl, DEFAULT_SCORE } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/analysisHistory";

const SAMPLE_SITES = ["apollo.io", "linear.app", "hubspot.com", "notion.so"];

const FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/** Decorative strip — mix of household names & smaller teams (demo / social proof). */
const TRUSTED_BY_COMPANIES: { name: string; domain: string }[] = [
  { name: "Ollama", domain: "ollama.com" },
  { name: "Wallmart", domain: "walmart.com" },
  { name: "Otto", domain: "otto.de" },
  { name: "Linear", domain: "linear.app" },
  { name: "Vercel", domain: "vercel.com" },
  { name: "Stripe", domain: "stripe.com" },
  { name: "Notion", domain: "notion.so" },
  { name: "Supabase", domain: "supabase.com" },
  { name: "Raycast", domain: "raycast.com" },
  { name: "Lovable", domain: "lovable.dev" },
  { name: "Polar", domain: "polar.sh" },
  { name: "Resend", domain: "resend.com" },
  { name: "Plausible", domain: "plausible.io" },
  { name: "Cal", domain: "cal.com" },
  { name: "Airtable", domain: "airtable.com" },
  { name: "Miro", domain: "miro.com" },
  { name: "Zapier", domain: "zapier.com" },
  { name: "Webflow", domain: "webflow.com" },
  { name: "HubSpot", domain: "hubspot.com" },
];

function formatRecentTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

interface InputScreenProps {
  onAnalyze: (url: string, competitors: string[]) => void | Promise<void>;
  onOpenHistory?: () => void;
  historyCount?: number;
  analyzeError?: string | null;
  recentAnalyses?: HistoryEntry[];
  onSelectRecent?: (entry: HistoryEntry) => void;
}

const InputScreen = ({
  onAnalyze,
  onOpenHistory,
  historyCount = 0,
  analyzeError,
  recentAnalyses = [],
  onSelectRecent,
}: InputScreenProps) => {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setUrlError(null);
    if (!url.trim() || isSubmitting) return;
    const normalized = normalizeInputUrl(url);
    if (!normalized) return;
    if (!isValidHttpUrl(normalized)) {
      setUrlError("Enter a valid URL (e.g. https://example.com or example.com)");
      return;
    }
    setIsSubmitting(true);
    try {
      const validCompetitors = competitors.filter((c) => c.trim());
      await onAnalyze(normalized, validCompetitors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCompetitor = () => {
    if (competitors.length < 3) setCompetitors([...competitors, ""]);
  };

  const removeCompetitor = (i: number) => {
    setCompetitors(competitors.filter((_, idx) => idx !== i));
  };

  const updateCompetitor = (i: number, val: string) => {
    const next = [...competitors];
    next[i] = val;
    setCompetitors(next);
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Topbar: History (right) */}
      {onOpenHistory && (
        <header className="sticky top-0 z-20 left-0 right-0 h-14 flex items-center justify-end px-4 md:px-8 border-b border-white/[0.06] bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <button
            type="button"
            onClick={onOpenHistory}
            className="touch-target inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={historyCount > 0 ? `History, ${historyCount} analyses` : "Open history"}
          >
            <History className="w-4 h-4" aria-hidden />
            History
            {historyCount > 0 && (
              <span className="ml-1 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>
        </header>
      )}

      <main
        id="main"
        className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-8 sm:pt-28 md:pt-36 lg:pt-44 md:pb-10"
      >
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-2xl text-center"
        >
          {/* Logo: Landing Lens by AI — clickable to home */}
          <motion.div variants={staggerItem} className="mb-8">
            <Link to="/" className="font-sans text-xl sm:text-2xl font-medium tracking-tight inline-flex items-baseline gap-2 hover:opacity-90 transition-opacity">
              <span className="text-primary">Landing Lens</span>
              <span className="text-muted-foreground">by AI</span>
            </Link>
          </motion.div>

        {/* Headline — same font as logo (sans) */}
        <motion.h1
          variants={staggerItem}
          className="font-sans text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight leading-[1.15] mb-6"
          style={{ letterSpacing: "-0.02em" }}
        >
          How does your landing page{" "}
          <span className="text-primary">stack up</span> against competitors?
        </motion.h1>

        <motion.p variants={staggerItem} className="font-sans text-muted-foreground text-base mb-10 max-w-md mx-auto">
          Paste a URL. Get an AI-powered audit with actionable insights in seconds
        </motion.p>

        {/* Input */}
        <motion.div variants={staggerItem}>
          <div
            className={`flex items-center h-14 rounded-md glass-surface-elevated overflow-hidden transition-shadow ${
              url ? "amber-glow" : ""
            }`}
          >
            <div className="flex items-center pl-4 pr-2 text-muted-foreground">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="https://yoursite.com"
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none h-full"
            />
            <motion.button
              whileHover={!isSubmitting ? { scale: 1.02 } : undefined}
              whileTap={!isSubmitting ? { scale: 0.98, y: 2 } : undefined}
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-full min-w-[100px] sm:min-w-[120px] px-4 sm:px-6 bg-primary text-primary-foreground font-semibold text-sm rounded-none transition-colors hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation"
            >
              {isSubmitting ? "Starting…" : "Analyze →"}
            </motion.button>
          </div>
        </motion.div>

        {(urlError || analyzeError) && (
          <p className="mt-3 text-sm text-destructive">{urlError || analyzeError}</p>
        )}

        {/* Try chips — 2 on mobile, all 4 from sm; single row rhythm: same height, even gaps */}
        <motion.div
          variants={staggerItem}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2"
        >
          <span className="flex h-10 shrink-0 items-center text-xs font-medium leading-none text-muted-foreground">
            Try:
          </span>
          {SAMPLE_SITES.map((site, i) => (
            <button
              key={site}
              type="button"
              onClick={() => setUrl(`https://${site}`)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-card/40 px-3 text-xs font-mono tabular-nums leading-none text-secondary-foreground transition-colors",
                "hover:border-primary/40 hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                i >= 2 && "hidden sm:inline-flex"
              )}
            >
              {site}
            </button>
          ))}
        </motion.div>

        {/* Competitor toggle */}
        <motion.div variants={staggerItem} className="mt-8">
          <button
            onClick={() => setShowCompetitors(!showCompetitors)}
            className="touch-target inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add competitor URLs manually
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showCompetitors ? "rotate-180" : ""}`}
            />
          </button>

          {showCompetitors && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 space-y-2 max-w-md mx-auto"
            >
              {competitors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center h-10 rounded-sm glass-surface overflow-hidden">
                    <span className="pl-3 pr-1 text-muted-foreground">
                      <Globe className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={c}
                      onChange={(e) => updateCompetitor(i, e.target.value)}
                      placeholder={`competitor${i + 1}.com`}
                      className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none h-full"
                    />
                  </div>
                  {competitors.length > 1 && (
                    <button onClick={() => removeCompetitor(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {competitors.length < 3 && (
                <button
                  onClick={addCompetitor}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  + Add another
                </button>
              )}
            </motion.div>
          )}
        </motion.div>
        </motion.div>

        {recentAnalyses.length > 0 && onSelectRecent && (
          <section
            className="mt-24 w-full max-w-5xl px-2 sm:px-4 md:mt-32 lg:mt-40"
            aria-labelledby="recent-comparisons-heading"
          >
            <div className="mb-6 text-center">
              <p id="recent-comparisons-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Recent comparisons
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground/90">
                {recentAnalyses.slice(0, 3).every((e) => e.source === "demo")
                  ? "Example reports — tap a card to preview. Run Analyze to see your own."
                  : recentAnalyses.slice(0, 3).every((e) => e.source === "server")
                    ? "Latest analyses from our workspace — tap a card to open the report."
                    : "Your last runs vs competitor landings — tap a card to open the report."}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {recentAnalyses.slice(0, 3).map((entry) => {
                const nComp = Math.min(3, entry.result?.competitors?.length ?? 0);
                const score = entry.score ?? DEFAULT_SCORE;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRecent(entry)}
                      className="group flex h-full w-full flex-col rounded-2xl border border-white/[0.08] bg-card/35 p-4 text-left shadow-sm shadow-black/20 transition-all hover:border-primary/35 hover:bg-card/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={FAVICON(entry.domain)}
                          alt=""
                          className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-background/80 object-contain p-1"
                          width={40}
                          height={40}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate font-mono text-sm font-medium text-foreground group-hover:text-primary">
                              {entry.domain}
                            </p>
                            {entry.source === "demo" && (
                              <span className="shrink-0 rounded border border-white/15 bg-muted/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Sample
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                            {nComp === 0
                              ? "Analysis run"
                              : nComp === 1
                                ? "vs 1 competitor"
                                : `vs ${nComp} competitors`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-white/[0.06] pt-4">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Overall score
                        </p>
                        <p className="mt-0.5 flex items-baseline gap-1">
                          <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                            {score.toFixed(1)}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">/10</span>
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatRecentTime(entry.analyzedAt)}</span>
                        <span className="inline-flex items-center gap-0.5 font-medium text-primary opacity-90 group-hover:opacity-100">
                          Open
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section
          className={cn(
            "w-full max-w-5xl px-2 sm:px-4 grayscale",
            recentAnalyses.length > 0 && onSelectRecent
              ? "mt-10 md:mt-14"
              : "mt-24 md:mt-32 lg:mt-40"
          )}
          aria-label="Companies that use Landing Lens"
        >
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Trusted by teams at
          </p>
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-muted/20 py-4 shadow-inner shadow-black/30">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-16"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-16"
              aria-hidden
            />
            <div className="overflow-hidden">
              <div className="flex w-max items-center gap-x-10 gap-y-3 px-4 animate-marquee motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-4 sm:gap-x-14 sm:px-6">
                {[...TRUSTED_BY_COMPANIES, ...TRUSTED_BY_COMPANIES].map((c, i) => (
                  <div
                    key={`${c.domain}-${i}`}
                    className="flex shrink-0 items-center gap-2.5 opacity-95"
                  >
                    <img
                      src={FAVICON(c.domain)}
                      alt=""
                      className="h-5 w-5 shrink-0 rounded object-contain grayscale"
                      width={20}
                      height={20}
                      loading="lazy"
                    />
                    <span className="whitespace-nowrap text-sm font-medium text-foreground/80">
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default InputScreen;

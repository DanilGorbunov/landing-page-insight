import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Plus, ChevronDown, X, History } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/motion";

const SAMPLE_SITES = ["apollo.io", "linear.app", "hubspot.com", "notion.so"];

interface InputScreenProps {
  onAnalyze: (url: string, competitors: string[]) => void | Promise<void>;
  onOpenHistory?: () => void;
  historyCount?: number;
  analyzeError?: string | null;
}

const InputScreen = ({ onAnalyze, onOpenHistory, historyCount = 0, analyzeError }: InputScreenProps) => {
  const [url, setUrl] = useState("");
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const validCompetitors = competitors.filter((c) => c.trim());
      await onAnalyze(url.trim(), validCompetitors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCompetitor = () => {
    if (competitors.length < 4) setCompetitors([...competitors, ""]);
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
        <header className="sticky top-0 z-20 left-0 right-0 h-14 flex items-center justify-end px-4 md:px-8 border-b border-transparent bg-background/80 backdrop-blur-sm">
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <History className="w-4 h-4" />
            History
            {historyCount > 0 && (
              <span className="ml-1 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>
        </header>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-14">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="w-full max-w-2xl text-center"
        >
          {/* Logo: Landing Lens by AI — clickable to home */}
          <motion.div variants={staggerItem} className="mb-8">
            <Link to="/" className="font-sans text-xl sm:text-2xl font-medium tracking-tight inline-flex items-baseline hover:opacity-90 transition-opacity">
              <span className="text-primary">Landing </span>
              <span className="text-primary">Lens</span>
              <span className="text-primary"> </span>
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
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="https://yoursite.com"
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none h-full"
            />
            <motion.button
              whileHover={!isSubmitting ? { scale: 1.02 } : undefined}
              whileTap={!isSubmitting ? { scale: 0.98, y: 2 } : undefined}
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-full px-6 bg-primary text-primary-foreground font-semibold text-sm rounded-none transition-colors hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Starting…" : "Analyze →"}
            </motion.button>
          </div>
        </motion.div>

        {analyzeError && (
          <p className="mt-3 text-sm text-destructive">{analyzeError}</p>
        )}

        {/* Try chips — 2 on mobile, all 4 from sm */}
        <motion.div variants={staggerItem} className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {SAMPLE_SITES.map((site, i) => (
            <button
              key={site}
              onClick={() => setUrl(`https://${site}`)}
              className={`px-3 py-1 rounded-sm text-xs font-mono text-secondary-foreground glass-surface hover:border-primary/30 transition-colors ${i >= 2 ? "hidden sm:inline-flex" : ""}`}
            >
              {site}
            </button>
          ))}
        </motion.div>

        {/* Competitor toggle */}
        <motion.div variants={staggerItem} className="mt-8">
          <button
            onClick={() => setShowCompetitors(!showCompetitors)}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
              {competitors.length < 4 && (
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
      </div>
    </div>
  );
};

export default InputScreen;

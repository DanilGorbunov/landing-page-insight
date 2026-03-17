import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, ChevronDown, X } from "lucide-react";

const SAMPLE_SITES = ["apollo.io", "linear.app", "hubspot.com", "notion.so"];

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const } },
};

interface InputScreenProps {
  onAnalyze: (url: string, competitors: string[]) => void;
}

const InputScreen = ({ onAnalyze }: InputScreenProps) => {
  const [url, setUrl] = useState("");
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [competitors, setCompetitors] = useState<string[]>([""]);

  const handleSubmit = () => {
    if (!url.trim()) return;
    const validCompetitors = competitors.filter((c) => c.trim());
    onAnalyze(url.trim(), validCompetitors);
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="w-full max-w-2xl text-center"
      >
        {/* Badge */}
        <motion.div variants={staggerItem} className="mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm glass-surface text-xs font-medium text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-amber" />
            AI-powered analysis
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={staggerItem}
          className="font-display italic text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.1] mb-6"
          style={{ letterSpacing: "-0.03em" }}
        >
          How does your landing page stack up against competitors?
        </motion.h1>

        <motion.p variants={staggerItem} className="text-muted-foreground text-base mb-10 max-w-md mx-auto">
          Paste a URL. Get an AI-powered audit with actionable insights in seconds.
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
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98, y: 2 }}
              onClick={handleSubmit}
              className="h-full px-6 bg-primary text-primary-foreground font-semibold text-sm rounded-none transition-colors hover:brightness-110"
            >
              Analyze →
            </motion.button>
          </div>
        </motion.div>

        {/* Try chips */}
        <motion.div variants={staggerItem} className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {SAMPLE_SITES.map((site) => (
            <button
              key={site}
              onClick={() => setUrl(`https://${site}`)}
              className="px-3 py-1 rounded-sm text-xs font-mono text-secondary-foreground glass-surface hover:border-primary/30 transition-colors"
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
  );
};

export default InputScreen;

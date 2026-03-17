import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";

const STEPS = [
  { label: "Discovering competitors", detail: "Scanning industry landscape..." },
  { label: "Competitors found", detail: "Identified 4 competitors in category" },
  { label: "Screenshots captured", detail: "Rendering pages at 1440px viewport" },
  { label: "AI analyzing sections", detail: "Evaluating hero, value prop, CTA..." },
  { label: "Synthesizing insights", detail: "Generating actionable report" },
];

const LOG_MESSAGES = [
  "Fetching landing page metadata...",
  "Extracting H1 from target site...",
  "Running competitor discovery via SimilarWeb...",
  "Found: linear.app, notion.so, monday.com, asana.com",
  "Capturing viewport screenshot for apollo.io...",
  "Screenshot captured (1440×900)",
  "Capturing viewport screenshot for linear.app...",
  "Analyzing hero section copy effectiveness...",
  "Evaluating CTA contrast ratio: 4.8:1 (AA pass)",
  "Comparing value proposition clarity across 4 sites...",
  "Social proof density: 2 logos detected (below median)...",
  "Generating competitive position score...",
  "Synthesis complete. Score: 6.2/10",
];

interface ProgressScreenProps {
  url: string;
  onComplete: () => void;
}

const ProgressScreen = ({ url, onComplete }: ProgressScreenProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= STEPS.length - 1) {
          clearInterval(stepInterval);
          setTimeout(onComplete, 800);
          return prev;
        }
        return prev + 1;
      });
    }, 1800);

    const logInterval = setInterval(() => {
      setLogIndex((prev) => {
        if (prev >= LOG_MESSAGES.length - 1) {
          clearInterval(logInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 700);

    return () => {
      clearInterval(stepInterval);
      clearInterval(logInterval);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Top bar */}
      <div className="h-14 flex items-center px-6 border-b border-border">
        <span className="font-display italic text-lg font-semibold text-foreground mr-4">Landing Lens</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-amber" />
          <span>Analyzing <span className="font-mono text-foreground">{domain}</span></span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-lg"
        >
          {/* Steps */}
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              const isPending = i > activeStep;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-4 py-3"
                >
                  {/* Icon */}
                  <div className="mt-0.5 w-5 h-5 flex items-center justify-center shrink-0">
                    {isDone && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      >
                        <Check className="w-4 h-4 text-success" />
                      </motion.div>
                    )}
                    {isActive && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    {isPending && (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Text */}
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        isDone ? "text-success" : isActive ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      {step.label}
                    </p>
                    {(isDone || isActive) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Live log */}
          <div className="mt-8 glass-surface rounded-md p-3 h-24 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-amber" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Live Log</span>
            </div>
            <AnimatePresence mode="popLayout">
              <motion.p
                key={logIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-xs font-mono text-muted-foreground"
              >
                {LOG_MESSAGES[logIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProgressScreen;

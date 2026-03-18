import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";
import { getJobStatus, type JobProgressEntry, type AnalysisResult } from "@/lib/api";

const STEPS = [
  { label: "Discovering competitors", detail: "Scanning industry landscape..." },
  { label: "Competitors found", detail: "Identified competitors in category" },
  { label: "Screenshots captured", detail: "Rendering pages..." },
  { label: "AI analyzing sections", detail: "Evaluating hero, value prop, CTA..." },
  { label: "Synthesizing insights", detail: "Generating actionable report" },
];

function stepFromProgress(step: string, index?: number, total?: number): number {
  switch (step) {
    case "started":
    case "discovering":
      return 0;
    case "competitors":
      return 1;
    case "screenshot":
      if (total != null && total > 0 && index != null) {
        if (index >= total) return 2;
        return 1 + Math.floor((index / total) * 1.5);
      }
      return 2;
    case "analyzing":
      return 3;
    case "synthesis":
      return 4;
    default:
      return 0;
  }
}

function messageFromProgress(entry: JobProgressEntry): string {
  if (entry.message) return entry.message;
  if (entry.competitors?.length) return `Found: ${entry.competitors.join(", ")}`;
  if (entry.step === "screenshot" && entry.index != null && entry.total != null)
    return `Capturing ${entry.index}/${entry.total}...`;
  return "";
}

interface ProgressScreenProps {
  jobId: string;
  url: string;
  onComplete: (result: AnalysisResult | null) => void;
  onBack?: () => void;
}

const ProgressScreen = ({ jobId, url, onComplete, onBack }: ProgressScreenProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [logMessage, setLogMessage] = useState("Connecting...");
  const [streamError, setStreamError] = useState<string | null>(null);
  const doneRef = useRef(false);

  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  useEffect(() => {
    if (doneRef.current) return;
    setLogMessage("Connecting...");

    const POLL_MS = 2000;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled && !doneRef.current) {
        try {
          const job = await getJobStatus(jobId);
          if (cancelled) return;
          const progress = job.progress || [];
          if (progress.length > 0) {
            const last = progress[progress.length - 1];
            const step = last.step ?? "started";
            const next = stepFromProgress(step, last.index, last.total);
            setActiveStep((prev) => Math.max(prev, next));
            const msg = messageFromProgress(last);
            if (msg) setLogMessage(msg);
          }
          if (job.status === "completed" && job.result) {
            doneRef.current = true;
            setLogMessage("Report ready.");
            setActiveStep(STEPS.length);
            setTimeout(() => onComplete(job.result as AnalysisResult), 600);
            return;
          }
          if (job.status === "failed") {
            const err = job.error || "Analysis failed.";
            setLogMessage(err);
            setStreamError(err);
            return;
          }
        } catch (e) {
          if (!cancelled && !doneRef.current) {
            setLogMessage("Connection error. Retrying...");
          }
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, onComplete]);

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <div className="h-14 flex items-center px-6 border-b border-border">
        <span className="font-display italic text-lg font-semibold text-foreground mr-4">Landing Lens</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Analyzing <span className="font-mono text-foreground">{domain}</span></span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-lg"
        >
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

          <div className="mt-8 glass-surface rounded-md p-3 min-h-24 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Live Log</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={logMessage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`text-xs font-mono ${streamError ? "text-destructive" : "text-muted-foreground"}`}
              >
                {logMessage}
              </motion.p>
            </AnimatePresence>
            {streamError && onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mt-4 px-4 py-2 text-sm rounded-md border border-white/10 text-foreground hover:bg-white/5 transition-colors"
              >
                ← Back to try again
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProgressScreen;

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { getDomain } from "@/lib/utils";
import { getJobStatus, type JobProgressEntry, type AnalysisResult } from "@/lib/api";
import WaitingSlider from "@/components/WaitingSlider";

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
  onGoHome?: () => void;
}

const ProgressScreen = ({ jobId, url, onComplete, onBack, onGoHome }: ProgressScreenProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [logMessage, setLogMessage] = useState("Connecting...");
  const [streamError, setStreamError] = useState<string | null>(null);
  const doneRef = useRef(false);

  const domain = getDomain(url);

  const MAX_POLL_FAILURES = 8;

  useEffect(() => {
    if (doneRef.current) return;
    setLogMessage("Connecting...");

    const POLL_MS = 2000;
    let cancelled = false;
    let failCount = 0;

    const poll = async () => {
      while (!cancelled && !doneRef.current) {
        try {
          const job = await getJobStatus(jobId);
          if (cancelled) return;
          failCount = 0;
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
        } catch {
          if (cancelled || doneRef.current) return;
          failCount += 1;
          if (failCount >= MAX_POLL_FAILURES) {
            setLogMessage("Connection failed after several retries.");
            setStreamError("Connection failed. Back to try again.");
            return;
          }
          setLogMessage("Connection error. Retrying...");
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
      {/* Header: logo, status, and progress + live log at start of container (desktop) */}
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8">
          <div className="h-14 flex items-center gap-6">
            {onGoHome ? (
              <button type="button" onClick={onGoHome} className="touch-target font-sans text-lg font-medium tracking-tight text-primary hover:opacity-90 text-left flex items-center">
                Landing Lens
              </button>
            ) : (
              <Link to="/" className="touch-target font-sans text-lg font-medium tracking-tight text-primary hover:opacity-90 flex items-center">Landing Lens</Link>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Analyzing <span className="font-mono text-foreground">{domain}</span></span>
            </div>
          </div>
          {/* Progress steps + live log in header (desktop: horizontal; mobile: stacked) */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="pb-4 flex flex-col md:flex-row md:items-center md:gap-6 gap-4"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {STEPS.map((step, i) => {
                const isDone = i < activeStep;
                const isActive = i === activeStep;
                const isPending = i > activeStep;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {isDone && <Check className="w-3.5 h-3.5 text-success" />}
                      {isActive && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                      {isPending && <Circle className="w-3 h-3 text-muted-foreground/40" />}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isDone ? "text-success" : isActive ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="glass-surface rounded-md px-3 py-2 min-h-[2.5rem] flex items-center flex-1 md:max-w-md">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0 mr-2" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-2">Live log</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={logMessage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-xs font-mono truncate ${streamError ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {logMessage}
                </motion.span>
              </AnimatePresence>
            </div>
            {streamError && onBack && (
              <button
                type="button"
                onClick={onBack}
                className="touch-target px-4 py-3 text-sm rounded-md border border-white/10 text-foreground hover:bg-white/5 transition-colors shrink-0"
              >
                ← Back to try again
              </button>
            )}
          </motion.div>
        </div>
      </header>

      {/* Centered waiting slider while analysis runs */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 md:py-8 min-h-0">
        {!streamError && (
          <WaitingSlider
            statusText={activeStep < STEPS.length ? STEPS[activeStep].detail : "Preparing report…"}
          />
        )}
      </div>
    </div>
  );
};

export default ProgressScreen;

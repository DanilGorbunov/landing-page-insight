import { useState, useEffect, useRef, useCallback } from "react";
import { getJobStatus, type AnalysisResult, type JobLiveState } from "@/lib/api";
import { ANALYSIS_POLL_MAX_FAILURES } from "@/lib/constants";

const POLL_MS_FAST = 750;
const POLL_MS_SLOW = 2200;

export function useAnalysisJob(jobId: string | null, initialLive?: JobLiveState | null) {
  const [live, setLive] = useState<JobLiveState | null>(initialLive ?? null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    setLive(initialLive ?? null);
  }, [jobId, initialLive]);

  useEffect(() => {
    if (!jobId) {
      setResult(null);
      setError(null);
      doneRef.current = false;
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    doneRef.current = false;
    let cancelled = false;
    let failCount = 0;

    const poll = async () => {
      while (!cancelled && !doneRef.current) {
        try {
          const job = await getJobStatus(jobId);
          if (cancelled) return;
          failCount = 0;
          if (job.live) setLive(job.live as JobLiveState);
          if (job.result) setResult(job.result as AnalysisResult);

          if (job.status === "completed" && job.result) {
            doneRef.current = true;
            return;
          }
          if (job.status === "completed" && !job.result) {
            setError("Analysis finished without a report payload. Try again.");
            doneRef.current = true;
            return;
          }
          if (job.status === "failed") {
            setError(job.error || "Analysis failed.");
            return;
          }

          const nextDelay = job.live?.synthesis?.ready ? POLL_MS_SLOW : POLL_MS_FAST;
          await new Promise((r) => setTimeout(r, nextDelay));
        } catch (e) {
          if (cancelled || doneRef.current) return;
          const name = e instanceof Error ? e.name : "";
          if (name === "JobNotFound") {
            setError(
              "This analysis job is no longer on the server (expired or restarted). Add the competitor again."
            );
            return;
          }
          failCount += 1;
          if (failCount >= ANALYSIS_POLL_MAX_FAILURES) {
            setError(
              import.meta.env.DEV
                ? "Lost connection while polling. Run npm run dev:backend (or dev:all)."
                : "Lost connection to the analysis server. Check VITE_API_BASE_URL and try again."
            );
            return;
          }
          const backoffMs = name === "ServiceUnavailable" ? 4000 : POLL_MS_FAST;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const reset = useCallback(() => {
    doneRef.current = true;
    setLive(null);
    setResult(null);
    setError(null);
  }, []);

  return { live, result, error, reset };
}

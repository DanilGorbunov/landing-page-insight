import { useState, useEffect, useRef, useCallback } from "react";
import { getJobStatus, type AnalysisResult, type JobLiveState } from "@/lib/api";

const POLL_MS_FAST = 750;
const POLL_MS_SLOW = 2200;
const MAX_POLL_FAILURES = 8;

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
          if (job.status === "failed") {
            setError(job.error || "Analysis failed.");
            return;
          }

          const nextDelay = job.live?.synthesis?.ready ? POLL_MS_SLOW : POLL_MS_FAST;
          await new Promise((r) => setTimeout(r, nextDelay));
        } catch {
          if (cancelled || doneRef.current) return;
          failCount += 1;
          if (failCount >= MAX_POLL_FAILURES) {
            setError("Connection failed. Check the API and try again.");
            return;
          }
          await new Promise((r) => setTimeout(r, POLL_MS_FAST));
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

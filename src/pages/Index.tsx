import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InputScreen from "@/components/InputScreen";
import ProgressiveReportView from "@/components/ProgressiveReportView";
import { startAnalysis, fetchRecentComparisonsFromApi, type JobLiveState } from "@/lib/api";
import { saveToHistory, getHistory, getHistoryCount, type HistoryEntry, type AnalysisResult } from "@/lib/analysisHistory";
import { getDefaultRecentComparisons } from "@/lib/demoRecentComparisons";
import { REPORT_RETURN_KEY, writeFullInsightsPayload, readFullInsightsUnlockMeta } from "@/lib/reportSession";
import { auditPathForUrl } from "@/lib/auditSlug";

type Screen = "input" | "progress" | "dashboard";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("input");
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressInitialLive, setProgressInitialLive] = useState<JobLiveState | null>(null);
  const [historyCount, setHistoryCount] = useState(getHistoryCount);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [remoteRecentComparisons, setRemoteRecentComparisons] = useState<HistoryEntry[]>([]);

  const openAnalysisDashboard = useCallback((rawUrl: string, result: AnalysisResult, paidAtOverride?: string) => {
    const meta = readFullInsightsUnlockMeta();
    const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl.replace(/^\/\//, "")}`;
    writeFullInsightsPayload({
      url: normalized,
      result,
      planId: meta?.planId ?? "analysis",
      planName: meta?.planName ?? "Analysis",
      paidAt: paidAtOverride ?? meta?.paidAt ?? new Date().toISOString(),
    });
    navigate(auditPathForUrl(normalized, "section=compare"));
  }, [navigate]);

  // Auto-start analysis when navigated here with ?url= param (e.g. from Monitor "Re-check")
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    const autoUrl = params.get("url");
    if (autoUrl) {
      autoStarted.current = true;
      window.history.replaceState({}, "", "/");
      handleAnalyze(decodeURIComponent(autoUrl), []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.pathname !== "/" || location.state?.restoreReport !== true) return;
    try {
      const raw = sessionStorage.getItem(REPORT_RETURN_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { url?: string; result?: AnalysisResult | null; savedEntry?: HistoryEntry | null };
        if (data.url && data.result != null) {
          const meta = readFullInsightsUnlockMeta();
          writeFullInsightsPayload({
            url: data.url.startsWith("http") ? data.url : `https://${data.url}`,
            result: data.result,
            planId: meta?.planId ?? "analysis",
            planName: meta?.planName ?? "Analysis",
            paidAt: meta?.paidAt ?? data.savedEntry?.analyzedAt ?? new Date().toISOString(),
          });
          sessionStorage.removeItem(REPORT_RETURN_KEY);
          navigate(auditPathForUrl(data.url.startsWith("http") ? data.url : `https://${data.url}`, "section=compare"), {
            replace: true,
          });
          return;
        }
      }
    } catch (_) {}
    navigate(".", { state: {}, replace: true });
  }, [location.pathname, location.state?.restoreReport, navigate]);

  useEffect(() => {
    if (location.pathname !== "/" || (location.state as { openHistory?: boolean })?.openHistory !== true) return;
    navigate("/history", { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (screen !== "input") return;
    let cancelled = false;
    fetchRecentComparisonsFromApi(3).then((rows) => {
      if (!cancelled) setRemoteRecentComparisons(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, historyCount]);

  const normalizeUrl = useCallback((raw: string) => {
    const u = raw.trim();
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
  }, []);

  const handleAnalyze = useCallback(async (inputUrl: string, competitorUrls: string[]) => {
    setAnalyzeError(null);
    const urlToUse = normalizeUrl(inputUrl);
    if (!urlToUse) return;
    try {
      const { jobId: id, live } = await startAnalysis(urlToUse, competitorUrls);
      setJobId(id);
      setProgressInitialLive(live ?? null);
      setUrl(urlToUse);
      setScreen("progress");
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Failed to start analysis");
    }
  }, [normalizeUrl]);

  /** Full-insights “Re-audit”: navigate here with state to run a fresh pipeline (no cached competitors). */
  const reauditHandledRef = useRef(false);
  useEffect(() => {
    if (location.pathname !== "/") reauditHandledRef.current = false;
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/") return;
    const st = location.state as { startFreshAnalysis?: { url: string } } | undefined;
    if (!st?.startFreshAnalysis?.url) return;
    if (reauditHandledRef.current) return;
    reauditHandledRef.current = true;
    const rawUrl = st.startFreshAnalysis.url;
    navigate("/", { replace: true, state: {} });
    void handleAnalyze(rawUrl, []);
  }, [location.pathname, location.state, navigate, handleAnalyze]);

  const handleComplete = useCallback(
    (result: AnalysisResult | null) => {
      const urlToSave = url || "";
      if (result) {
        saveToHistory(urlToSave, result);
        setHistoryCount(getHistoryCount());
        openAnalysisDashboard(urlToSave, result);
      }
      setJobId(null);
    },
    [url, openAnalysisDashboard]
  );

  const handleOpenHistory = useCallback(() => {
    setHistoryCount(getHistoryCount());
    navigate("/history");
  }, [navigate]);

  const handleViewReport = useCallback(
    (entry: HistoryEntry) => {
      openAnalysisDashboard(`https://${entry.domain}`, entry.result, entry.analyzedAt);
    },
    [openAnalysisDashboard]
  );

  const handleBackFromProgress = useCallback(() => {
    setJobId(null);
    setProgressInitialLive(null);
    setScreen("input");
  }, []);

  const handleGoHome = useCallback(() => {
    setScreen("input");
  }, []);

  const recentAnalysesForHome = useMemo(() => {
    const local = getHistory().slice(0, 3);
    if (local.length > 0) return local;
    if (remoteRecentComparisons.length > 0) return remoteRecentComparisons;
    return getDefaultRecentComparisons();
  }, [historyCount, remoteRecentComparisons]);

  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="absolute -left-full top-0 z-[100] p-4 bg-primary text-primary-foreground rounded-md focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
        Skip to main content
      </a>
      {screen === "input" && (
        <InputScreen
          onAnalyze={handleAnalyze}
          onOpenHistory={handleOpenHistory}
          historyCount={historyCount}
          analyzeError={analyzeError}
          recentAnalyses={recentAnalysesForHome}
          onSelectRecent={handleViewReport}
        />
      )}
      {screen === "progress" && jobId && (
        <ProgressiveReportView
          jobId={jobId}
          url={url}
          initialLive={progressInitialLive ?? undefined}
          onComplete={handleComplete}
          onBack={handleBackFromProgress}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  );
};

export default Index;

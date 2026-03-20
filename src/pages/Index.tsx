import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InputScreen from "@/components/InputScreen";
import ProgressiveReportView from "@/components/ProgressiveReportView";
import ReportScreen from "@/components/ReportScreen";
import Dashboard from "@/components/Dashboard";
import { startAnalysis, fetchRecentComparisonsFromApi, type JobLiveState } from "@/lib/api";
import { saveToHistory, getHistory, getHistoryCount, hasFullInsightsHistoryUnlock, type HistoryEntry, type AnalysisResult } from "@/lib/analysisHistory";
import { getDefaultRecentComparisons } from "@/lib/demoRecentComparisons";
import { REPORT_RETURN_KEY, writeFullInsightsPayload, readFullInsightsUnlockMeta } from "@/lib/reportSession";

type Screen = "input" | "progress" | "report" | "dashboard";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("input");
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressInitialLive, setProgressInitialLive] = useState<JobLiveState | null>(null);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [savedEntryForReport, setSavedEntryForReport] = useState<HistoryEntry | null>(null);
  const [historyCount, setHistoryCount] = useState(getHistoryCount);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [remoteRecentComparisons, setRemoteRecentComparisons] = useState<HistoryEntry[]>([]);
  /** When user opened History from Report, back should return to Report; otherwise to Input */
  const [screenBeforeDashboard, setScreenBeforeDashboard] = useState<"input" | "report">("input");

  useEffect(() => {
    if (location.pathname !== "/" || location.state?.restoreReport !== true) return;
    try {
      const raw = sessionStorage.getItem(REPORT_RETURN_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { url?: string; result?: AnalysisResult | null; savedEntry?: HistoryEntry | null };
        if (data.url) setUrl(data.url);
        if (data.result != null) setLastResult(data.result);
        if (data.savedEntry != null) setSavedEntryForReport(data.savedEntry);
        setScreen("report");
        sessionStorage.removeItem(REPORT_RETURN_KEY);
      }
    } catch (_) {}
    navigate(".", { state: {}, replace: true });
  }, [location.pathname, location.state?.restoreReport, navigate]);

  useEffect(() => {
    if (location.pathname !== "/" || (location.state as { openHistory?: boolean })?.openHistory !== true) return;
    setHistoryCount(getHistoryCount());
    setScreenBeforeDashboard("input");
    setScreen("dashboard");
    navigate(".", { state: {}, replace: true });
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
    setSavedEntryForReport(null);
    setLastResult(null);
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

  const handleComplete = useCallback(
    (result: AnalysisResult | null) => {
      const urlToSave = url || "";
      if (result) {
        setLastResult(result);
        saveToHistory(urlToSave, result);
        setHistoryCount(getHistoryCount());
      }
      setJobId(null);
      if (result && hasFullInsightsHistoryUnlock()) {
        const meta = readFullInsightsUnlockMeta();
        writeFullInsightsPayload({
          url: urlToSave.startsWith("http") ? urlToSave : `https://${urlToSave.replace(/^\/\//, "")}`,
          result,
          planId: meta?.planId ?? "one-time",
          planName: meta?.planName ?? "Full insights",
          paidAt: new Date().toISOString(),
        });
        navigate("/full-insights");
        return;
      }
      setScreen("report");
    },
    [url, navigate]
  );

  const handleOpenHistory = useCallback(() => {
    setHistoryCount(getHistoryCount());
    setScreenBeforeDashboard(screen === "report" ? "report" : "input");
    setScreen("dashboard");
  }, [screen]);

  const handleViewReport = useCallback(
    (entry: HistoryEntry) => {
      if (hasFullInsightsHistoryUnlock()) {
        const meta = readFullInsightsUnlockMeta();
        writeFullInsightsPayload({
          url: `https://${entry.domain}`,
          result: entry.result,
          planId: meta?.planId ?? "one-time",
          planName: meta?.planName ?? "Full insights",
          paidAt: meta?.paidAt ?? entry.analyzedAt,
        });
        navigate("/full-insights");
        return;
      }
      setUrl(`https://${entry.domain}`);
      setSavedEntryForReport(entry);
      setLastResult(entry.result);
      setScreen("report");
    },
    [navigate]
  );

  const handleBackFromReport = useCallback(() => {
    if (savedEntryForReport) {
      setSavedEntryForReport(null);
      setScreen("dashboard");
    } else {
      setHistoryCount(getHistoryCount());
      setScreen("input");
    }
    setLastResult(null);
  }, [savedEntryForReport]);

  const handleBackFromDashboard = useCallback(() => {
    setHistoryCount(getHistoryCount());
    if (screenBeforeDashboard === "report") {
      setScreen("report");
    } else {
      setScreen("input");
    }
  }, [screenBeforeDashboard]);

  const handleBackFromProgress = useCallback(() => {
    setJobId(null);
    setProgressInitialLive(null);
    setScreen("input");
  }, []);

  const handleGoHome = useCallback(() => {
    setScreen("input");
  }, []);

  const reportResult = lastResult ?? savedEntryForReport?.result ?? null;

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
      {screen === "dashboard" && (
        <Dashboard
          onBack={handleBackFromDashboard}
          onGoHome={handleGoHome}
          onViewReport={handleViewReport}
          historyCount={historyCount}
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
      {screen === "report" && (
        <ReportScreen
          url={savedEntryForReport ? `https://${savedEntryForReport.domain}` : url}
          result={reportResult}
          savedEntry={savedEntryForReport}
          onBack={handleBackFromReport}
          onOpenHistory={handleOpenHistory}
          onGoHome={handleGoHome}
          historyCount={historyCount}
        />
      )}
    </div>
  );
};

export default Index;

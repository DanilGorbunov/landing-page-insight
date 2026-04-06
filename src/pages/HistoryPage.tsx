import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DashboardNavSidebar } from "@/components/DashboardNavSidebar";
import { HistoryListPanel } from "@/components/HistoryListPanel";
import { readFullInsightsPayload, writeFullInsightsPayload, readFullInsightsUnlockMeta } from "@/lib/reportSession";
import { getHistoryCount, type HistoryEntry } from "@/lib/analysisHistory";
import { ensureScore, parseSectionScores } from "@/lib/utils";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";

export default function HistoryPage() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [historyCount, setHistoryCount] = useState(getHistoryCount);
  const [historyTick, setHistoryTick] = useState(0);

  const payload = readFullInsightsPayload();
  const result: AnalysisResult | null = payload?.result ?? null;
  const url = payload?.url ?? null;

  const overallScore = useMemo(() => {
    if (!result) return null;
    const s = result.synthesis?.overall_score;
    if (s != null) return ensureScore(s);
    const userScores = parseSectionScores(result.userAnalysis);
    return weightedOverallFromSections(userScores) ?? 7.0;
  }, [result]);

  const reportContext =
    url != null && overallScore != null
      ? { url, overallScore, ...(payload?.paidAt ? { createdAt: payload.paidAt } : {}) }
      : null;

  useEffect(() => {
    setHistoryCount(getHistoryCount());
  }, [historyTick]);

  const handleNav = (id: string) => {
    if (id === "history") return;
    if (id === "monitor") {
      navigate("/monitor");
      return;
    }
    if (FULL_INSIGHTS_SECTION_IDS.has(id)) {
      navigate(`/full-insights?section=${encodeURIComponent(id)}`);
    }
  };

  const handleViewReport = (entry: HistoryEntry) => {
    const meta = readFullInsightsUnlockMeta();
    writeFullInsightsPayload({
      url: `https://${entry.domain}`,
      result: entry.result,
      planId: meta?.planId ?? "analysis",
      planName: meta?.planName ?? "Analysis",
      paidAt: entry.analyzedAt,
    });
    navigate("/full-insights?section=compare");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardNavSidebar
        activeNavId="history"
        onSelect={handleNav}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        reportContext={reportContext}
        result={result}
        historyCount={historyCount}
        onNewAnalysis={() => navigate("/")}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 backdrop-blur px-4 md:px-6">
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <Link to="/full-insights?section=compare" className="text-muted-foreground hover:text-foreground truncate">
              Dashboard
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              /
            </span>
            <span className="font-semibold text-foreground truncate">History</span>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto p-5 md:p-7">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-lg font-bold text-foreground mb-1">Analysis history</h1>
            <p className="text-xs text-muted-foreground mb-6">Open a saved report or start a new analysis from the home page.</p>
            <HistoryListPanel
              historyTick={historyTick}
              onViewReport={handleViewReport}
              onHistoryMutated={() => {
                setHistoryCount(getHistoryCount());
                setHistoryTick((n) => n + 1);
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

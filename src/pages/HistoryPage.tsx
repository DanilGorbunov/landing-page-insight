import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import { HistoryListPanel } from "@/components/HistoryListPanel";
import { readFullInsightsPayload, writeFullInsightsPayload, readFullInsightsUnlockMeta } from "@/lib/reportSession";
import { getHistoryCount, type HistoryEntry } from "@/lib/analysisHistory";
import { ensureScore, parseSectionScores } from "@/lib/utils";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";
import { auditPathForUrl } from "@/lib/auditSlug";
import { resolveDashboardNavHref } from "@/lib/dashboardNavHref";

export default function HistoryPage() {
  const navigate = useNavigate();
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

  const resolveNavHref = useCallback(
    (id: string) => resolveDashboardNavHref(id, { mode: "session", reportUrl: url }),
    [url]
  );

  const handleViewReport = (entry: HistoryEntry) => {
    const meta = readFullInsightsUnlockMeta();
    writeFullInsightsPayload({
      url: `https://${entry.domain}`,
      result: entry.result,
      planId: meta?.planId ?? "analysis",
      planName: meta?.planName ?? "Analysis",
      paidAt: entry.analyzedAt,
    });
    navigate(auditPathForUrl(`https://${entry.domain}`));
  };

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "history",
        resolveNavHref,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
      }}
      mainClassName="overflow-y-auto px-4 pt-4 pb-5 md:pb-7"
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-lg font-bold text-foreground">Analysis history</h1>
        <p className="mb-6 text-xs text-muted-foreground">
          Open a saved report or start a new analysis from the home page.
        </p>
        <HistoryListPanel
          historyTick={historyTick}
          onViewReport={handleViewReport}
          onHistoryMutated={() => {
            setHistoryCount(getHistoryCount());
            setHistoryTick((n) => n + 1);
          }}
        />
      </div>
    </DashboardPageShell>
  );
}

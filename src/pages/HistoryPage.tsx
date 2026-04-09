import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import { HistoryListPanel } from "@/components/HistoryListPanel";
import { readFullInsightsPayload, writeFullInsightsPayload, readFullInsightsUnlockMeta } from "@/lib/reportSession";
import { getHistoryCount, type HistoryEntry } from "@/lib/analysisHistory";
import { ensureScore, parseSectionScores } from "@/lib/utils";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import { auditPathForUrl, auditSectionHref } from "@/lib/auditSlug";

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

  const handleNav = (id: string) => {
    if (id === "history") return;
    if (id === "monitor") {
      navigate("/monitor");
      return;
    }
    if (FULL_INSIGHTS_SECTION_IDS.has(id)) {
      navigate(auditSectionHref(id, url));
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
    navigate(auditPathForUrl(`https://${entry.domain}`, "section=compare"));
  };

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "history",
        onSelect: handleNav,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
      }}
      headerCenter={
        <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2 px-1 text-sm">
          <Link to={auditSectionHref("compare", url)} className="truncate text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <span className="text-muted-foreground/60" aria-hidden>
            /
          </span>
          <span className="truncate font-semibold text-foreground">History</span>
        </div>
      }
      mainClassName="overflow-y-auto p-5 md:p-7"
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

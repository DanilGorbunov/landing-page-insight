import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { TOUCH_TARGET_CLASS } from "@/lib/constants";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import { auditSectionHref } from "@/lib/auditSlug";
import { ensureScore, parseSectionScores } from "@/lib/utils";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleNav = (id: string) => {
    if (id === "history") {
      navigate("/history");
      return;
    }
    if (id === "monitor") {
      navigate("/monitor");
      return;
    }
    if (FULL_INSIGHTS_SECTION_IDS.has(id)) {
      navigate(auditSectionHref(id, url));
    }
  };

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "not-found",
        onSelect: handleNav,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
      }}
      headerCenter={
        <div className="flex min-h-0 min-w-0 flex-1 items-center px-1 text-sm text-muted-foreground">
          Page not found
        </div>
      }
      mainClassName="flex flex-col items-center justify-center overflow-y-auto px-4 py-16"
    >
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-5xl font-bold tabular-nums text-foreground sm:text-6xl">404</h1>
        <p className="mb-6 text-base text-muted-foreground sm:text-lg">This page does not exist.</p>
        <Link
          to="/"
          className={`${TOUCH_TARGET_CLASS} inline-flex rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110 touch-manipulation`}
        >
          Back to Home
        </Link>
      </div>
    </DashboardPageShell>
  );
};

export default NotFound;

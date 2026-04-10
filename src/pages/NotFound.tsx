import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useCallback } from "react";
import { TOUCH_TARGET_CLASS } from "@/lib/constants";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { resolveDashboardNavHref } from "@/lib/dashboardNavHref";
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

  const resolveNavHref = useCallback(
    (id: string) => resolveDashboardNavHref(id, { mode: "session", reportUrl: url }),
    [url]
  );

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "not-found",
        resolveNavHref,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
      }}
      mainClassName="flex min-h-0 flex-col items-center justify-center overflow-y-auto px-4 pt-4 pb-5 md:pb-7"
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

import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Check, X } from "lucide-react";
import { TouchTargetButton } from "@/components/ui/touch-target-button";
import { CardContainer } from "@/components/ui/card-container";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import { cn, ensureScore, parseSectionScores } from "@/lib/utils";
import { readFullInsightsPayload } from "@/lib/reportSession";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import { auditSectionHref } from "@/lib/auditSlug";
import type { AnalysisResult } from "@/types/api";

type FeatureLine = { text: string; included: boolean };

type Plan = {
  id: string;
  emoji: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: FeatureLine[];
  default?: boolean;
  paid: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "free",
    emoji: "🆓",
    name: "Free",
    price: "$0",
    period: "",
    tagline: "See how you stack up",
    paid: false,
    cta: "Start free",
    features: [
      { text: "1 analysis per month", included: true },
      { text: "3 competitors automatically", included: true },
      { text: "Overview + core insights", included: true },
      { text: "5 sections (Hero, Value Prop, Features, CTA, Social Proof)", included: true },
      { text: "Share Report (read-only link)", included: true },
      { text: "History (not included)", included: false },
      { text: "Export PDF (not included)", included: false },
      { text: "Monitor (not included)", included: false },
    ],
  },
  {
    id: "pro",
    emoji: "💚",
    name: "Pro",
    price: "$49",
    period: "/ mo",
    tagline: "Fix and track your landing page",
    paid: true,
    default: true,
    cta: "Subscribe",
    features: [
      { text: "20 analyses per month", included: true },
      { text: "Up to 5 competitors per analysis", included: true },
      { text: "Full report (all tabs: Simulate / Insight / Scores)", included: true },
      { text: "History — all past analyses saved", included: true },
      { text: "Export PDF", included: true },
      { text: "Monitor — track 3 competitors", included: true },
      { text: "Weekly email digest of competitor changes", included: true },
      { text: "Copy Generator — 3 copy variants per section", included: true },
      { text: "Δ vs you lens + AI screenshot markers", included: true },
      { text: "Business Impact Estimate", included: true },
      { text: "White-label (not included)", included: false },
      { text: "Team access (not included)", included: false },
      { text: "API (not included)", included: false },
    ],
  },
  {
    id: "pro-unlimited",
    emoji: "🚀",
    name: "Pro Unlimited",
    price: "$149",
    period: "/ mo",
    tagline: "Stay ahead of every competitor",
    paid: true,
    cta: "Subscribe",
    features: [
      { text: "Unlimited analyses", included: true },
      { text: "Up to 10 competitors per analysis", included: true },
      { text: "Monitor — up to 10 competitors", included: true },
      { text: "Daily digest (not weekly)", included: true },
      { text: "Alert when a competitor changes (email + Slack)", included: true },
      { text: "Copy Generator unlimited", included: true },
      { text: "Attention Heatmap (AI-predicted)", included: true },
      { text: "All ANALYZE modes (Gap heat, Conversion, Mobile, First 5s)", included: true },
      { text: "Score breakdown with methodology", included: true },
      { text: "3 team members", included: true },
      { text: "Comments on the report", included: true },
      { text: "Compare reports over time (“before / after”)", included: true },
      { text: "White-label (not included)", included: false },
      { text: "API (not included)", included: false },
    ],
  },
  {
    id: "agency",
    emoji: "🏢",
    name: "Agency",
    price: "$299",
    period: "/ mo",
    tagline: "Sell competitive intelligence to your clients",
    paid: true,
    cta: "Subscribe",
    features: [
      { text: "Everything in Pro Unlimited", included: true },
      { text: "Unlimited projects (clients)", included: true },
      { text: "White-label PDF — client logo", included: true },
      { text: "Custom report branding (colors, name)", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Client sharing — separate access for the client", included: true },
      { text: "API access (500 calls / month)", included: true },
      { text: "Priority support", included: true },
      { text: "Quarterly strategy call (30 min)", included: true },
      { text: "Early access to new features", included: true },
    ],
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromReport = location.state?.fromReport === true;

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

  const goCheckout = (planId: string) => {
    navigate(`/checkout?plan=${encodeURIComponent(planId)}`, { state: { fromReport, planId } });
  };

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "pricing",
        onSelect: handleNav,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
      }}
      headerCenter={
        <div className="flex min-h-0 min-w-0 flex-1 items-center px-1">
          <span className="text-sm font-semibold text-foreground">Pricing</span>
        </div>
      }
      mainClassName="overflow-y-auto px-4 py-10 pb-16 sm:px-6 sm:py-14"
    >
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-10 text-center sm:mb-14">
          <h1 className="font-display mb-3 text-3xl font-medium tracking-tight text-foreground md:text-[2rem]">
            LandingLens — Pricing Tiers
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground">
            From a free competitive snapshot to agency-grade intelligence. All features listed in plain English.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4 lg:gap-6">
          {PLANS.map((plan) => (
            <CardContainer key={plan.id} highlighted={plan.default} className="h-full">
              <div className="mb-4">
                {plan.default && (
                  <span className="mb-2 inline-block text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Recommended
                  </span>
                )}
                <div className="flex flex-wrap items-start gap-2">
                  <span className="shrink-0 text-xl leading-none" aria-hidden>
                    {plan.emoji}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold leading-tight text-foreground">{plan.name}</h2>
                    <div className="mt-1 flex flex-wrap items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums text-foreground">{plan.price}</span>
                      {plan.period ? <span className="text-sm text-muted-foreground">{plan.period}</span> : null}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mb-1 text-xs font-medium leading-snug text-primary/90">&ldquo;{plan.tagline}&rdquo;</p>
              <ul className="mb-2 flex-1 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                    {f.included ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                    )}
                    <span className={cn(f.included ? "text-muted-foreground" : "text-muted-foreground/75")}>{f.text}</span>
                  </li>
                ))}
              </ul>
              {plan.paid ? (
                <TouchTargetButton
                  type="button"
                  onClick={() => goCheckout(plan.id)}
                  className="mt-4 w-full touch-manipulation rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
                >
                  {plan.cta}
                </TouchTargetButton>
              ) : (
                <TouchTargetButton
                  type="button"
                  onClick={() => navigate("/")}
                  className="mt-4 w-full touch-manipulation rounded-md border border-border bg-secondary/50 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary"
                >
                  {plan.cta}
                </TouchTargetButton>
              )}
            </CardContainer>
          ))}
        </div>
      </div>
    </DashboardPageShell>
  );
};

export default Pricing;

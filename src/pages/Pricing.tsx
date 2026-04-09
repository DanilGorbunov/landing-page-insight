import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { TouchTargetButton } from "@/components/ui/touch-target-button";
import { CardContainer } from "@/components/ui/card-container";
import { TOUCH_TARGET_CLASS } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

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

  const goCheckout = (planId: string) => {
    navigate(`/checkout?plan=${encodeURIComponent(planId)}`, { state: { fromReport, planId } });
  };

  const handleBack = () => {
    if (fromReport) {
      navigate("/", { state: { restoreReport: true } });
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 h-14 flex items-center border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
          <TouchTargetButton
            onClick={handleBack}
            className="gap-2 px-2 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </TouchTargetButton>
          <Link
            to="/"
            className={`${TOUCH_TARGET_CLASS} font-sans text-base font-semibold tracking-tight text-foreground hover:text-primary transition-colors`}
          >
            Landing Lens
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14 pb-16 max-w-[1600px] mx-auto w-full">
        <div className="text-center mb-10 sm:mb-14">
          <h1 className="font-display text-3xl md:text-[2rem] font-medium tracking-tight text-foreground mb-3">
            LandingLens — Pricing Tiers
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto leading-relaxed">
            From a free competitive snapshot to agency-grade intelligence. All features listed in plain English.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-6 items-stretch">
          {PLANS.map((plan) => (
            <CardContainer key={plan.id} highlighted={plan.default} className="h-full">
              <div className="mb-4">
                {plan.default && (
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
                    Recommended
                  </span>
                )}
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-xl leading-none shrink-0" aria-hidden>
                    {plan.emoji}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground leading-tight">{plan.name}</h2>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                      <span className="text-2xl font-bold tabular-nums text-foreground">{plan.price}</span>
                      {plan.period ? (
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs font-medium text-primary/90 mb-1 leading-snug">&ldquo;{plan.tagline}&rdquo;</p>
              <ul className="space-y-2 flex-1 mb-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                    {f.included ? (
                      <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" aria-hidden />
                    ) : (
                      <X className="w-3.5 h-3.5 text-muted-foreground/70 mt-0.5 shrink-0" aria-hidden />
                    )}
                    <span className={cn(f.included ? "text-muted-foreground" : "text-muted-foreground/75")}>{f.text}</span>
                  </li>
                ))}
              </ul>
              {plan.paid ? (
                <TouchTargetButton
                  type="button"
                  onClick={() => goCheckout(plan.id)}
                  className="mt-4 w-full py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-colors touch-manipulation"
                >
                  {plan.cta}
                </TouchTargetButton>
              ) : (
                <TouchTargetButton
                  type="button"
                  onClick={() => navigate("/")}
                  className="mt-4 w-full py-3 rounded-md border border-border bg-secondary/50 text-secondary-foreground text-sm font-medium hover:bg-secondary transition-colors touch-manipulation"
                >
                  {plan.cta}
                </TouchTargetButton>
              )}
            </CardContainer>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Pricing;

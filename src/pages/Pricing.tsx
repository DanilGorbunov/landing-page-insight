import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { TouchTargetButton } from "@/components/ui/touch-target-button";
import { CardContainer } from "@/components/ui/card-container";
import { TOUCH_TARGET_CLASS } from "@/lib/constants";

const PLANS = [
  {
    id: "one-time",
    name: "One-time",
    price: "$5",
    period: "once",
    description: "Single full report: competitive position, critical gaps, section breakdown.",
    features: ["1 landing page analysis", "Competitor comparison (up to 3)", "Section-by-section scores", "Actionable recommendations", "PDF-style report"],
    default: false,
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$15",
    period: "/ month",
    description: "Unlimited reports for your team. Track changes over time.",
    features: ["Unlimited analyses", "Up to 5 competitors per run", "History & comparison over time", "Priority processing", "Email support"],
    default: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/ month",
    description: "For agencies and power users. Deeper insights and exports.",
    features: ["Everything in Monthly", "Bulk URL analysis", "API access", "White-label PDF export", "Dedicated support"],
    default: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromReport = location.state?.fromReport === true;

  const handleBack = () => {
    if (fromReport) {
      navigate("/", { state: { restoreReport: true } });
    } else {
      navigate(-1);
    }
  };

  return (
  <div className="min-h-screen bg-background flex flex-col">
    <header className="sticky top-0 z-20 h-14 flex items-center border-b border-border bg-background">
      <div className="max-w-5xl mx-auto w-full px-4 flex items-center justify-between">
        <TouchTargetButton
          onClick={handleBack}
          className="gap-2 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </TouchTargetButton>
        <Link to="/" className={`${TOUCH_TARGET_CLASS} font-sans text-lg font-medium tracking-tight text-primary hover:opacity-90`}>Landing Lens</Link>
        <div className="w-16" />
      </div>
    </header>

    <main className="flex-1 px-4 py-8 sm:py-12 pb-12 max-w-5xl mx-auto w-full">
      <div className="text-center mb-12">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">Plans & pricing</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          One-time report or unlimited analyses. Choose what fits your workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <CardContainer key={plan.id} highlighted={plan.default}>
            <div className="mb-4">
              {plan.default && (
                <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Recommended</span>
              )}
              <h2 className="text-sm font-semibold text-foreground">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">{plan.description}</p>
            <ul className="space-y-2 flex-1">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <TouchTargetButton
              className="mt-6 w-full py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-colors touch-manipulation"
            >
              Get started
            </TouchTargetButton>
          </CardContainer>
        ))}
      </div>
    </main>
  </div>
  );
};

export default Pricing;

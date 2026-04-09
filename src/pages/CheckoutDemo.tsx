import { useState, useMemo, type FormEvent } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Lock, Loader2 } from "lucide-react";
import { TouchTargetButton } from "@/components/ui/touch-target-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardPageShell } from "@/components/DashboardPageShell";
import {
  readFullInsightsPayload,
  readReportReturnPayload,
  writeFullInsightsPayload,
  writeFullInsightsUnlockMeta,
  type FullInsightsPayload,
} from "@/lib/reportSession";
import { enableFullInsightsHistoryPersistence } from "@/lib/analysisHistory";
import { auditPathForUrl, auditSectionHref } from "@/lib/auditSlug";
import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import { ensureScore, parseSectionScores } from "@/lib/utils";
import { weightedOverallFromSections } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";

const PLANS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  "pro-unlimited": "Pro Unlimited",
  agency: "Agency",
  /** Legacy query params */
  "one-time": "One-time",
  monthly: "Monthly",
};

/** Stripe test card & billing — demo only. */
const DEMO = {
  email: "demo.customer@example.com",
  name: "Alex Demo",
  card: "4242424242424242",
  exp: "12 / 34",
  cvc: "123",
  zip: "94107",
};

/**
 * Simulated Stripe-style checkout (no real Stripe.js call).
 * Uses REPORT_RETURN_KEY payload after “See full report” from analysis.
 */
export default function CheckoutDemo() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan") || (location.state as { planId?: string })?.planId || "pro";
  const fromReport = (location.state as { fromReport?: boolean })?.fromReport === true;

  const [email, setEmail] = useState(DEMO.email);
  const [name, setName] = useState(DEMO.name);
  const [card, setCard] = useState(DEMO.card);
  const [exp, setExp] = useState(DEMO.exp);
  const [cvc, setCvc] = useState(DEMO.cvc);
  const [zip, setZip] = useState(DEMO.zip);
  const [busy, setBusy] = useState(false);

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

  const handleBack = () => {
    if (fromReport) {
      navigate("/", { state: { restoreReport: true } });
    } else {
      navigate("/pricing", { state: { fromReport } });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pending = readReportReturnPayload();
    if (!pending?.result) {
      window.alert(
        "Run a landing analysis and open the report first, then use “See full report” before paying."
      );
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));

    const nextPayload: FullInsightsPayload = {
      url: pending?.url || "",
      result: pending?.result ?? null,
      planId,
      planName: PLANS[planId] || planId,
      paidAt: new Date().toISOString(),
    };
    writeFullInsightsPayload(nextPayload);
    writeFullInsightsUnlockMeta({
      planId,
      planName: PLANS[planId] || planId,
      paidAt: nextPayload.paidAt,
    });
    enableFullInsightsHistoryPersistence();
    setBusy(false);
    navigate(auditPathForUrl(nextPayload.url, "section=compare"), { replace: true });
  };

  return (
    <DashboardPageShell
      sidebarProps={{
        activeNavId: "checkout",
        onSelect: handleNav,
        reportContext,
        result,
        onNewAnalysis: () => navigate("/"),
      }}
      headerCenter={
        <div className="flex min-h-0 min-w-0 flex-1 flex-wrap items-center gap-2 px-1 text-sm">
          <TouchTargetButton
            type="button"
            onClick={handleBack}
            className="gap-2 rounded-lg px-2 py-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </TouchTargetButton>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Secure demo checkout
          </span>
        </div>
      }
      mainClassName="overflow-y-auto px-4 py-10"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center">
        <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#635bff]/15 px-5 py-4">
            <CreditCard className="h-5 w-5 text-[#635bff]" />
            <div>
              <p className="text-xs text-zinc-400">Pay Landing Lens</p>
              <p className="text-sm font-semibold text-white">{PLANS[planId] || planId} plan</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4 p-5">
            <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
              Demo only: uses Stripe test card pattern. No charge is processed.
            </p>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="border-white/15 bg-[#0d0d12]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name on card</Label>
              <Input id="name" value={name} onChange={(ev) => setName(ev.target.value)} className="border-white/15 bg-[#0d0d12]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card">Card number</Label>
              <Input
                id="card"
                inputMode="numeric"
                value={card}
                onChange={(ev) => setCard(ev.target.value.replace(/\D/g, "").slice(0, 16))}
                placeholder="4242 4242 4242 4242"
                className="border-white/15 bg-[#0d0d12] font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="exp">Expiry</Label>
                <Input id="exp" value={exp} onChange={(ev) => setExp(ev.target.value)} className="border-white/15 bg-[#0d0d12] font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  value={cvc}
                  onChange={(ev) => setCvc(ev.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="border-white/15 bg-[#0d0d12] font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" value={zip} onChange={(ev) => setZip(ev.target.value)} className="border-white/15 bg-[#0d0d12] font-mono" />
            </div>

            <TouchTargetButton
              type="submit"
              disabled={busy || card.length < 16}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#635bff] py-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                "Pay with demo card"
              )}
            </TouchTargetButton>
          </form>
        </div>
      </div>
    </DashboardPageShell>
  );
}

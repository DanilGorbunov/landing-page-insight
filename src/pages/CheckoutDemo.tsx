import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Lock, Loader2 } from "lucide-react";
import { TouchTargetButton } from "@/components/ui/touch-target-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOUCH_TARGET_CLASS } from "@/lib/constants";
import {
  readReportReturnPayload,
  writeFullInsightsPayload,
  writeFullInsightsUnlockMeta,
  type FullInsightsPayload,
} from "@/lib/reportSession";
import { enableFullInsightsHistoryPersistence } from "@/lib/analysisHistory";

const PLANS: Record<string, string> = {
  "one-time": "One-time",
  monthly: "Monthly",
  pro: "Pro",
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
  const planId = searchParams.get("plan") || (location.state as { planId?: string })?.planId || "monthly";
  const fromReport = (location.state as { fromReport?: boolean })?.fromReport === true;

  const [email, setEmail] = useState(DEMO.email);
  const [name, setName] = useState(DEMO.name);
  const [card, setCard] = useState(DEMO.card);
  const [exp, setExp] = useState(DEMO.exp);
  const [cvc, setCvc] = useState(DEMO.cvc);
  const [zip, setZip] = useState(DEMO.zip);
  const [busy, setBusy] = useState(false);

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

    const payload: FullInsightsPayload = {
      url: pending?.url || "",
      result: pending?.result ?? null,
      planId,
      planName: PLANS[planId] || planId,
      paidAt: new Date().toISOString(),
    };
    writeFullInsightsPayload(payload);
    writeFullInsightsUnlockMeta({
      planId,
      planName: PLANS[planId] || planId,
      paidAt: payload.paidAt,
    });
    enableFullInsightsHistoryPersistence();
    setBusy(false);
    navigate("/full-insights", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] text-foreground flex flex-col">
      <header className="border-b border-white/10 bg-[#12121a]">
        <div className="max-w-lg mx-auto w-full px-4 h-14 flex items-center justify-between">
          <TouchTargetButton
            type="button"
            onClick={handleBack}
            className="gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </TouchTargetButton>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            Secure demo checkout
          </div>
          <Link to="/" className={`${TOUCH_TARGET_CLASS} text-sm text-primary`}>
            Landing Lens
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2 bg-[#635bff]/15">
              <CreditCard className="w-5 h-5 text-[#635bff]" />
              <div>
                <p className="text-xs text-zinc-400">Pay Landing Lens</p>
                <p className="text-sm font-semibold text-white">{PLANS[planId] || planId} plan</p>
              </div>
            </div>

            <form onSubmit={submit} className="p-5 space-y-4">
              <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
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
                  className="bg-[#0d0d12] border-white/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name on card</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  className="bg-[#0d0d12] border-white/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card">Card number</Label>
                <Input
                  id="card"
                  inputMode="numeric"
                  value={card}
                  onChange={(ev) => setCard(ev.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="4242 4242 4242 4242"
                  className="bg-[#0d0d12] border-white/15 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="exp">Expiry</Label>
                  <Input
                    id="exp"
                    value={exp}
                    onChange={(ev) => setExp(ev.target.value)}
                    className="bg-[#0d0d12] border-white/15 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    value={cvc}
                    onChange={(ev) => setCvc(ev.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="bg-[#0d0d12] border-white/15 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={zip}
                  onChange={(ev) => setZip(ev.target.value)}
                  className="bg-[#0d0d12] border-white/15 font-mono"
                />
              </div>

              <TouchTargetButton
                type="submit"
                disabled={busy || card.length < 16}
                className="w-full py-3.5 rounded-lg bg-[#635bff] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
      >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  "Pay with demo card"
                )}
              </TouchTargetButton>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

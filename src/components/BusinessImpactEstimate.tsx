import type { ConversionLayer } from "@/lib/compareDecisionMetrics";
import { BarChart3 } from "lucide-react";

export function BusinessImpactEstimate({ conversion }: { conversion: ConversionLayer }) {
  const visitors = 1000;
  const baseConv = 0.03;
  const acv = 99;
  const monthlyBase = visitors * baseConv * acv;
  const lowRisk = Math.round(monthlyBase * (conversion.lossLowPct / 100));
  const highRisk = Math.round(monthlyBase * (conversion.lossHighPct / 100));

  const fmt = (n: number) =>
    n >= 1000 ? `~$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `~$${n}`;

  return (
    <div className="mt-3 rounded-xl border border-border/80 bg-gray-950/90 dark:bg-gray-950/80 p-3 text-gray-100 shadow-inner">
      <p className="text-[11px] font-bold text-white flex items-center gap-1.5 mb-2">
        <BarChart3 className="h-4 w-4 text-primary shrink-0" />
        Business Impact Estimate
      </p>
      <div className="space-y-1.5 text-[11px] leading-relaxed">
        <p>
          <span className="text-gray-400">Conversion impact: </span>
          <span className="font-bold text-red-400 tabular-nums">
            −{conversion.lossLowPct}–{conversion.lossHighPct}%
          </span>
        </p>
        <p>
          <span className="text-gray-400">Monthly revenue risk: </span>
          <span className="font-bold text-amber-200 tabular-nums">
            {fmt(lowRisk)}–{fmt(highRisk)}
          </span>
        </p>
        <p className="text-[10px] text-gray-500">(based on avg SaaS conversion rates)</p>
        <p className="pt-1 border-t border-gray-800">
          <span className="text-gray-400">If you fix top 3 issues:</span>
          <br />
          <span className="font-bold text-primary">Estimated uplift: +8–15%</span>
        </p>
      </div>
      <p className="text-[9px] text-gray-500 mt-2 leading-snug">
        Illustrative estimate based on industry benchmarks — not financial advice.
      </p>
    </div>
  );
}

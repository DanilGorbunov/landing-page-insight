import type { PerformanceData } from "@/types/api";
import { cn } from "@/lib/utils";

function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-muted-foreground">—</span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
    );
  }

  const color =
    score >= 90 ? "text-emerald-500" :
    score >= 50 ? "text-amber-500 dark:text-amber-400" :
    "text-destructive";

  const circumference = 2 * Math.PI * 15.9;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
          <circle
            cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
            stroke="currentColor"
            className={color}
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-bold", color)}>
          {score}
        </span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000, unit: "ms", label: "LCP" },
  fcp: { good: 1800, poor: 3000, unit: "ms", label: "FCP" },
  cls: { good: 0.1, poor: 0.25, unit: "", label: "CLS" },
  inp: { good: 200, poor: 500, unit: "ms", label: "INP" },
  tbt: { good: 200, poor: 600, unit: "ms", label: "TBT" },
  speedIndex: { good: 3400, poor: 5800, unit: "ms", label: "Speed Index" },
} as const;

type MetricKey = keyof typeof CWV_THRESHOLDS;

function formatMetric(key: MetricKey, value: number | null) {
  if (value === null) return "—";
  const t = CWV_THRESHOLDS[key];
  if (t.unit === "ms") return `${Math.round(value)}ms`;
  return value.toFixed(2);
}

function metricColor(key: MetricKey, value: number | null) {
  if (value === null) return "text-muted-foreground";
  const t = CWV_THRESHOLDS[key];
  if (value <= t.good) return "text-emerald-500";
  if (value <= t.poor) return "text-amber-500 dark:text-amber-400";
  return "text-destructive";
}

function getDomain(url: string) {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

export function PerformanceGauges({ data }: { data: PerformanceData }) {
  if (!data?.user?.scores) return null;

  const sites = [
    { label: getDomain(data.user.url), isUser: true, ...data.user },
    ...data.competitors.filter((c) => c.scores).map((c) => ({ label: getDomain(c.url), isUser: false, ...c })),
  ];

  return (
    <div className="space-y-6">
      {/* Score gauges */}
      {sites.map((site) => (
        <div key={site.url} className="rounded-lg border border-border bg-card/25 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={cn("text-sm font-semibold", site.isUser ? "text-primary" : "text-foreground")}>
              {site.label}
            </span>
            {site.isUser && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">You</span>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <ScoreGauge label="Performance" score={site.scores?.performance ?? null} />
            <ScoreGauge label="Accessibility" score={site.scores?.accessibility ?? null} />
            <ScoreGauge label="SEO" score={site.scores?.seo ?? null} />
            <ScoreGauge label="Best Practices" score={site.scores?.bestPractices ?? null} />
          </div>

          {site.metrics && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {(Object.keys(CWV_THRESHOLDS) as MetricKey[]).map((key) => (
                <div key={key} className="text-center">
                  <p className={cn("text-sm font-bold tabular-nums", metricColor(key, site.metrics?.[key] ?? null))}>
                    {formatMetric(key, site.metrics?.[key] ?? null)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{CWV_THRESHOLDS[key].label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

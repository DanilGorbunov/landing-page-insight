import { useMemo } from "react";
import type { ChartOptions } from "chart.js";
import "chart.js/auto";
import { Bar } from "react-chartjs-2";
import type { SectionScoreKey } from "@/lib/utils";
import { projectSectionScore } from "@/lib/insightsProjection";

const SECTION_LABELS = ["Hero", "Value Prop", "Features", "Social Proof", "CTA"] as const;
const KEYS: SectionScoreKey[] = ["hero", "value_prop", "features", "social_proof", "cta"];

function getPrimaryHex(): string {
  if (typeof document === "undefined") return "#2ed67a";
  return getComputedStyle(document.documentElement).getPropertyValue("--primary-hex").trim() || "#2ed67a";
}

/** Second bar: lighter “target” green */
const AFTER_COLOR = "rgba(94, 233, 160, 0.85)";

interface BeforeAfterScoresChartProps {
  /** Parsed user section scores; missing sections shown as 0 for chart continuity */
  userScores: Record<SectionScoreKey, number | null> | null;
  /** Same factor as overall ~90d when 0.65 */
  improvementFactor?: number;
}

export function BeforeAfterScoresChart({
  userScores,
  improvementFactor = 0.65,
}: BeforeAfterScoresChartProps) {
  const chartData = useMemo(() => {
    const now = KEYS.map((k) => {
      const v = userScores?.[k];
      return v != null && !Number.isNaN(v) ? v : 0;
    });
    const after = KEYS.map((k) => {
      const v = userScores?.[k];
      if (v == null || Number.isNaN(v)) return 0;
      return projectSectionScore(v, improvementFactor);
    });
    const primary = getPrimaryHex();
    return {
      labels: [...SECTION_LABELS],
      datasets: [
        {
          label: "Now",
          data: now,
          backgroundColor: primary,
          borderColor: primary,
          borderWidth: 0,
          borderRadius: 4,
          barThickness: 14,
        },
        {
          label: "After improvements (estimated)",
          data: after,
          backgroundColor: AFTER_COLOR,
          borderColor: AFTER_COLOR,
          borderWidth: 0,
          borderRadius: 4,
          barThickness: 14,
        },
      ],
    };
  }, [userScores, improvementFactor]);

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "x" as const,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: "rgba(255,255,255,0.65)",
            boxWidth: 10,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw as number;
              return `${ctx.dataset.label}: ${raw.toFixed(1)}/10`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "rgba(255,255,255,0.55)", maxRotation: 45, minRotation: 0, font: { size: 10 } },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, color: "rgba(255,255,255,0.45)" },
          grid: { color: "rgba(255,255,255,0.06)" },
          border: { display: false },
        },
      },
    }),
    []
  );

  return (
    <div className="w-full h-[280px] min-h-[260px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}

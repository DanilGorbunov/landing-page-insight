import { useMemo } from "react";
import { useTheme } from "next-themes";
import type { ChartOptions } from "chart.js";
import "chart.js/auto";
import { Bar } from "react-chartjs-2";
import { colorFromCssVar } from "@/lib/chartTheme";
import type { SectionScoreKey } from "@/lib/utils";
import { projectSectionScore } from "@/lib/insightsProjection";

const SECTION_LABELS = ["Hero", "Value Prop", "Features", "Social Proof", "CTA"] as const;
const KEYS: SectionScoreKey[] = ["hero", "value_prop", "features", "social_proof", "cta"];

function getPrimaryHex(): string {
  if (typeof document === "undefined") return "#7096b8";
  return getComputedStyle(document.documentElement).getPropertyValue("--primary-hex").trim() || "#7096b8";
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
  const { resolvedTheme } = useTheme();

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

  const options: ChartOptions<"bar"> = useMemo(() => {
    const tick = colorFromCssVar("--muted-foreground", "hsl(215 16% 40%)");
    const grid = colorFromCssVar("--border", "hsl(220 16% 88%)");
    const popoverBg = colorFromCssVar("--popover", "hsl(0 0% 100%)");
    const popoverFg = colorFromCssVar("--popover-foreground", "hsl(222 47% 11%)");

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "x" as const,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: tick,
            boxWidth: 10,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: popoverBg,
          titleColor: popoverFg,
          bodyColor: popoverFg,
          borderColor: grid,
          borderWidth: 1,
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
          grid: { color: grid },
          ticks: { color: tick, maxRotation: 45, minRotation: 0, font: { size: 10 } },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, color: tick },
          grid: { color: grid },
          border: { display: false },
        },
      },
    };
  }, [resolvedTheme]);

  return (
    <div className="w-full h-[280px] min-h-[260px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}

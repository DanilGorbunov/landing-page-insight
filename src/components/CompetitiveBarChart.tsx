import { useMemo } from "react";
import type { ChartOptions } from "chart.js";
import "chart.js/auto";
import { Bar } from "react-chartjs-2";
import type { RadarSite } from "./CompetitiveRadarChart";
import { getDomain } from "@/lib/utils";

const SECTION_LABELS = ["Hero", "Value Prop", "Features", "Social Proof", "CTA"] as const;
const RADAR_KEYS = ["hero", "value_prop", "features", "social_proof", "cta"] as const;

const USER_COLOR = "#00FF88";
const COMPETITOR_COLORS = ["#4B9EFF", "#FF6B6B", "#FFB347"];

interface CompetitiveBarChartProps {
  sites: RadarSite[];
  hidden: Set<number>;
  visibleSites: RadarSite[];
}

export function CompetitiveBarChart({ sites, hidden, visibleSites }: CompetitiveBarChartProps) {
  const chartData = useMemo(() => {
    const datasets = sites
      .map((site, index) => {
        if (hidden.has(index)) return null;
        const isUser = site.isUserSite;
        const color = isUser
          ? USER_COLOR
          : COMPETITOR_COLORS[(index - (sites[0]?.isUserSite ? 1 : 0)) % COMPETITOR_COLORS.length];
        return {
          label: getDomain(site.url) + (isUser ? " ← you" : ""),
          data: RADAR_KEYS.map((k) => site.scores[k]),
          backgroundColor: color,
          borderColor: color,
          borderWidth: 0,
          borderRadius: 4,
          barThickness: 8,
        };
      })
      .filter(Boolean) as NonNullable<ReturnType<typeof sites.map>>[number][];
    return {
      labels: [...SECTION_LABELS],
      datasets,
    };
  }, [sites, hidden]);

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 0, right: 0 },
      },
      animation: {
        duration: 600,
      },
      scales: {
        x: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            display: false,
          },
          grid: {
            color: "rgba(255,255,255,0.06)",
          },
          border: { display: false },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            color: "rgba(255,255,255,0.5)",
            font: { size: 11 },
            crossAlign: "far",
            padding: 8,
          },
          border: { display: false },
          barThickness: 8,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          callbacks: {
            label(ctx) {
              const site = visibleSites[ctx.datasetIndex];
              if (!site) return "";
              const section = SECTION_LABELS[ctx.dataIndex];
              const raw = ctx.parsed as { x?: number };
              const value = raw?.x ?? 0;
              return `${getDomain(site.url)} — ${section}: ${value}/10`;
            },
          },
        },
      },
    }),
    [visibleSites]
  );

  if (sites.length === 0) return null;

  return (
    <div className="w-full h-[320px]">
      <Bar data={chartData} options={options} />
    </div>
  );
}

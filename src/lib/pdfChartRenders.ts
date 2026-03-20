/**
 * Renders Chart.js charts off-DOM as PNG data URLs for PDF export (light theme for print).
 */
import Chart from "chart.js/auto";
import type { ChartConfiguration } from "chart.js";
import { buildRadarSites, type RadarSite } from "@/components/CompetitiveRadarChart";
import { getDomain, parseSectionScores, type SectionScoreKey, hasFullSectionScores } from "@/lib/utils";
import { projectSectionScore } from "@/lib/insightsProjection";
import type { AnalysisResult } from "@/types/api";

const RADAR_LABELS = ["Hero", "Value Prop", "Features", "Social Proof", "CTA"] as const;
const RADAR_KEYS: SectionScoreKey[] = ["hero", "value_prop", "features", "social_proof", "cta"];

const PDF_GRID = "rgba(0,0,0,0.12)";
const PDF_TICK = "#444444";
const PDF_LEGEND = "#333333";

function getPrimaryHexPdf(): string {
  if (typeof document === "undefined") return "#16a34a";
  return getComputedStyle(document.documentElement).getPropertyValue("--primary-hex").trim() || "#16a34a";
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const COMPETITOR_RGBA = [
  "rgba(37, 99, 235, 0.55)",
  "rgba(220, 38, 38, 0.5)",
  "rgba(234, 88, 12, 0.55)",
];

const chartAreaWhiteBg = {
  id: "pdfWhiteBg",
  beforeDraw(chart: Chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
    ctx.restore();
  },
};

function destroyChart(chart: Chart | null): void {
  if (chart) {
    try {
      chart.destroy();
    } catch {
      /* noop */
    }
  }
}

function renderToPng(config: ChartConfiguration, width: number, height: number): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let chart: Chart | null = null;
  try {
    chart = new Chart(ctx, {
      ...config,
      plugins: [...(config.plugins ?? []), chartAreaWhiteBg],
      options: {
        ...config.options,
        animation: false,
        responsive: false,
        maintainAspectRatio: false,
      },
    });
    chart.update("none");
    return chart.toBase64Image("image/png", 1);
  } catch {
    return null;
  } finally {
    destroyChart(chart);
  }
}

function buildRadarData(sites: RadarSite[]) {
  const hidden = new Set<number>();
  const userHex = getPrimaryHexPdf();
  const datasets = sites
    .map((site, index) => {
      if (hidden.has(index)) return null;
      const isUser = site.isUserSite;
      const color = isUser
        ? userHex
        : COMPETITOR_RGBA[(index - (sites[0]?.isUserSite ? 1 : 0)) % COMPETITOR_RGBA.length];
      return {
        label: getDomain(site.url) + (isUser ? " (you)" : ""),
        data: RADAR_KEYS.map((k) => site.scores[k]),
        borderColor: color,
        backgroundColor: isUser ? hexToRgba(userHex, 0.12) : "transparent",
        borderWidth: isUser ? 2.5 : 1.5,
        pointRadius: isUser ? 4 : 3,
        pointBackgroundColor: color,
        pointBorderColor: color,
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof sites.map>>[number][];
  return { labels: [...RADAR_LABELS], datasets };
}

function buildBarData(sites: RadarSite[]) {
  const hidden = new Set<number>();
  const userHex = getPrimaryHexPdf();
  const competitorHex = ["#2563eb", "#dc2626", "#ea580c"];
  const datasets = sites
    .map((site, index) => {
      if (hidden.has(index)) return null;
      const isUser = site.isUserSite;
      const color = isUser
        ? userHex
        : competitorHex[(index - (sites[0]?.isUserSite ? 1 : 0)) % competitorHex.length];
      return {
        label: getDomain(site.url) + (isUser ? " (you)" : ""),
        data: RADAR_KEYS.map((k) => site.scores[k]),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        borderRadius: 4,
        barThickness: 10,
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof sites.map>>[number][];
  return { labels: [...RADAR_LABELS], datasets };
}

export function renderCompetitiveRadarPng(
  userUrl: string,
  userAnalysis: Record<string, string> | undefined,
  competitors: AnalysisResult["competitors"]
): string | null {
  const sites = buildRadarSites(userUrl, userAnalysis, competitors);
  if (sites.length === 0) return null;
  const data = buildRadarData(sites);
  const config: ChartConfiguration<"radar"> = {
    type: "radar",
    data,
    options: {
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            color: PDF_TICK,
            font: { size: 11 },
            backdropColor: "transparent",
          },
          grid: { color: PDF_GRID },
          pointLabels: { color: PDF_TICK, font: { size: 11 } },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { color: PDF_LEGEND, font: { size: 10 }, boxWidth: 12 },
        },
      },
    },
  };
  return renderToPng(config as ChartConfiguration, 720, 520);
}

export function renderCompetitiveBarPng(
  userUrl: string,
  userAnalysis: Record<string, string> | undefined,
  competitors: AnalysisResult["competitors"]
): string | null {
  const sites = buildRadarSites(userUrl, userAnalysis, competitors);
  if (sites.length === 0) return null;
  const data = buildBarData(sites);
  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data,
    options: {
      indexAxis: "y",
      scales: {
        x: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, color: PDF_TICK, font: { size: 10 } },
          grid: { color: PDF_GRID },
          border: { display: false },
        },
        y: {
          ticks: { color: PDF_TICK, font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { color: PDF_LEGEND, font: { size: 10 }, boxWidth: 12 },
        },
      },
    },
  };
  return renderToPng(config as ChartConfiguration, 720, 480);
}

export function renderBeforeAfterBarPng(
  userScores: Record<SectionScoreKey, number | null> | null,
  improvementFactor = 0.65
): string | null {
  if (!userScores) return null;
  const now = RADAR_KEYS.map((k) => {
    const v = userScores[k];
    return v != null && !Number.isNaN(v) ? v : 0;
  });
  const after = RADAR_KEYS.map((k) => {
    const v = userScores[k];
    if (v == null || Number.isNaN(v)) return 0;
    return projectSectionScore(v, improvementFactor);
  });
  const primary = getPrimaryHexPdf();
  const afterColor = "rgba(22, 163, 74, 0.75)";
  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: [...RADAR_LABELS],
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
          backgroundColor: afterColor,
          borderColor: afterColor,
          borderWidth: 0,
          borderRadius: 4,
          barThickness: 14,
        },
      ],
    },
    options: {
      indexAxis: "x",
      scales: {
        x: {
          grid: { color: PDF_GRID },
          ticks: { color: PDF_TICK, font: { size: 10 } },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 10,
          ticks: { stepSize: 2, color: PDF_TICK },
          grid: { color: PDF_GRID },
          border: { display: false },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: PDF_LEGEND, font: { size: 10 }, boxWidth: 12 },
        },
      },
    },
  };
  return renderToPng(config as ChartConfiguration, 720, 420);
}

/** Optional: quick check if bar/radar can render */
export function canRenderCompetitiveCharts(
  userUrl: string,
  userAnalysis: Record<string, string> | undefined,
  competitors: AnalysisResult["competitors"]
): boolean {
  return buildRadarSites(userUrl, userAnalysis, competitors).length > 0;
}

export function canRenderBeforeAfter(userAnalysis: Record<string, string> | undefined): boolean {
  const s = parseSectionScores(userAnalysis);
  return s != null && hasFullSectionScores(s);
}

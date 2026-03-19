import { useMemo, useState, useCallback } from "react";
import type { ChartOptions } from "chart.js";
import "chart.js/auto";
import { Radar } from "react-chartjs-2";
import { motion } from "framer-motion";
import type { SectionScoreKey } from "@/lib/utils";
import { getDomain, parseSectionScores, hasFullSectionScores } from "@/lib/utils";

const RADAR_LABELS: readonly string[] = ["Hero", "Value Prop", "Features", "Social Proof", "CTA"];
const RADAR_KEYS: SectionScoreKey[] = ["hero", "value_prop", "features", "social_proof", "cta"];

function getPrimaryHex(): string {
  if (typeof document === "undefined") return "#2ed67a";
  return getComputedStyle(document.documentElement).getPropertyValue("--primary-hex").trim() || "#2ed67a";
}
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
const COMPETITOR_COLORS = [
  "rgba(75, 158, 255, 0.6)",
  "rgba(255, 107, 107, 0.6)",
  "rgba(255, 179, 71, 0.6)",
];

export interface RadarSite {
  url: string;
  isUserSite: boolean;
  scores: Record<SectionScoreKey, number>;
}

export function buildRadarSites(
  userUrl: string,
  userAnalysis: Record<string, string> | undefined,
  competitors: Array<{ url: string; analysis: Record<string, string> }> | undefined
): RadarSite[] {
  const sites: RadarSite[] = [];
  const userScores = parseSectionScores(userAnalysis);
  if (userScores && hasFullSectionScores(userScores)) {
    sites.push({
      url: userUrl,
      isUserSite: true,
      scores: userScores as Record<SectionScoreKey, number>,
    });
  }
  (competitors ?? []).forEach((c) => {
    const scores = parseSectionScores(c.analysis);
    if (scores && hasFullSectionScores(scores)) {
      sites.push({
        url: c.url,
        isUserSite: false,
        scores: scores as Record<SectionScoreKey, number>,
      });
    }
  });
  return sites;
}

interface CompetitiveRadarChartPropsStandalone {
  userUrl: string;
  userAnalysis: Record<string, string> | undefined;
  competitors: Array<{ url: string; analysis: Record<string, string> }> | undefined;
  /** When provided, chart is controlled: uses these and does not render legend */
  sites?: never;
  hidden?: never;
  onToggleVisibility?: never;
  visibleSites?: never;
}

interface CompetitiveRadarChartPropsControlled {
  userUrl?: never;
  userAnalysis?: never;
  competitors?: never;
  sites: RadarSite[];
  hidden: Set<number>;
  onToggleVisibility?: (index: number) => void;
  /** If set (1–5), only first N radar axes use real values; rest are 0 for progressive reveal. */
  progressiveAxisCount?: number;
}

type CompetitiveRadarChartProps = CompetitiveRadarChartPropsStandalone | CompetitiveRadarChartPropsControlled;

function isControlled(props: CompetitiveRadarChartProps): props is CompetitiveRadarChartPropsControlled {
  return "sites" in props && props.sites != null;
}

export function CompetitiveRadarChart(props: CompetitiveRadarChartProps) {
  const standaloneSites = useMemo(
    () =>
      !isControlled(props)
        ? buildRadarSites(props.userUrl, props.userAnalysis, props.competitors)
        : [],
    [props]
  );
  const [standaloneHidden, setStandaloneHidden] = useState<Set<number>>(() => new Set());

  const toggleStandalone = useCallback((index: number) => {
    setStandaloneHidden((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const sites = isControlled(props) ? props.sites : standaloneSites;
  const hidden = isControlled(props) ? props.hidden : standaloneHidden;
  const visibleSites = useMemo(() => sites.filter((_, i) => !hidden.has(i)), [sites, hidden]);
  const showLegend = !isControlled(props);
  const onToggle = isControlled(props) ? props.onToggleVisibility : toggleStandalone;

  const axisReveal =
    isControlled(props) && props.progressiveAxisCount != null
      ? Math.min(5, Math.max(0, props.progressiveAxisCount))
      : 5;

  const chartData = useMemo(() => {
    const datasets = sites
      .map((site, index) => {
        if (hidden.has(index)) return null;
        const isUser = site.isUserSite;
        const userHex = getPrimaryHex();
        const color = isUser ? userHex : COMPETITOR_COLORS[(index - (sites[0]?.isUserSite ? 1 : 0)) % COMPETITOR_COLORS.length];
        return {
          label: getDomain(site.url) + (isUser ? " ← you" : ""),
          data: RADAR_KEYS.map((k, i) => (i < axisReveal ? site.scores[k] : 0)),
          borderColor: color,
          backgroundColor: isUser ? hexToRgba(userHex, 0.08) : "transparent",
          borderWidth: isUser ? 2.5 : 1.5,
          pointRadius: isUser ? 4 : 3,
          pointBackgroundColor: color,
          pointBorderColor: color,
          pointHoverRadius: isUser ? 5 : 4,
        };
      })
      .filter(Boolean) as NonNullable<ReturnType<typeof sites.map>>[number][];
    return {
      labels: [...RADAR_LABELS],
      datasets,
    };
  }, [sites, hidden, axisReveal]);

  const options: ChartOptions<"radar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
      },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            callback(value) {
              return value === 10 ? "10" : value;
            },
            color: "rgba(255,255,255,0.58)",
            font: { size: 11 },
            backdropColor: "transparent",
          },
          grid: {
            color: "rgba(255,255,255,0.1)",
          },
          pointLabels: {
            color: "rgba(255,255,255,0.58)",
            font: { size: 11 },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const site = visibleSites[ctx.datasetIndex];
              if (!site) return "";
              const label = RADAR_LABELS[ctx.dataIndex];
              const raw = ctx.parsed as { r?: number } | number;
              const value = typeof raw === "number" ? raw : raw?.r ?? 0;
              return `${getDomain(site.url)} — ${label}: ${value}/10`;
            },
          },
        },
      },
    }),
    [visibleSites]
  );

  if (sites.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-[600px] mx-auto"
    >
      <div className="h-[320px] w-full">
        <Radar data={chartData} options={options} />
      </div>
      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
          {sites.map((site, index) => {
            const isUser = site.isUserSite;
            const colorHex = isUser ? getPrimaryHex() : ["#4B9EFF", "#FF6B6B", "#FFB347"][(index - (sites[0]?.isUserSite ? 1 : 0)) % 3];
            const isHidden = hidden.has(index);
            return (
              <button
                key={site.url}
                type="button"
                onClick={() => onToggle?.(index)}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                  style={{
                    backgroundColor: isHidden ? "transparent" : colorHex,
                  }}
                />
                <span className={isHidden ? "line-through opacity-70" : ""}>
                  {getDomain(site.url)}
                  {isUser ? " ← you" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

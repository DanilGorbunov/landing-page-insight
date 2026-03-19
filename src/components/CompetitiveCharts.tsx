import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { getDomain } from "@/lib/utils";
import { buildRadarSites, CompetitiveRadarChart } from "./CompetitiveRadarChart";
import { CompetitiveBarChart } from "./CompetitiveBarChart";

function getPrimaryHex(): string {
  if (typeof document === "undefined") return "#2ed67a";
  return getComputedStyle(document.documentElement).getPropertyValue("--primary-hex").trim() || "#2ed67a";
}
const COMPETITOR_COLOR_HEX = ["#4B9EFF", "#FF6B6B", "#FFB347"];

const CHART_TITLE_CLASS = "text-[11px] text-muted-foreground uppercase mb-3";
const CHART_TITLE_STYLE = { letterSpacing: "0.08em" as const };

interface CompetitiveChartsProps {
  userUrl: string;
  userAnalysis: Record<string, string> | undefined;
  competitors: Array<{ url: string; analysis: Record<string, string> }> | undefined;
}

export function CompetitiveCharts({ userUrl, userAnalysis, competitors }: CompetitiveChartsProps) {
  const sites = useMemo(
    () => buildRadarSites(userUrl, userAnalysis, competitors),
    [userUrl, userAnalysis, competitors]
  );
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());

  const toggleVisibility = useCallback((index: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const visibleSites = useMemo(() => sites.filter((_, i) => !hidden.has(i)), [sites, hidden]);

  if (sites.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-[1200px] mx-auto"
    >
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
        style={{ gap: "24px" }}
      >
        <div className="flex flex-col items-center md:items-end w-full min-w-0">
          <span className={CHART_TITLE_CLASS} style={CHART_TITLE_STYLE}>Competitive Shape</span>
          <div className="w-full max-w-[600px] h-[320px]">
            <CompetitiveRadarChart
              sites={sites}
              hidden={hidden}
              onToggleVisibility={toggleVisibility}
            />
          </div>
        </div>
        <div className="flex flex-col items-center md:items-start w-full min-w-0">
          <span className={CHART_TITLE_CLASS} style={CHART_TITLE_STYLE}>Section Breakdown</span>
          <div className="w-full max-w-[600px] h-[320px]">
            <CompetitiveBarChart
              sites={sites}
              hidden={hidden}
              visibleSites={visibleSites}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
        {sites.map((site, index) => {
          const isUser = site.isUserSite;
          const colorHex = isUser
            ? getPrimaryHex()
            : COMPETITOR_COLOR_HEX[(index - (sites[0]?.isUserSite ? 1 : 0)) % 3];
          const isHidden = hidden.has(index);
          return (
            <button
              key={site.url}
              type="button"
              onClick={() => toggleVisibility(index)}
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
    </motion.div>
  );
}

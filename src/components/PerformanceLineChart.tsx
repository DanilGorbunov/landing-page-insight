import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceScores } from "@/types/api";

const CATEGORIES = ["Performance", "Accessibility", "SEO", "Best Practices"] as const;

function scoresAtIndex(scores: PerformanceScores | null | undefined, index: number): number | null {
  if (!scores) return null;
  const vals = [scores.performance, scores.accessibility, scores.seo, scores.bestPractices];
  return vals[index] ?? null;
}

const FALLBACK_COLORS = ["hsl(var(--primary))", "#60a5fa", "#f97316", "#a78bfa"];

type SiteRow = { label: string; isUser: boolean; scores: PerformanceScores | null };

export function PerformanceLineChart({ sites }: { sites: SiteRow[] }) {
  const { data, keys, anyValue } = useMemo(() => {
    const keysInner = sites.map((_, i) => `s${i}`);
    const rows = CATEGORIES.map((name, catIdx) => {
      const row: Record<string, string | number | null> = { name };
      sites.forEach((site, i) => {
        row[keysInner[i]] = scoresAtIndex(site.scores, catIdx);
      });
      return row;
    });
    const anyValueInner = rows.some((row) =>
      keysInner.some((k) => row[k] != null && typeof row[k] === "number")
    );
    return { data: rows, keys: keysInner, anyValue: anyValueInner };
  }, [sites]);

  if (!anyValue) {
    return null;
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card/30 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Lighthouse categories (0–100)
      </h3>
      <div className="h-[min(320px,50vh)] w-full min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis
              domain={[0, 100]}
              width={36}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number | string) => [value == null || Number.isNaN(value as number) ? "—" : value, ""]}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {keys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={sites[i]?.label ?? key}
                stroke={sites[i]?.isUser ? "hsl(var(--primary))" : FALLBACK_COLORS[(i + 1) % FALLBACK_COLORS.length]}
                strokeWidth={sites[i]?.isUser ? 2.5 : 2}
                dot={{ r: sites[i]?.isUser ? 4 : 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

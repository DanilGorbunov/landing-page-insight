import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  RefreshCw,
  Eye,
  Users,
  Trophy,
  Target,
  Lightbulb,
  PenTool,
  ChevronLeft,
  ChevronRight,
  Plus,
  History,
  Sparkles,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { cn, getDomain } from "@/lib/utils";
import type { AnalysisResult } from "@/types/api";

// ─── Nav config (shared by /full-insights and /history) ────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "MAIN" },
  { id: "compare", label: "Compare", icon: RefreshCw, group: "MAIN" },
  { id: "performance", label: "Performance", icon: BarChart3, group: "MAIN" },
  { id: "history", label: "History", icon: History, group: "MAIN" },
  { id: "actions", label: "Action Plan", icon: Target, group: "ACTION" },
  { id: "copy", label: "Copy Ideas", icon: PenTool, group: "ACTION" },
  { id: "hints", label: "UX Hints", icon: Lightbulb, group: "ACTION" },
  { id: "competitors", label: "Competitors", icon: Users, group: "COMPETE" },
  { id: "beat", label: "Beat Competitors", icon: Trophy, group: "COMPETE" },
  { id: "monitor", label: "Monitor", icon: Eye, group: "COMPETE" },
];

const NAV_GROUPS = ["MAIN", "ACTION", "COMPETE"];

function perfScore(result: AnalysisResult): number | null {
  return result.performance?.user?.scores?.performance ?? null;
}

function getNavBadge(
  id: string,
  result: AnalysisResult | null,
  historyCount: number
): { text: string; variant: "good" | "warn" | "bad" } | null {
  if (id === "history") {
    if (historyCount <= 0) return null;
    return { text: String(historyCount), variant: "good" };
  }
  if (!result) return null;
  if (id === "performance") {
    const s = perfScore(result);
    if (s == null) return null;
    return { text: String(s), variant: s >= 70 ? "good" : s >= 50 ? "warn" : "bad" };
  }
  if (id === "competitors") {
    const n = result.competitors?.length ?? 0;
    if (!n) return null;
    return { text: `${n}`, variant: "good" };
  }
  return null;
}

export interface DashboardNavSidebarProps {
  /** Active nav id: section id on dashboard, or `"history"` on /history. */
  activeNavId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** When set, shows domain + score in the sidebar; otherwise a short hint. */
  reportContext: { url: string; overallScore: number; createdAt?: string } | null;
  /** When true with `reportContext`, show Upgrade in the sidebar (moved from report header). Default true. */
  showUpgrade?: boolean;
  /** Full report for section badges (performance, competitors). Null on /history if no session. */
  result: AnalysisResult | null;
  historyCount: number;
  onNewAnalysis: () => void;
}

export function DashboardNavSidebar({
  activeNavId,
  onSelect,
  collapsed,
  onToggleCollapse,
  reportContext,
  showUpgrade = true,
  result,
  historyCount,
  onNewAnalysis,
}: DashboardNavSidebarProps) {
  const domain = reportContext ? getDomain(reportContext.url) : null;
  const overallScore = reportContext?.overallScore ?? null;
  const createdAt = reportContext?.createdAt;
  const createdLabel =
    createdAt != null && createdAt !== ""
      ? new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null;
  const scoreColor =
    overallScore != null
      ? overallScore >= 7.5
        ? "text-primary"
        : overallScore >= 5
          ? "text-amber-500"
          : "text-red-500"
      : "";

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 h-full border-r border-border bg-card transition-all duration-200 overflow-hidden",
        collapsed ? "w-14" : "w-52"
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border px-3 gap-2", !collapsed && "justify-between")}>
        {!collapsed && (
          <Link to="/" className="font-bold text-sm text-primary tracking-tight truncate">
            LandingLens
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 py-3 border-b border-border shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Analysing</p>
          {domain != null && overallScore != null ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground truncate">{domain}</p>
              <span className={cn("text-sm font-bold tabular-nums shrink-0", scoreColor)}>{overallScore.toFixed(1)}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-snug">Open a report to see your latest score here.</p>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide" aria-label="Dashboard sections">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              {!collapsed && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 border-t border-border/60 first:border-t-0 first:pt-2">
                  {group}
                </p>
              )}
              {collapsed && <div className="my-1 mx-3 h-px bg-border/50 first:hidden" />}
              {items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeNavId}
                  collapsed={collapsed}
                  onSelect={onSelect}
                  badge={getNavBadge(item.id, result, historyCount)}
                />
              ))}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border py-2">
        <SidebarAction icon={Plus} label="New Analysis" collapsed={collapsed} onClick={onNewAnalysis} />
      </div>
    </aside>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onSelect,
  badge,
}: {
  item: NavItem;
  active: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
  badge: { text: string; variant: "good" | "warn" | "bad" } | null;
}) {
  const Icon = item.icon;
  const isActive = active === item.id;
  const badgeColor = badge
    ? badge.variant === "good"
      ? "bg-primary/15 text-primary"
      : badge.variant === "warn"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-red-500/15 text-red-600 dark:text-red-400"
    : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      title={collapsed ? item.label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
        isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {badge && (
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold", badgeColor)}>{badge.text}</span>
          )}
        </>
      )}
    </button>
  );
}

function SidebarAction({
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

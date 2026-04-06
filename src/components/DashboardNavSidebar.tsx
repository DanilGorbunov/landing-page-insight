import { Fragment } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { CompareHeaderSiteTabs } from "@/components/CompareDecisionPanels";
import { ThemeToggle } from "@/components/theme-toggle";
import type { CompareSiteTab } from "@/lib/compareDecisionMetrics";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/types/api";

// ─── Nav config (shared by /full-insights and /history) ────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "compare", label: "Compare", icon: RefreshCw, group: "MAIN" },
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "MAIN" },
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
  /** When set, used for Upgrade / created date; URL and score are not shown in the nav chrome. */
  reportContext: { url: string; overallScore: number; createdAt?: string } | null;
  /** When true with `reportContext`, show Upgrade in the sidebar (moved from report header). Default true. */
  showUpgrade?: boolean;
  /** Full report for section badges (performance, competitors). Null on /history if no session. */
  result: AnalysisResult | null;
  historyCount: number;
  onNewAnalysis: () => void;
  /** Full-insights Compare: site pills under Compare nav (same behavior as former header tabs). */
  compareSiteTabs?: {
    sites: CompareSiteTab[];
    activeIdx: number;
    onSelect: (i: number) => void;
    analysisResult: AnalysisResult | null;
  } | null;
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
  compareSiteTabs = null,
}: DashboardNavSidebarProps) {
  const createdAt = reportContext?.createdAt;
  const createdLabel =
    createdAt != null && createdAt !== ""
      ? new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null;

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 h-full border-r border-border bg-card transition-all duration-200 overflow-hidden",
        collapsed ? "w-14" : "w-52"
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center px-3 gap-2", !collapsed && "justify-between")}>
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

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide" aria-label="Dashboard sections">
        {NAV_GROUPS.map((group, groupIdx) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className={cn(groupIdx > 0 && "mt-2")}>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <NavButton
                    item={item}
                    active={activeNavId}
                    collapsed={collapsed}
                    onSelect={onSelect}
                    badge={getNavBadge(item.id, result, historyCount)}
                  />
                  {item.id === "compare" &&
                    compareSiteTabs &&
                    compareSiteTabs.sites.length > 0 &&
                    activeNavId === "compare" && (
                      <div
                        className={cn(
                          "mb-1.5 mt-0.5",
                          collapsed ? "px-0.5" : "ml-3 pl-2 pr-1.5"
                        )}
                      >
                        <CompareHeaderSiteTabs
                          sites={compareSiteTabs.sites}
                          activeIdx={Math.min(
                            compareSiteTabs.activeIdx,
                            Math.max(0, compareSiteTabs.sites.length - 1)
                          )}
                          onSelect={compareSiteTabs.onSelect}
                          analysisResult={compareSiteTabs.analysisResult}
                          orientation="vertical"
                          density={collapsed ? "compact" : "default"}
                        />
                      </div>
                    )}
                </Fragment>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 px-2 py-2 space-y-2">
        {!collapsed && createdLabel && (
          <p className="px-1 text-[11px] text-muted-foreground tabular-nums" title="Report created">
            Created {createdLabel}
          </p>
        )}
        {collapsed && createdLabel && (
          <p className="sr-only">Created {createdLabel}</p>
        )}
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "flex-col" : "flex-row",
            !collapsed && (showUpgrade && reportContext ? "justify-stretch" : "justify-end")
          )}
        >
          {showUpgrade && reportContext && (
            <Link
              to="/pricing"
              state={{ fromReport: true }}
              title="Upgrade"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-500/45 bg-amber-500/12 font-semibold text-amber-950 dark:text-amber-100 hover:bg-amber-500/20 transition-colors shrink-0",
                collapsed ? "h-9 w-9 p-0" : "flex-1 min-w-0 px-3 py-2 text-xs"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">Upgrade</span>}
            </Link>
          )}
          <ThemeToggle className={cn("shrink-0", collapsed && "h-9 w-9")} />
        </div>
      </div>

      <div className="shrink-0 py-2">
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

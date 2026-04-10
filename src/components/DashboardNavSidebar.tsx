import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, RefreshCw, BarChart3, Eye, Plus, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/types/api";

// ─── Nav config — always narrow (icon rail); labels via `title` ─────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

const COMPARE_NAV_ITEM: NavItem = { id: "compare", label: "Compare", icon: RefreshCw, group: "MAIN" };

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: BarChart3, group: "MAIN" },
  { id: "monitor", label: "Monitor", icon: Eye, group: "COMPETE" },
];

const NAV_GROUPS = ["MAIN", "COMPETE"];

const COMPARE_NAV_ITEM_SWAPPED: NavItem = {
  ...COMPARE_NAV_ITEM,
  icon: LayoutDashboard,
};

export interface DashboardNavSidebarProps {
  activeNavId: string;
  /** Build destination for each nav id (compare, overview, monitor, …). */
  resolveNavHref: (id: string) => string;
  /** Match prior audit URL updates — use `true` on the audit dashboard only. */
  sidebarNavReplace?: boolean;
  reportContext: { url: string; overallScore: number; createdAt?: string } | null;
  result: AnalysisResult | null;
  onNewAnalysis: () => void;
  hideSidebarNewAnalysis?: boolean;
}

export function DashboardNavSidebar({
  activeNavId,
  resolveNavHref,
  sidebarNavReplace = false,
  reportContext,
  onNewAnalysis,
  hideSidebarNewAnalysis = false,
}: DashboardNavSidebarProps) {
  const createdAt = reportContext?.createdAt;
  const createdLabel =
    createdAt != null && createdAt !== ""
      ? new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null;

  return (
    <aside className="relative z-10 flex h-full min-h-0 w-14 flex-shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900 text-zinc-100 dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900">
      <div className="flex h-14 shrink-0 items-center justify-center px-1">
        <Link
          to="/"
          title="LandingLens — Home"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-zinc-100 transition-colors hover:bg-zinc-800 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          LL
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2 scrollbar-hide" aria-label="Dashboard sections">
        <div className="mb-1 px-1">
          <Fragment key="compare-pinned">
            <NavItemLink
              item={COMPARE_NAV_ITEM_SWAPPED}
              active={activeNavId}
              to={resolveNavHref(COMPARE_NAV_ITEM_SWAPPED.id)}
              replace={sidebarNavReplace}
            />
          </Fragment>
        </div>
        {NAV_GROUPS.map((group, groupIdx) => {
          const items = NAV_ITEMS.filter((n) => n.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className={cn("px-1", groupIdx > 0 && "mt-2")}>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <NavItemLink
                    item={item}
                    active={activeNavId}
                    to={resolveNavHref(item.id)}
                    replace={sidebarNavReplace}
                  />
                </Fragment>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-2 px-1 py-2">
        {createdLabel && <p className="sr-only">Report created {createdLabel}</p>}
        <div className="flex flex-col items-center gap-2">
          <ThemeToggle className="h-9 w-9 shrink-0 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 dark:text-zinc-700 dark:hover:bg-zinc-200 dark:hover:text-zinc-900" />
        </div>
      </div>

      {!hideSidebarNewAnalysis && (
        <div className="shrink-0 px-1 py-2">
          <SidebarAction icon={Plus} label="New Analysis" onClick={onNewAnalysis} />
        </div>
      )}
    </aside>
  );
}

function NavItemLink({
  item,
  active,
  to,
  replace,
}: {
  item: NavItem;
  active: string;
  to: string;
  replace: boolean;
}) {
  const navigate = useNavigate();
  const Icon = item.icon;
  const isActive = active === item.id;

  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      onClick={() => navigate(to, replace ? { replace: true } : undefined)}
      className={cn(
        "relative mb-0.5 flex h-10 w-full touch-manipulation cursor-pointer items-center justify-center rounded-lg text-sm transition-colors",
        isActive
          ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-300 dark:text-zinc-900"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
    </button>
  );
}

function SidebarAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex h-10 w-full items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
    </button>
  );
}

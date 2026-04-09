import { Fragment } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  RefreshCw,
  Eye,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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
  { id: "overview", label: "Overview", icon: RefreshCw, group: "MAIN" },
  { id: "monitor", label: "Monitor", icon: Eye, group: "COMPETE" },
];

const NAV_GROUPS = ["MAIN", "COMPETE"];

const COMPARE_NAV_ITEM_SWAPPED: NavItem = {
  ...COMPARE_NAV_ITEM,
  icon: LayoutDashboard,
};

export interface DashboardNavSidebarProps {
  activeNavId: string;
  onSelect: (id: string) => void;
  reportContext: { url: string; overallScore: number; createdAt?: string } | null;
  showUpgrade?: boolean;
  result: AnalysisResult | null;
  onNewAnalysis: () => void;
  hideSidebarNewAnalysis?: boolean;
}

export function DashboardNavSidebar({
  activeNavId,
  onSelect,
  reportContext,
  showUpgrade = true,
  onNewAnalysis,
  hideSidebarNewAnalysis = false,
}: DashboardNavSidebarProps) {
  const createdAt = reportContext?.createdAt;
  const createdLabel =
    createdAt != null && createdAt !== ""
      ? new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
      : null;

  return (
    <aside className="flex h-full w-14 flex-shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900 text-zinc-100 dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900">
      <div className="flex h-14 shrink-0 items-center justify-center px-1">
        <Link
          to="/"
          title="LandingLens — Home"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-zinc-100 transition-colors hover:bg-zinc-800 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          LL
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide" aria-label="Dashboard sections">
        <div className="mb-1 px-1">
          <Fragment key="compare-pinned">
            <NavButton
              item={COMPARE_NAV_ITEM_SWAPPED}
              active={activeNavId}
              onSelect={onSelect}
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
                  <NavButton
                    item={item}
                    active={activeNavId}
                    onSelect={onSelect}
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
          {showUpgrade && reportContext && (
            <Link
              to="/pricing"
              state={{ fromReport: true }}
              title="Upgrade"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/45 bg-amber-500/15 text-amber-100 transition-colors hover:bg-amber-500/25 dark:text-amber-800"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
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

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: string;
  onSelect: (id: string) => void;
}) {
  const Icon = item.icon;
  const isActive = active === item.id;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      title={item.label}
      className={cn(
        "relative mb-0.5 flex h-10 w-full items-center justify-center rounded-lg text-sm transition-colors",
        isActive
          ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-300 dark:text-zinc-900"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
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

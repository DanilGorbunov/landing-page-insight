import type { SeoAuditData, SeoAuditItem } from "@/types/api";
import { useState } from "react";

const STATUS_ICON: Record<string, string> = {
  pass: "✅",
  warn: "⚠️",
  fail: "❌",
};

const STATUS_COLOR: Record<string, string> = {
  pass: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  fail: "text-red-600 dark:text-red-400",
};

const CATEGORIES = ["Meta", "Social", "Structure", "Content", "Technical"] as const;

function ScoreBadge({ pass, warn, fail, total }: { pass: number; warn: number; fail: number; total: number }) {
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0;
  const color = pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`text-2xl font-bold ${color}`}>{pass}/{total}</span>
      <span className="text-xs text-muted-foreground">checks passed</span>
      <span className="ml-auto flex gap-2 text-xs">
        <span className="text-green-600 dark:text-green-400">{pass} pass</span>
        <span className="text-amber-600 dark:text-amber-400">{warn} warn</span>
        <span className="text-red-600 dark:text-red-400">{fail} fail</span>
      </span>
    </div>
  );
}

function AuditRow({ item }: { item: SeoAuditItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm shrink-0">{STATUS_ICON[item.status]}</span>
        <span className="text-xs font-medium text-foreground flex-1">{item.label}</span>
        <span className={`text-[10px] ${STATUS_COLOR[item.status]} shrink-0`}>{item.status.toUpperCase()}</span>
        {(item.hint || item.value) && (
          <span className="text-[10px] text-muted-foreground ml-1">{open ? "▲" : "▼"}</span>
        )}
      </button>
      {open && (item.value || item.hint) && (
        <div className="px-3 pb-2 pl-8">
          {item.value && (
            <p className="text-[11px] text-muted-foreground mb-1">
              <span className="font-medium text-foreground/70">Value: </span>
              {item.value}
            </p>
          )}
          {item.hint && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
              💡 {item.hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SeoAuditPanel({ data }: { data: SeoAuditData }) {
  const user = data.user;
  if (!user) return null;

  const grouped = new Map<string, SeoAuditItem[]>();
  for (const cat of CATEGORIES) grouped.set(cat, []);
  for (const item of user.items) {
    const bucket = grouped.get(item.category) || [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  return (
    <div className="space-y-4">
      <ScoreBadge pass={user.passCount} warn={user.warnCount} fail={user.failCount} total={user.total} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const items = grouped.get(cat) || [];
          if (items.length === 0) return null;
          const catPass = items.filter((i) => i.status === "pass").length;
          return (
            <div key={cat} className="rounded-lg border border-border bg-card/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/20">
                <span className="text-xs font-semibold text-foreground">{cat}</span>
                <span className="text-[10px] text-muted-foreground">{catPass}/{items.length}</span>
              </div>
              <div>
                {items.map((item) => (
                  <AuditRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {data.competitors.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Competitor SEO comparison ({data.competitors.length})
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.competitors.map((comp) => (
              <div key={comp.url} className="rounded-lg border border-border bg-card/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground truncate">{comp.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  <span className="text-[10px] text-muted-foreground">{comp.passCount}/{comp.total} pass</span>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <span className="text-green-600 dark:text-green-400">{comp.passCount} ✅</span>
                  <span className="text-amber-600 dark:text-amber-400">{comp.warnCount} ⚠️</span>
                  <span className="text-red-600 dark:text-red-400">{comp.failCount} ❌</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

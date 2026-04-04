import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bell, Plus, Trash2, RefreshCw, ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Minus, Clock, Globe } from "lucide-react";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  type MonitoredSite,
} from "@/lib/monitorStore";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ScoreDisplay({ score, change }: { score?: number; change?: number }) {
  if (score == null) {
    return (
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-muted-foreground">—</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">not checked</span>
      </div>
    );
  }
  const color =
    score >= 7.5 ? "text-emerald-500" : score >= 5 ? "text-amber-500" : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn("text-2xl font-bold tabular-nums", color)}>{score.toFixed(1)}</span>
      <span className="text-[10px] text-muted-foreground">/ 10</span>
      {change != null && change !== 0 && (
        <span
          className={cn(
            "flex items-center gap-0.5 text-[11px] font-semibold",
            change > 0 ? "text-emerald-500" : "text-red-500"
          )}
        >
          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change > 0 ? "+" : ""}
          {change.toFixed(1)}
        </span>
      )}
      {change === 0 && (
        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
          <Minus className="h-3 w-3" />
          no change
        </span>
      )}
    </div>
  );
}

function SiteCard({
  site,
  onRemove,
  onRecheck,
}: {
  site: MonitoredSite;
  onRemove: (id: string) => void;
  onRecheck: (site: MonitoredSite) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-4 hover:border-primary/30 transition-colors">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground font-bold text-sm select-none">
        {site.domain.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-primary flex items-center gap-1 text-sm"
          >
            {site.domain}
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
          </a>
          {site.lastCheckedAt && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(site.lastCheckedAt)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Added {new Date(site.addedAt).toLocaleDateString()}
          {!site.lastCheckedAt && " · never checked"}
        </p>
      </div>
      <div className="shrink-0 text-center px-4">
        <ScoreDisplay score={site.lastScore} change={site.scoreChange} />
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onRecheck(site)}
          className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-check
        </button>
        <button
          type="button"
          onClick={() => onRemove(site.id)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
    </div>
  );
}

export default function MonitorPage() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [addUrl, setAddUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    setSites(getWatchlist());
  }, []);

  const handleAdd = useCallback(() => {
    const trimmed = addUrl.trim();
    if (!trimmed) {
      setAddError("Enter a URL to monitor.");
      return;
    }
    setAddError("");
    addToWatchlist(trimmed);
    setSites(getWatchlist());
    setAddUrl("");
    setShowAdd(false);
  }, [addUrl]);

  const handleRemove = useCallback((id: string) => {
    removeFromWatchlist(id);
    setSites(getWatchlist());
  }, []);

  const handleRecheck = useCallback(
    (site: MonitoredSite) => {
      navigate(`/?url=${encodeURIComponent(site.url)}`);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/90 backdrop-blur-md px-4 md:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link to="/" className="font-semibold text-primary tracking-tight">
          LandingLens
        </Link>
        <div className="flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">Monitor</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-8">
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Site Monitor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track landing pages over time. Re-check weekly to catch score drops and improvements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add site
          </button>
        </div>

        {showAdd && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-card p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Add a site to monitor</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={addUrl}
                onChange={(e) => {
                  setAddUrl(e.target.value);
                  setAddError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="https://yourdomain.com"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setAddError(""); }}
                className="rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
          </div>
        )}

        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No sites monitored yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first site to start tracking score changes over time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Add your first site
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onRemove={handleRemove}
                onRecheck={handleRecheck}
              />
            ))}
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 flex items-start gap-4">
          <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground text-sm">Weekly email alerts — coming soon</p>
            <p className="text-sm text-muted-foreground mt-1">
              We're building automated weekly checks with email notifications when your score changes
              significantly. Manual re-checks are available now.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Soon
          </span>
        </div>
      </main>
    </div>
  );
}

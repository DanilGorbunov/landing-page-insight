import { useState, useEffect } from "react";
import { ArrowLeft, Trash2, FileText } from "lucide-react";
import { getHistory, clearHistory, type HistoryEntry } from "@/lib/analysisHistory";
import { DEFAULT_SCORE } from "@/lib/utils";

const FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

function scoreColor(score: number | undefined): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 7.5) return "bg-success/20 text-success";
  if (score >= 5) return "bg-warning/20 text-warning";
  return "bg-destructive/20 text-destructive";
}

function expiresIn(expiresAt: number): { text: string; urgent: boolean } {
  const min = Math.max(0, Math.floor((expiresAt - Date.now()) / 60000));
  return {
    text: min <= 0 ? "Expired" : `Expires in ${min} min`,
    urgent: min < 10 && min > 0,
  };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

interface DashboardProps {
  onBack: () => void;
  onGoHome: () => void;
  onViewReport: (entry: HistoryEntry) => void;
  historyCount: number;
}

const Dashboard = ({ onBack, onGoHome, onViewReport, historyCount }: DashboardProps) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getHistory());
  }, [historyCount]);

  const handleClear = () => {
    clearHistory();
    setEntries([]);
  };

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <header className="sticky top-0 z-20 h-14 flex items-center border-b border-border bg-background">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 flex items-center">
          <button
            type="button"
            onClick={onBack}
            className="touch-target mr-2 sm:mr-4 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="font-sans text-lg font-medium tracking-tight text-primary mr-6 hover:opacity-90 text-left"
          >
            Landing Lens
          </button>
          <nav className="flex items-center gap-2">
            <span className="px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg bg-secondary text-foreground" aria-current="page">
              History
            </span>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1 px-4 md:px-8 py-6 sm:py-8 pb-10 sm:pb-8 max-w-6xl mx-auto w-full">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-border p-12 text-center bg-card">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No analyses yet.</p>
            <p className="text-sm text-muted-foreground/80">
              Enter a URL above to get started.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-6 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              Analyze a URL
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const exp = expiresIn(entry.expiresAt);
              return (
                <li key={entry.id}>
                  <div
                    className="flex items-center gap-4 rounded-lg p-4 transition-colors hover:bg-secondary/50 cursor-pointer border border-border bg-card"
                    onClick={() => onViewReport(entry)}
                  >
                    <img
                      src={FAVICON(entry.domain)}
                      alt=""
                      className="w-5 h-5 shrink-0"
                    />
                    <span className="font-mono text-sm text-foreground truncate flex-1 min-w-0">
                      {entry.domain}
                    </span>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${scoreColor(entry.score ?? DEFAULT_SCORE)}`}
                    >
                      {(entry.score ?? DEFAULT_SCORE).toFixed(1)}/10
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                      {formatTime(entry.analyzedAt)}
                    </span>
                    <span
                      className={`text-[10px] shrink-0 ${exp.urgent ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {exp.text}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReport(entry);
                      }}
                      className="touch-target shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View report
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {entries.length > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear history
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

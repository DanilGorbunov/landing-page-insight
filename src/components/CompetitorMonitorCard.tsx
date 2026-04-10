import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const SECTION_ROWS: { analysisKey: string; label: string }[] = [
  { analysisKey: "hero", label: "Hero" },
  { analysisKey: "value proposition", label: "Value Prop" },
  { analysisKey: "features", label: "Features" },
  { analysisKey: "social proof", label: "Social Proof" },
  { analysisKey: "CTA", label: "CTA" },
];

function parseScore10(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  return m ? parseFloat(m[1]) : null;
}

function faviconSrc(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export interface CompetitorMonitorCardProps {
  domain: string;
  url: string;
  screenshotUrl?: string | null;
  analysis: Record<string, string> | undefined;
  watching: boolean;
  onWatchChange: (checked: boolean) => void;
  lastCheckedDays: number;
}

/**
 * Competitor row on Monitor — screenshot + section scores; light `bg-card` in light theme, dark styling in dark theme.
 */
export function CompetitorMonitorCard({
  domain,
  url,
  screenshotUrl,
  analysis,
  watching,
  onWatchChange,
  lastCheckedDays,
}: CompetitorMonitorCardProps) {
  const hasShot = Boolean(screenshotUrl?.trim());

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        "dark:border-zinc-600/70 dark:bg-[#0a0a0a] dark:text-zinc-100 dark:shadow-md"
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 dark:border-zinc-800/80">
        <img
          src={faviconSrc(domain)}
          alt=""
          width={22}
          height={22}
          className="h-5 w-5 shrink-0 rounded bg-muted ring-1 ring-border dark:bg-zinc-900 dark:ring-zinc-700/80"
        />
        <div className="min-w-0 flex-1 font-mono text-[11px] leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-medium tracking-tight text-foreground dark:text-zinc-50">{domain}</p>
            {watching ? (
              <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-400">
                On
              </span>
            ) : null}
          </div>
          <p className="truncate text-[10px] text-muted-foreground dark:text-zinc-500">
            Checked · {lastCheckedDays}d ago
          </p>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <span className="hidden font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline dark:text-zinc-500">
            Watch
          </span>
          <Switch
            checked={watching}
            onCheckedChange={onWatchChange}
            aria-label={`Watch ${domain}`}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>
      </div>

      <div className="px-3 pt-2">
        <div className="overflow-hidden rounded-lg bg-muted ring-1 ring-border dark:bg-zinc-950 dark:ring-zinc-800/90">
          {hasShot ? (
            <img
              src={screenshotUrl!}
              alt={`Site preview: ${domain}`}
              className="aspect-[16/10] max-h-[100px] w-full object-cover object-top sm:max-h-[110px]"
              loading="lazy"
            />
          ) : (
            <a
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex aspect-[16/10] max-h-[100px] w-full flex-col items-center justify-center gap-1 bg-muted px-2 text-center sm:max-h-[110px] dark:bg-gradient-to-b dark:from-zinc-900 dark:to-zinc-950"
            >
              <span className="font-mono text-[10px] text-muted-foreground dark:text-zinc-500">
                No screenshot
              </span>
              <span className="font-mono text-[9px] text-amber-700 underline-offset-2 hover:underline dark:text-amber-400/90">
                Open site
              </span>
            </a>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="h-px w-full bg-border dark:bg-zinc-800/90" aria-hidden />
        <p className="mt-2 font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-zinc-500">
          Section scores
        </p>
        <ul className="mt-1.5 space-y-1 font-mono text-[10px]">
          {SECTION_ROWS.map(({ analysisKey, label }) => {
            const raw = analysis?.[analysisKey];
            const n = parseScore10(raw);
            return (
              <li key={analysisKey} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground dark:text-zinc-400">{label}</span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums text-xs font-semibold tracking-tight",
                    n != null ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground/70 dark:text-zinc-600"
                  )}
                >
                  {n != null ? n.toFixed(1) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

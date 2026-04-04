const STORAGE_KEY = "ll_monitor_watchlist";

export interface MonitoredSite {
  id: string;
  url: string;
  domain: string;
  addedAt: string;
  lastCheckedAt?: string;
  lastScore?: number;
  previousScore?: number;
  scoreChange?: number;
}

function load(): MonitoredSite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MonitoredSite[];
  } catch {
    return [];
  }
}

function save(list: MonitoredSite[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore storage errors */
  }
}

export function getWatchlist(): MonitoredSite[] {
  return load();
}

export function addToWatchlist(rawUrl: string): MonitoredSite {
  const list = load();
  const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const existing = list.find((s) => s.url === normalized);
  if (existing) return existing;
  const domain = normalized.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const entry: MonitoredSite = {
    id: crypto.randomUUID(),
    url: normalized,
    domain,
    addedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  save(list);
  return entry;
}

export function removeFromWatchlist(id: string): void {
  save(load().filter((s) => s.id !== id));
}

export function updateWatchedSite(id: string, patch: Partial<MonitoredSite>): void {
  save(load().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function recordCheckResult(id: string, score: number): void {
  const list = load();
  const site = list.find((s) => s.id === id);
  if (!site) return;
  const prev = site.lastScore;
  site.previousScore = prev;
  site.lastScore = score;
  site.scoreChange = prev != null ? parseFloat((score - prev).toFixed(1)) : undefined;
  site.lastCheckedAt = new Date().toISOString();
  save(list);
}

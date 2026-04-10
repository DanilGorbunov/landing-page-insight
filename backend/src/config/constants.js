/**
 * Backend constants: timeouts, limits, cache TTL.
 * See project README for shared constants used by both FE and BE.
 */

/** Cache analysis result per URL for this long (ms). */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Cache competitor discovery per user domain (Sonnet); skip repeat LLM calls. */
export const DISCOVERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Max competitor URLs per analysis job (manual list + discovery combined).
 * Override with env MAX_COMPETITORS (1–500). Default allows many manual adds on Compare.
 */
export const MAX_COMPETITORS = (() => {
  const raw = process.env.MAX_COMPETITORS;
  if (raw != null && raw !== "") {
    const n = Number.parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 500) return n;
  }
  return 100;
})();

/** When auto-discovery runs, total competitors = min(this, MAX_COMPETITORS) if manual list is shorter. */
export const DISCOVERY_TARGET_COMPETITORS = 3;

/** Timeout for competitor discovery (Claude + optional Tavily) in ms. */
export const DISCOVERY_TIMEOUT_MS = 15000;

/**
 * Timeout per URL for Firecrawl scrape in ms.
 * Large marketing sites (many assets / slow TTFB) often need 45–60s+.
 * Override with env SCRAPE_TIMEOUT_MS (integer milliseconds).
 */
export const SCRAPE_TIMEOUT_MS = (() => {
  const raw = process.env.SCRAPE_TIMEOUT_MS;
  if (raw != null && raw !== "") {
    const n = Number.parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 15000 && n <= 180000) return n;
  }
  return 60000;
})();

/** Timeout for pre-fetching screenshot URL to base64 in ms. */
export const PREFETCH_TIMEOUT_MS = 10000;

/** Max concurrent Vision analysis tasks across competitor scrapes. */
export const ANALYSIS_CONCURRENCY = 6;

/** Job store TTL: job data expires after this (ms). Long analyses + add-competitor reruns need headroom. */
export const JOB_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Max length of URL string to accept (avoid huge payloads). */
export const MAX_URL_LENGTH = 2048;

/**
 * Backend constants: timeouts, limits, cache TTL.
 * See project README for shared constants used by both FE and BE.
 */

/** Cache analysis result per URL for this long (ms). */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Max competitors (user + auto-discovered) per analysis. */
export const MAX_COMPETITORS = 3;

/** Timeout for competitor discovery (Tavily) in ms. */
export const DISCOVERY_TIMEOUT_MS = 8000;

/** Timeout per URL for Firecrawl scrape in ms. */
export const SCRAPE_TIMEOUT_MS = 28000;

/** Timeout for pre-fetching screenshot URL to base64 in ms. */
export const PREFETCH_TIMEOUT_MS = 10000;

/** Max concurrent Vision analysis tasks. */
export const ANALYSIS_CONCURRENCY = 4;

/** Job store TTL: job data expires after this (ms). */
export const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Max length of URL string to accept (avoid huge payloads). */
export const MAX_URL_LENGTH = 2048;

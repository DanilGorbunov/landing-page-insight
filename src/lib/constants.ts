/**
 * Frontend constants. For shared limits (e.g. max competitors) see README.
 */

/** Request timeout for API calls (ms). */
export const API_TIMEOUT_MS = 60_000;

/** GET /job polling: allow slow responses while the server is busy scraping / LLM. */
export const JOB_STATUS_POLL_TIMEOUT_MS = 120_000;

/** Poll loops give up after this many consecutive failures (transient network / 502). */
export const ANALYSIS_POLL_MAX_FAILURES = 40;

const parsedMax = Number(import.meta.env.VITE_MAX_COMPETITORS);
/** Max competitor URLs per analysis (align with backend MAX_COMPETITORS; override via VITE_MAX_COMPETITORS). */
export const MAX_COMPETITORS =
  Number.isFinite(parsedMax) && parsedMax >= 1 && parsedMax <= 500 ? Math.floor(parsedMax) : 100;

/** Class name for minimum 44px touch target (use with inline-flex items-center justify-center). */
export const TOUCH_TARGET_CLASS = "touch-target inline-flex items-center justify-center";

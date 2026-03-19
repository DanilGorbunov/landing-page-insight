/**
 * Frontend constants. For shared limits (e.g. max competitors) see README.
 */

/** Request timeout for API calls (ms). */
export const API_TIMEOUT_MS = 60_000;

/** Max competitor URLs per analysis (must match backend MAX_COMPETITORS). */
export const MAX_COMPETITORS = 3;

/** Class name for minimum 44px touch target (use with inline-flex items-center justify-center). */
export const TOUCH_TARGET_CLASS = "touch-target inline-flex items-center justify-center";

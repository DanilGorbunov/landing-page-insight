/**
 * Frontend env: all usage via import.meta.env with validation or defaults.
 * No process.env in frontend (Vite only injects VITE_* at build time).
 */

function getEnv(key: string): string {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * API base URL (no trailing slash). In dev, empty = same origin so Vite can proxy `/api` → backend :3000.
 * Override with VITE_API_BASE_URL (e.g. full Railway URL) when needed.
 */
export const VITE_API_BASE_URL =
  getEnv("VITE_API_BASE_URL") || (import.meta.env.DEV ? "" : "");

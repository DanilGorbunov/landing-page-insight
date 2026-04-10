/**
 * Frontend env: all usage via import.meta.env with validation or defaults.
 * No process.env in frontend (Vite only injects VITE_* at build time).
 */

function getEnv(key: string): string {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * API base URL (no trailing slash). Empty = same-origin `/api/...` (Vite dev proxy → backend :3002).
 * On Vercel + Railway: set `VITE_API_BASE_URL` to `https://your-service.up.railway.app` (no trailing slash).
 */
export const VITE_API_BASE_URL = getEnv("VITE_API_BASE_URL");

import { VITE_API_BASE_URL } from "@/lib/env";
import { API_TIMEOUT_MS } from "@/lib/constants";
import type { FullInsightsPayload } from "@/lib/reportSession";

function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = API_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(id));
}

/**
 * Load server-persisted audit for a hostname slug (cold open of /audit/:slug).
 */
export async function fetchSharedAuditBySlug(
  slug: string,
  signal?: AbortSignal
): Promise<FullInsightsPayload | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  const base = VITE_API_BASE_URL;
  const path = `/api/audit-share/${encodeURIComponent(key)}`;
  const url = base ? `${base}${path}` : path;
  const res = await fetchWithTimeout(url, { signal });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as FullInsightsPayload;
    if (!data?.url || !data?.result) return null;
    return data;
  } catch {
    return null;
  }
}

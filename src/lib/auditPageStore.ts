/**
 * Client-side "database" for audit pages: keyed by hostname slug (see auditSlug.ts).
 * Persists full report payloads so `/audit/:slug` can load without session-only state.
 */
import type { FullInsightsPayload } from "@/lib/reportSession";

const STORAGE_KEY = "ll_audit_pages_v1";

function readMap(): Record<string, FullInsightsPayload> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FullInsightsPayload>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, FullInsightsPayload>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/** Save or overwrite audit for this slug (hostname, lowercased, no www). */
export function saveAuditPage(slug: string, payload: FullInsightsPayload): void {
  if (!slug || !payload?.url) return;
  const key = slug.toLowerCase();
  const map = readMap();
  map[key] = payload;
  writeMap(map);
}

export function getAuditPage(slug: string): FullInsightsPayload | null {
  if (!slug) return null;
  const map = readMap();
  const key = decodeURIComponent(slug).toLowerCase();
  const hit = map[key];
  return hit && hit.result ? hit : null;
}

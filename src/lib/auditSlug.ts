import { getDomain, stripWwwFromHost } from "@/lib/utils";

/**
 * Stable path segment for `/audit/:slug` — hostname only, no `www.`, lowercased.
 * Example: `https://www.Example.com/foo` → `example.com`
 */
export function auditSlugFromUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    return stripWwwFromHost(u.hostname).toLowerCase();
  } catch {
    const d = getDomain(trimmed);
    const q = d.indexOf("/");
    const host = q >= 0 ? d.slice(0, q) : d;
    return stripWwwFromHost(host).toLowerCase();
  }
}

/** Default dashboard section — omitted from `/audit/:slug` for a clean canonical URL. */
export const DEFAULT_AUDIT_SECTION = "compare" as const;

function normalizeAuditPathQuery(search: string): string {
  const t = search.trim();
  if (!t) return "";
  const raw = t.startsWith("?") ? t.slice(1) : t;
  const p = new URLSearchParams(raw);
  if (p.get("section") === DEFAULT_AUDIT_SECTION) {
    p.delete("section");
  }
  return p.toString();
}

export function auditPathForUrl(url: string, search?: string): string {
  const slug = auditSlugFromUrl(url);
  if (!slug) return "/full-insights";
  const cleaned = search && search.length > 0 ? normalizeAuditPathQuery(search) : "";
  const q = cleaned.length > 0 ? `?${cleaned}` : "";
  return `/audit/${encodeURIComponent(slug)}${q}`;
}

/** Dashboard section link when a report URL is known (otherwise `/full-insights`). */
export function auditSectionHref(sectionId: string, reportUrl: string | null | undefined): string {
  const trimmed = (reportUrl ?? "").trim();
  const isDefault = sectionId === DEFAULT_AUDIT_SECTION;
  const q = `section=${encodeURIComponent(sectionId)}`;

  if (trimmed) {
    const slug = auditSlugFromUrl(trimmed);
    if (!slug) return isDefault ? "/full-insights" : `/full-insights?${q}`;
    if (isDefault) return auditPathForUrl(trimmed);
    return auditPathForUrl(trimmed, q);
  }
  return isDefault ? "/full-insights" : `/full-insights?${q}`;
}

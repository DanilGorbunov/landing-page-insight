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

export function auditPathForUrl(url: string, search?: string): string {
  const slug = auditSlugFromUrl(url);
  if (!slug) return "/full-insights";
  const q = search && search.length > 0 ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `/audit/${encodeURIComponent(slug)}${q}`;
}

/** Dashboard section link when a report URL is known (otherwise `/full-insights`). */
export function auditSectionHref(sectionId: string, reportUrl: string | null | undefined): string {
  if (reportUrl) return auditPathForUrl(reportUrl, `section=${encodeURIComponent(sectionId)}`);
  return `/full-insights?section=${encodeURIComponent(sectionId)}`;
}

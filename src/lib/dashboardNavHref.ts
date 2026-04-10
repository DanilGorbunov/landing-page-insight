import { FULL_INSIGHTS_SECTION_IDS } from "@/lib/dashboardNavRoutes";
import { auditSectionHref, DEFAULT_AUDIT_SECTION } from "@/lib/auditSlug";

export type DashboardNavHrefContext =
  | {
      mode: "audit";
      pathname: string;
      searchParams: URLSearchParams;
    }
  | {
      mode: "session";
      reportUrl: string | null | undefined;
    };

/** Resolve sidebar targets for Compare / Overview / Monitor / History. */
export function resolveDashboardNavHref(id: string, ctx: DashboardNavHrefContext): string {
  if (id === "history") return "/history";
  if (id === "monitor") return "/monitor";
  if (ctx.mode === "audit") {
    const next = new URLSearchParams(ctx.searchParams);
    if (id === DEFAULT_AUDIT_SECTION) {
      next.delete("section");
    } else {
      next.set("section", id);
    }
    const q = next.toString();
    return q ? `${ctx.pathname}?${q}` : ctx.pathname;
  }
  if (FULL_INSIGHTS_SECTION_IDS.has(id)) {
    return auditSectionHref(id, ctx.reportUrl);
  }
  return "/";
}

import type { AnalysisResult } from "@/types/api";
import type { SectionOrderKey } from "@/lib/compareDecisionMetrics";

/**
 * Best-effort "current HTML" for preview API — analysis text for the section (not always literal DOM).
 */
export function getSectionHtmlForPreview(result: AnalysisResult, sectionKey: SectionOrderKey): string {
  const ua = result.userAnalysis ?? {};
  switch (sectionKey) {
    case "hero":
      return String(ua.hero ?? "").trim();
    case "value proposition":
      return String(ua["value proposition"] ?? ua.value_prop ?? "").trim();
    case "CTA":
      return String(ua.cta ?? ua.CTA ?? "").trim();
    default:
      return "";
  }
}

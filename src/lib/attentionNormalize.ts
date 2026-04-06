import type { AttentionComparison, AttentionHeatmapResponse, AttentionZone, HeatmapAnalysis } from "@/types/attention";

export function normalizeZones(raw: unknown): AttentionZone[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((z: Record<string, unknown>, i) => ({
    x: Math.min(100, Math.max(0, Number(z.x) || 0)),
    y: Math.min(100, Math.max(0, Number(z.y) || 0)),
    width: Math.min(100, Math.max(2, Number(z.width) || 12)),
    height: Math.min(100, Math.max(2, Number(z.height) || 12)),
    intensity: Math.min(10, Math.max(1, Number(z.intensity) || 5)),
    element: typeof z.element === "string" ? z.element : "",
    order: Number(z.order) || i + 1,
  }));
}

function normalizeCta(raw: unknown): HeatmapAnalysis["ctaZone"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    found: Boolean(o.found),
    attentionPercent: typeof o.attentionPercent === "number" ? o.attentionPercent : null,
    order: typeof o.order === "number" ? o.order : null,
  };
}

export function normalizeHeatmapAnalysis(raw: unknown): HeatmapAnalysis {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    clarityScore: typeof o.clarityScore === "number" ? o.clarityScore : null,
    attentionScore: typeof o.attentionScore === "number" ? o.attentionScore : null,
    zones: normalizeZones(o.zones),
    eyePath: Array.isArray(o.eyePath) ? o.eyePath.map(String) : [],
    ctaZone: normalizeCta(o.ctaZone),
    topElement: typeof o.topElement === "string" ? o.topElement : null,
    weakestElement: typeof o.weakestElement === "string" ? o.weakestElement : null,
  };
}

function normalizeComparison(raw: unknown): AttentionComparison {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    summary: typeof o.summary === "string" ? o.summary : "",
    ctaAttentionYou: typeof o.ctaAttentionYou === "number" ? o.ctaAttentionYou : null,
    ctaAttentionCompetitor: typeof o.ctaAttentionCompetitor === "number" ? o.ctaAttentionCompetitor : null,
    ctaMultiplier: typeof o.ctaMultiplier === "number" ? o.ctaMultiplier : null,
    eyePath: Array.isArray(o.eyePath) ? o.eyePath.map(String) : [],
    competitorEyePath: Array.isArray(o.competitorEyePath) ? o.competitorEyePath.map(String) : [],
    keyInsight: typeof o.keyInsight === "string" ? o.keyInsight : "",
    recommendation: typeof o.recommendation === "string" ? o.recommendation : "",
  };
}

export function normalizeAttentionResponse(data: AttentionHeatmapResponse): AttentionHeatmapResponse {
  return {
    your: normalizeHeatmapAnalysis(data.your),
    competitor: normalizeHeatmapAnalysis(data.competitor),
    comparison: normalizeComparison(data.comparison),
  };
}

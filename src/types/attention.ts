/** Claude Vision attention heatmap zone (percent-based layout). */
export interface AttentionZone {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  element: string;
  order: number;
}

export interface AttentionCtaZone {
  found: boolean;
  attentionPercent: number | null;
  order: number | null;
}

export interface HeatmapAnalysis {
  clarityScore: number | null;
  attentionScore: number | null;
  zones: AttentionZone[];
  eyePath: string[];
  ctaZone?: AttentionCtaZone | null;
  topElement?: string | null;
  weakestElement?: string | null;
}

export interface AttentionComparison {
  summary: string;
  ctaAttentionYou: number | null;
  ctaAttentionCompetitor: number | null;
  ctaMultiplier: number | null;
  eyePath: string[];
  competitorEyePath: string[];
  keyInsight: string;
  recommendation: string;
}

export interface AttentionHeatmapResponse {
  your: HeatmapAnalysis;
  competitor: HeatmapAnalysis;
  comparison: AttentionComparison;
}

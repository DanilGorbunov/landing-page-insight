export type SectionPreviewChangeType = "text" | "button";

export interface SectionPreviewChange {
  type: SectionPreviewChangeType;
  x: number;
  y: number;
  width: number;
  height: number;
  newText: string;
  fontSize: number;
  fontWeight: "bold" | "normal";
  /** Text color (text blocks) */
  color: string;
  bgColor: string;
  /** Button label color */
  textColor?: string;
  borderRadius?: number;
}

export interface SectionPreviewResponse {
  headline: string | null;
  subheadline: string | null;
  ctaText: string | null;
  /** Fallback when overlay coordinates are invalid or missing */
  htmlPatch: string;
  explanation: string;
  estimatedScore: number | null;
  /** Pixel-space overlays on the section screenshot */
  changes?: SectionPreviewChange[];
  cached?: boolean;
}

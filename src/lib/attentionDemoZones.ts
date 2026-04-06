import type { AttentionZone } from "@/types/attention";

/** Placeholder heatmap while the API loads or after failure. */
export const ATTENTION_DEMO_ZONES: AttentionZone[] = [
  { x: 10, y: 5, width: 40, height: 20, intensity: 9, order: 1, element: "demo" },
  { x: 55, y: 8, width: 25, height: 15, intensity: 7, order: 2, element: "demo" },
  { x: 20, y: 30, width: 30, height: 15, intensity: 5, order: 3, element: "demo" },
  { x: 60, y: 35, width: 20, height: 10, intensity: 3, order: 4, element: "demo" },
];

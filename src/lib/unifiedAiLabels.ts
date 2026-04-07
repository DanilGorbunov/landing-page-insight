/**
 * Filters / adjusts Simulate AI label rows by Compare overlay mode so one dot → pill → card pattern applies everywhere.
 */
import type { CompareOverlayLayerMode } from "@/components/CompareDecisionPanels";
import type { AttentionZone } from "@/types/attention";
import type { SectionOrderKey } from "@/lib/compareDecisionMetrics";
import { SECTION_ORDER } from "@/lib/simulateWhatIf";
import type { SimulateAiLabelRow } from "@/lib/simulateAiLabels";

/** Vertical center of each section band (% of screenshot) — matches compare section zones. */
const SECTION_MID_PCT: Record<SectionOrderKey, number> = {
  hero: 10,
  "value proposition": 26.5,
  features: 44,
  "social proof": 62.5,
  CTA: 80,
};

function sectionMidPct(key: SectionOrderKey): number {
  return SECTION_MID_PCT[key];
}

/** Map attention zone vertical center to nearest core section band. */
export function attentionZoneToSectionKey(zone: AttentionZone): SectionOrderKey {
  const cy = Math.min(100, Math.max(0, zone.y + zone.height / 2));
  let best: SectionOrderKey = "hero";
  let bestD = 1e9;
  for (const key of SECTION_ORDER) {
    const d = Math.abs(cy - sectionMidPct(key));
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}

function zoneCenter(zone: AttentionZone): { topPct: number; leftPct: number } {
  return {
    topPct: Math.min(100, Math.max(0, zone.y + zone.height / 2)),
    leftPct: Math.min(100, Math.max(0, zone.x + zone.width / 2)),
  };
}

function takeWeakest(rows: SimulateAiLabelRow[], n: number): SimulateAiLabelRow[] {
  return [...rows].sort((a, b) => a.score - b.score).slice(0, n);
}

/**
 * Returns rows for the current overlay mode. Falls back to a few weakest sections if a filter yields none.
 */
export function buildUnifiedAiLabelRowsForMode(
  baseRows: SimulateAiLabelRow[],
  mode: CompareOverlayLayerMode,
  ctx: {
    sectionDeltaVsCompetitor: Record<string, number | null>;
    attentionZones: AttentionZone[] | null | undefined;
    annotations: Array<{ sectionKey: string; top: number; height: number; score: number | null }>;
  }
): SimulateAiLabelRow[] {
  const { sectionDeltaVsCompetitor, attentionZones, annotations } = ctx;
  const byKey = new Map<string, SimulateAiLabelRow>();
  for (const r of baseRows) byKey.set(r.sectionKey, r);

  const ensureMin = (filtered: SimulateAiLabelRow[]): SimulateAiLabelRow[] => {
    if (filtered.length > 0) return filtered;
    return takeWeakest(baseRows, Math.min(5, baseRows.length));
  };

  switch (mode) {
    case "compare":
    case "mobile":
    case "trust":
    case "readability":
      return ensureMin(baseRows.filter((r) => r.score < 8));

    case "heatmap": {
      const rows = baseRows.filter((r) => {
        const d = sectionDeltaVsCompetitor[r.sectionKey];
        return d != null && d > 0.35;
      });
      return ensureMin(rows);
    }

    case "copy":
      return ensureMin(baseRows.filter((r) => r.score < 7));

    case "conversion":
      return ensureMin(baseRows.filter((r) => r.score < 8));

    case "first5s": {
      const rows = baseRows.filter((r) => {
        const ann = annotations.find((a) => a.sectionKey === r.sectionKey);
        if (!ann) return false;
        const center = ann.top + ann.height / 2;
        return center >= 36;
      });
      return ensureMin(rows);
    }

    case "attention": {
      const zones = [...(attentionZones ?? [])].filter(Boolean);
      if (zones.length === 0) {
        return ensureMin(baseRows.filter((r) => r.score < 6.5));
      }
      const low = zones
        .filter((z) => (z.intensity ?? 5) < 6)
        .sort((a, b) => (a.intensity ?? 5) - (b.intensity ?? 5));
      const use = (low.length > 0 ? low : [...zones].sort((a, b) => (a.intensity ?? 5) - (b.intensity ?? 5))).slice(0, 8);

      const picked = new Map<SectionOrderKey, AttentionZone>();
      for (const z of use) {
        const key = attentionZoneToSectionKey(z);
        const prev = picked.get(key);
        if (!prev || (z.intensity ?? 5) < (prev.intensity ?? 5)) picked.set(key, z);
      }

      const out: SimulateAiLabelRow[] = [];
      for (const [sectionKey, zone] of picked) {
        const base = byKey.get(sectionKey);
        if (!base) continue;
        const { topPct, leftPct } = zoneCenter(zone);
        const inten = Math.round(Math.min(10, Math.max(1, zone.intensity ?? 5)) * 10) / 10;
        out.push({
          ...base,
          score: inten,
          whatISee: `Lower predicted visual attention on “${zone.element}” (${inten}/10). Visitors may not notice this area enough.`,
          topPct,
          leftPct,
        });
      }
      return ensureMin(out.length > 0 ? out : baseRows.filter((r) => r.score < 6.5));
    }

    default:
      return baseRows;
  }
}

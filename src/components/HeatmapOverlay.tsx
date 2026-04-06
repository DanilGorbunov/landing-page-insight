import type { AttentionZone } from "@/types/attention";

function gradientForIntensity(intensity: number): string {
  if (intensity >= 8) {
    return "radial-gradient(ellipse at center, rgba(255,30,0,0.7) 0%, rgba(255,100,0,0.4) 40%, transparent 70%)";
  }
  if (intensity >= 5) {
    return "radial-gradient(ellipse at center, rgba(255,200,0,0.6) 0%, rgba(255,200,0,0.28) 42%, transparent 72%)";
  }
  return "radial-gradient(ellipse at center, rgba(0,100,255,0.4) 0%, rgba(0,100,255,0.18) 42%, transparent 72%)";
}

/**
 * Full-bleed heatmap layer over the screenshot. Zones use % layout with min pixel size.
 */
export function HeatmapOverlay({ zones }: { zones: AttentionZone[] }) {
  const sorted = [...zones].filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 h-full w-full"
      style={{ zIndex: 10 }}
    >
      {sorted.map((zone, i) => (
        <div
          key={`${zone.order}-${i}`}
          className="absolute transition-opacity duration-300 ease-out"
          style={{
            left: `${Math.min(100, Math.max(0, zone.x))}%`,
            top: `${Math.min(100, Math.max(0, zone.y))}%`,
            width: `${Math.min(100, Math.max(1, zone.width))}%`,
            height: `${Math.min(100, Math.max(1, zone.height))}%`,
            minWidth: 120,
            minHeight: 80,
            borderRadius: "50%",
            background: gradientForIntensity(zone.intensity ?? 5),
            mixBlendMode: "multiply",
          }}
        >
          {zone.order != null && (
            <span
              className="absolute left-1/2 top-1/2 flex h-6 min-w-[1.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-black/40 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-sm"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
            >
              {zone.order}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

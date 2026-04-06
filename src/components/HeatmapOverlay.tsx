import { useCallback, useRef, useState } from "react";
import type { AttentionZone } from "@/types/attention";
import {
  ZoneAnchorPopup,
  ZonePortalTooltip,
  useHoverTooltipDelay,
} from "@/components/visual/VisualZoneLayers";

function gradientForIntensity(intensity: number): string {
  if (intensity >= 8) {
    return "radial-gradient(ellipse at center, rgba(255,30,0,0.7) 0%, rgba(255,100,0,0.4) 40%, transparent 70%)";
  }
  if (intensity >= 5) {
    return "radial-gradient(ellipse at center, rgba(255,200,0,0.6) 0%, rgba(255,200,0,0.28) 42%, transparent 72%)";
  }
  return "radial-gradient(ellipse at center, rgba(0,100,255,0.4) 0%, rgba(0,100,255,0.18) 42%, transparent 72%)";
}

function AttentionZoneHit({
  zone,
  onZoneMore,
}: {
  zone: AttentionZone;
  onZoneMore?: (zone: AttentionZone) => void;
}) {
  const hitRef = useRef<HTMLDivElement | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipRect, setTipRect] = useState<DOMRect | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const { show, hide } = useHoverTooltipDelay();

  const syncRect = useCallback(() => {
    if (hitRef.current) setTipRect(hitRef.current.getBoundingClientRect());
  }, []);

  const title = `🧠 ${zone.element}`;
  const lines = [
    `Estimated attention intensity ${zone.intensity ?? 5}/10`,
    zone.order != null
      ? `Scan order #${zone.order} — hotter colors draw more eye share.`
      : "Hotter colors indicate stronger predicted fixation.",
  ];

  return (
    <>
      <div
        ref={hitRef}
        className="absolute transition-opacity duration-300 ease-out pointer-events-auto cursor-pointer z-[11]"
        style={{
          left: `${Math.min(100, Math.max(0, zone.x))}%`,
          top: `${Math.min(100, Math.max(0, zone.y))}%`,
          width: `${Math.min(100, Math.max(1, zone.width))}%`,
          height: `${Math.min(100, Math.max(1, zone.height))}%`,
          minWidth: 120,
          minHeight: 80,
          borderRadius: "50%",
        }}
        onMouseEnter={() => {
          show(() => {
            syncRect();
            setTipOpen(true);
          });
        }}
        onMouseLeave={() => {
          hide(() => {
            setTipOpen(false);
            setTipRect(null);
          });
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!onZoneMore) return;
          syncRect();
          setTipOpen(false);
          setPopupOpen(true);
        }}
        onKeyDown={(e) => {
          if (!onZoneMore) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            syncRect();
            setPopupOpen(true);
          }
        }}
        role={onZoneMore ? "button" : undefined}
        tabIndex={onZoneMore ? 0 : undefined}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: "50%",
            background: gradientForIntensity(zone.intensity ?? 5),
            mixBlendMode: "multiply",
          }}
        />
        {zone.order != null && (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 flex h-6 min-w-[1.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-black/40 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-sm"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            {zone.order}
          </span>
        )}
      </div>
      <ZonePortalTooltip
        open={tipOpen && !popupOpen}
        anchorRect={tipRect}
        title={title}
        lines={lines}
      />
      {onZoneMore && (
        <ZoneAnchorPopup
          open={popupOpen}
          anchorRect={tipRect}
          onClose={() => setPopupOpen(false)}
          title={zone.element}
          scoreLine={`Attention intensity ${zone.intensity ?? 5}/10`}
          body={lines.join(" ")}
          onMore={() => onZoneMore(zone)}
        />
      )}
    </>
  );
}

/**
 * Full-bleed heatmap layer over the screenshot. Zones use % layout with min pixel size.
 * Optional `onZoneMore` enables hover tooltips and click popups (Attention mode).
 */
export function HeatmapOverlay({
  zones,
  onZoneMore,
}: {
  zones: AttentionZone[];
  /** Opens Insight / section flow from the parent (maps zone → analysis). */
  onZoneMore?: (zone: AttentionZone) => void;
}) {
  const sorted = [...zones].filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <div className="absolute left-0 top-0 h-full w-full pointer-events-none" style={{ zIndex: 10 }}>
      {sorted.map((zone, i) => (
        <AttentionZoneHit key={`${zone.order}-${i}`} zone={zone} onZoneMore={onZoneMore} />
      ))}
    </div>
  );
}

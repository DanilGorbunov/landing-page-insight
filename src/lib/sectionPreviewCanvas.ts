import type { SectionPreviewChange } from "@/types/sectionPreview";

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rr: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  const r = rr;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  pathRoundedRect(ctx, x, y, w, h, rr);
  ctx.fill();
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  pathRoundedRect(ctx, x, y, w, h, rr);
  ctx.stroke();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    if (ctx.measureText(w).width <= maxWidth) {
      line = w;
    } else {
      let t = w;
      while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
      lines.push(ctx.measureText(t).width > maxWidth ? t.slice(0, 1) : `${t}…`);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** True when coordinates are usable for overlay (not degenerate, not corner-only, in bounds). */
export function validateSectionPreviewChanges(
  changes: SectionPreviewChange[] | undefined,
  canvasW: number,
  canvasH: number
): changes is SectionPreviewChange[] {
  if (!changes?.length || canvasW <= 0 || canvasH <= 0) return false;
  for (const c of changes) {
    const x = Number(c.x);
    const y = Number(c.y);
    const w = Number(c.width);
    const h = Number(c.height);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return false;
    if (w <= 0 || h <= 0) return false;
    if (x === 0 && y === 0) return false;
    if (x < 0 || y < 0) return false;
    if (x + w > canvasW + 0.5 || y + h > canvasH + 0.5) return false;
    const nt = typeof c.newText === "string" ? c.newText.trim() : "";
    if (!nt) return false;
  }
  return true;
}

/**
 * Draw screenshot + AI change overlays; returns PNG data URL.
 */
export function renderSectionPreviewOverlay(
  screenshot: HTMLImageElement,
  changes: SectionPreviewChange[]
): string {
  const w = screenshot.naturalWidth;
  const h = screenshot.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  ctx.drawImage(screenshot, 0, 0);

  const borderColor = "#1D9E75";
  const pad = 8;

  for (const change of changes) {
    const x = change.x;
    const y = change.y;
    const bw = change.width;
    const bh = change.height;
    const fs = Math.max(10, Math.min(change.fontSize || 14, bh));
    const weight = change.fontWeight === "bold" ? "bold" : "normal";
    const bg = change.bgColor || "#111111";

    ctx.save();

    if (change.type === "button") {
      const br = Math.min(change.borderRadius ?? 4, bw / 2, bh / 2);
      ctx.fillStyle = bg;
      fillRoundedRect(ctx, x, y, bw, bh, br);

      const tc = change.textColor || "#FFFFFF";
      ctx.fillStyle = tc;
      ctx.font = `${weight} ${fs}px ui-sans-serif, system-ui, sans-serif`;
      let label = change.newText;
      while (label.length > 1 && ctx.measureText(`${label}…`).width > bw - pad * 2) {
        label = label.slice(0, -1);
      }
      if (ctx.measureText(label).width > bw - pad * 2) label = `${label.slice(0, -1)}…`;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, x + (bw - tw) / 2, y + bh / 2 + fs * 0.35);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      strokeRoundedRect(ctx, x - 2, y - 2, bw + 4, bh + 4, br + 1);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, bw, bh);

      const tc = change.color || "#FFFFFF";
      ctx.fillStyle = tc;
      ctx.font = `${weight} ${fs}px ui-sans-serif, system-ui, sans-serif`;
      const maxW = Math.max(8, bw - pad * 2);
      const lines = wrapLines(ctx, change.newText, maxW);
      const lh = Math.min(fs * 1.25, (bh - pad * 2) / Math.max(1, lines.length));
      let ty = y + pad + fs;
      for (let i = 0; i < lines.length; i++) {
        if (ty > y + bh - pad) break;
        ctx.fillText(lines[i], x + pad, ty);
        ty += lh;
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, bw + 4, bh + 4);
    }

    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}

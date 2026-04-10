import { screenshotUrlToImageBase64 } from "@/lib/screenshotToBase64";
import { getSimulateOverlayPercentRect } from "@/lib/simulateWhatIf";
import type { SectionOrderKey } from "@/lib/compareDecisionMetrics";

/**
 * Crops the vertical band for a section from the full-page screenshot; returns raw base64 (no data: prefix).
 */
export async function cropSectionToJpegBase64(
  screenshotUrl: string,
  sectionKey: SectionOrderKey,
  ctaAnnotation: { top: number; height: number } | null
): Promise<string | null> {
  if (!screenshotUrl.trim()) return null;
  try {
    const { base64, mediaType } = await screenshotUrlToImageBase64(screenshotUrl);
    const dataUrl = `data:${mediaType};base64,${base64}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    });
    const rect = getSimulateOverlayPercentRect(sectionKey, ctaAnnotation);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;
    const topPx = (rect.top / 100) * h;
    const cropH = Math.max(1, (rect.height / 100) * h);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, topPx, w, cropH, 0, 0, w, cropH);
    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    const parts = jpeg.split(",");
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

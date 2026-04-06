/**
 * Encode a screenshot URL as base64 for the attention API.
 * Prefers fetch + blob when CORS allows; falls back to canvas with crossOrigin.
 */
export async function screenshotUrlToImageBase64(imageUrl: string): Promise<{ base64: string; mediaType: string }> {
  const u = imageUrl.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://") && !u.startsWith("blob:") && !u.startsWith("data:")) {
    throw new Error("Invalid image URL");
  }

  try {
    const res = await fetch(u, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    let mediaType = blob.type?.split(";")[0]?.trim() || "";
    if (!mediaType.startsWith("image/")) {
      mediaType = sniffMediaType(bytes) || "image/png";
    }
    return { base64, mediaType };
  } catch {
    return loadViaCanvas(u);
  }
}

function sniffMediaType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return null;
}

function loadViaCanvas(imageUrl: string): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unsupported"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mediaType: "image/png" });
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Canvas export failed (CORS may block this image)"));
      }
    };
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = imageUrl;
  });
}

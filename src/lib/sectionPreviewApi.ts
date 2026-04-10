import { VITE_API_BASE_URL } from "@/lib/env";
import type { SectionPreviewResponse } from "@/types/sectionPreview";

const memory = new Map<string, SectionPreviewResponse>();

function key(pageUrl: string, sectionKey: string) {
  return `${pageUrl.trim().toLowerCase()}|${sectionKey}`;
}

export function getCachedSectionPreview(pageUrl: string, sectionKey: string): SectionPreviewResponse | undefined {
  return memory.get(key(pageUrl, sectionKey));
}

export function setCachedSectionPreview(pageUrl: string, sectionKey: string, data: SectionPreviewResponse) {
  memory.set(key(pageUrl, sectionKey), data);
}

export interface PreviewSectionRequestBody {
  sectionKey: string;
  currentHtml: string;
  screenshotBase64: string;
  screenshotMediaType?: string;
  issue: string;
  recommendation: string;
  competitorExample: string;
  pageUrl: string;
}

export async function requestSectionPreview(body: PreviewSectionRequestBody): Promise<SectionPreviewResponse> {
  const url = `${VITE_API_BASE_URL}/api/preview-section`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "Backend not found (404). On Vercel: set VITE_API_BASE_URL to your Railway backend URL in Project → Settings → Environment Variables, then redeploy."
      );
    }
    if (res.status === 502 || res.status === 503) {
      throw new Error(
        import.meta.env.DEV
          ? "API unreachable (502). Start the backend on port 3002: npm run dev:backend — or run both: npm run dev:all"
          : "Analysis service is temporarily unavailable. Try again in a moment."
      );
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === "string" ? err.error : `Preview failed (${res.status})`);
  }
  return res.json();
}

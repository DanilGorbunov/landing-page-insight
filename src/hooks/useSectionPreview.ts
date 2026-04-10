import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getSectionHtmlForPreview } from "@/lib/sectionHtmlForPreview";
import {
  getCachedSectionPreview,
  requestSectionPreview,
  setCachedSectionPreview,
} from "@/lib/sectionPreviewApi";
import type { SectionPreviewResponse } from "@/types/sectionPreview";
import type { SimulateAiLabelRow } from "@/lib/simulateAiLabels";
import type { AnalysisResult } from "@/types/api";
import type { SectionOrderKey } from "@/lib/compareDecisionMetrics";

const PREVIEW_SECTION_KEYS = new Set<SectionOrderKey>(["hero", "value proposition", "CTA"]);

export function useSectionPreview({
  pageUrl,
  result,
  captureSectionCrop,
}: {
  pageUrl: string;
  result: AnalysisResult;
  captureSectionCrop: (sectionKey: SectionOrderKey) => Promise<string | null>;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBtnLoading, setPreviewBtnLoading] = useState(false);
  const [previewData, setPreviewData] = useState<SectionPreviewResponse | null>(null);
  const [cropDataUrl, setCropDataUrl] = useState<string | null>(null);
  const [previewTargetRow, setPreviewTargetRow] = useState<SimulateAiLabelRow | null>(null);

  const runSectionPreviewForRow = useCallback(
    async (row: SimulateAiLabelRow) => {
      if (!PREVIEW_SECTION_KEYS.has(row.sectionKey)) return;
      setPreviewBtnLoading(true);
      setPreviewTargetRow(row);
      setPreviewOpen(true);
      setPreviewLoading(true);
      setPreviewData(null);
      try {
        const b64 = await captureSectionCrop(row.sectionKey);
        setCropDataUrl(b64 ? `data:image/jpeg;base64,${b64}` : null);
        if (!b64) {
          toast.error("Could not capture section screenshot");
          setPreviewOpen(false);
          return;
        }
        const cached = getCachedSectionPreview(pageUrl, row.sectionKey);
        if (cached) {
          setPreviewData(cached);
          return;
        }
        const currentHtml = getSectionHtmlForPreview(result, row.sectionKey);
        const data = await requestSectionPreview({
          sectionKey: row.sectionKey,
          currentHtml,
          screenshotBase64: b64,
          screenshotMediaType: "image/jpeg",
          issue: row.whatISee,
          recommendation: row.suggestedCopy || row.oneLine,
          competitorExample: row.competitorLine || "",
          pageUrl,
        });
        setCachedSectionPreview(pageUrl, row.sectionKey, data);
        setPreviewData(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Preview failed";
        toast.error(msg);
        setPreviewOpen(false);
      } finally {
        setPreviewLoading(false);
        setPreviewBtnLoading(false);
      }
    },
    [captureSectionCrop, result, pageUrl]
  );

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewData(null);
    setCropDataUrl(null);
    setPreviewTargetRow(null);
  }, []);

  return {
    previewOpen,
    previewLoading,
    previewBtnLoading,
    previewData,
    cropDataUrl,
    previewTargetRow,
    runSectionPreviewForRow,
    closePreview,
  };
}

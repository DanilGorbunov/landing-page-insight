import { jsPDF } from "jspdf";
import type { FullInsightsPayload } from "@/lib/reportSession";
import type { AnalysisResult } from "@/types/api";
import { getDomain, parseSectionScores, stripMarkdownFormatting, type SectionScoreKey } from "@/lib/utils";
import { parseSynthesisReport, type SynthesisBlock } from "@/lib/parseSynthesisReport";
import { weightedOverallFromSections, projectRatings } from "@/lib/insightsProjection";
import {
  renderBeforeAfterBarPng,
  renderCompetitiveBarPng,
  renderCompetitiveRadarPng,
  canRenderBeforeAfter,
  canRenderCompetitiveCharts,
} from "@/lib/pdfChartRenders";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  value_prop: "Value prop",
  features: "Features",
  social_proof: "Social proof",
  cta: "CTA",
};

const PDF_SECTION_BLOCKS: { key: keyof AnalysisResult["userAnalysis"]; label: string }[] = [
  { key: "hero", label: "Hero" },
  { key: "value proposition", label: "Value proposition" },
  { key: "features", label: "Features" },
  { key: "social proof", label: "Social proof" },
  { key: "CTA", label: "CTA" },
];

const MAX_SECTION_CHARS = 4500;

function addWrapped(doc: jsPDF, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const lines = doc.splitTextToSize(text.replace(/\s+/g, " ").trim(), maxW);
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

function cleanMultilineForPdf(text: string): string {
  return stripMarkdownFormatting(text).replace(/\s+/g, " ").trim();
}

function truncateBlock(text: string, max: number): string {
  const t = cleanMultilineForPdf(text);
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

async function loadImageDataUrl(src: string | null | undefined): Promise<string | null> {
  if (!src || typeof src !== "string" || !/^https?:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addImageFit(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number
): { y: number } {
  const props = doc.getImageProperties(dataUrl);
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  let yNext = y;
  if (yNext + h > 278) {
    doc.addPage();
    yNext = 16;
  }
  doc.addImage(dataUrl, "PNG", x, yNext, w, h);
  return { y: yNext + h + 6 };
}

/**
 * Full export: meta, forecast, screenshots, chart images, section narratives, synthesis, gaps.
 */
export async function downloadFullInsightsPdf(payload: FullInsightsPayload): Promise<void> {
  const { url, result, planName, paidAt } = payload;
  if (!result) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxW = pageW - margin * 2;
  let y = 16;
  const lh = 5;

  const newPageIfNeeded = (minSpace: number) => {
    if (y + minSpace > 280) {
      doc.addPage();
      y = 16;
    }
  };

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Landing Lens — full insights", margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  y = addWrapped(doc, `URL: ${url} · Plan: ${planName} · Unlocked: ${paidAt}`, margin, y, maxW, lh);
  doc.setTextColor(0);
  y += 5;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Rating forecast (illustrative)", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const userScores = parseSectionScores(result.userAnalysis ?? undefined);
  if (userScores) {
    const w = weightedOverallFromSections(userScores);
    const proj = w != null ? projectRatings(w) : projectRatings(5.5);
    y = addWrapped(
      doc,
      `Current (weighted): ${proj.current.toFixed(1)}/10 · ~30d: ${proj.days30.toFixed(1)}/10 · ~90d: ${proj.days90.toFixed(1)}/10`,
      margin,
      y,
      maxW,
      lh
    );
    y += 3;
    y = addWrapped(doc, proj.summary, margin, y, maxW, lh);
    y += 6;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Screenshots from analysis", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  y = addWrapped(
    doc,
    "Page captures used for vision analysis. If a URL blocks cross-origin access, the image may be omitted.",
    margin,
    y,
    maxW,
    3.8
  );
  y += 4;

  const targetShot = await loadImageDataUrl(result.targetScreenshotUrl);
  if (targetShot) {
    newPageIfNeeded(70);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Your site — ${getDomain(url)}`, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const { y: y1 } = addImageFit(doc, targetShot, margin, y, maxW, 85);
    y = y1;
  } else {
    y = addWrapped(doc, `Your site (${getDomain(url)}): screenshot not embedded (unavailable or CORS).`, margin, y, maxW, 4);
    y += 4;
  }

  for (const comp of result.competitors?.slice(0, 3) ?? []) {
    const d = getDomain(comp.url);
    const shot = await loadImageDataUrl(comp.screenshotUrl);
    if (shot) {
      newPageIfNeeded(70);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Competitor — ${d}`, margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      const { y: y2 } = addImageFit(doc, shot, margin, y, maxW, 85);
      y = y2;
    } else {
      y = addWrapped(doc, `Competitor ${d}: screenshot not embedded (unavailable or CORS).`, margin, y, maxW, 4);
      y += 3;
    }
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Charts (export render)", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  newPageIfNeeded(30);
  y = addWrapped(
    doc,
    "Competitive shape (radar) and section breakdown (horizontal bars) — same data as the web report, rendered for PDF.",
    margin,
    y,
    maxW,
    3.8
  );
  y += 4;

  if (canRenderCompetitiveCharts(url, result.userAnalysis, result.competitors)) {
    const radarPng = renderCompetitiveRadarPng(url, result.userAnalysis, result.competitors);
    if (radarPng) {
      newPageIfNeeded(95);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Competitive radar (0–10 by section)", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const r = addImageFit(doc, radarPng, margin, y, maxW, 95);
      y = r.y;
    }
    const barPng = renderCompetitiveBarPng(url, result.userAnalysis, result.competitors);
    if (barPng) {
      newPageIfNeeded(90);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Section breakdown (bars)", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const b = addImageFit(doc, barPng, margin, y, maxW, 90);
      y = b.y;
    }
  } else {
    y = addWrapped(doc, "Not enough complete section scores to plot competitive charts.", margin, y, maxW, 4);
    y += 4;
  }

  if (canRenderBeforeAfter(result.userAnalysis)) {
    const beforeAfter = renderBeforeAfterBarPng(userScores, 0.65);
    if (beforeAfter) {
      newPageIfNeeded(85);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Now vs after improvements (estimated)", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      y = addWrapped(
        doc,
        "Per-section current scores vs estimated profile after key recommendations (illustrative).",
        margin,
        y,
        maxW,
        3.8
      );
      y += 3;
      const ba = addImageFit(doc, beforeAfter, margin, y, maxW, 80);
      y = ba.y;
    }
  }

  if (y > 240) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Section scores (table)", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const order: SectionScoreKey[] = ["hero", "value_prop", "features", "social_proof", "cta"];
  if (userScores) {
    for (const sk of order) {
      const val = userScores[sk];
      const line = `Your site — ${SECTION_LABELS[sk]}: ${val != null ? val.toFixed(1) : "—"}/10`;
      y = addWrapped(doc, line, margin, y, maxW, 4);
      if (y > 275) {
        doc.addPage();
        y = 16;
      }
    }
  }
  for (const comp of result.competitors?.slice(0, 3) ?? []) {
    const d = getDomain(comp.url);
    const ps = parseSectionScores(comp.analysis);
    const parts = order.map((sk) => `${SECTION_LABELS[sk]}:${ps?.[sk] != null ? ps[sk]!.toFixed(1) : "—"}`);
    y = addWrapped(doc, `${d}: ${parts.join(" · ")}`, margin, y, maxW, 4);
    y += 1;
    if (y > 275) {
      doc.addPage();
      y = 16;
    }
  }
  y += 4;

  if (y > 230) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Analysis text by section", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  y = addWrapped(
    doc,
    "Full model output per section (your site and competitors). Truncated only if extremely long.",
    margin,
    y,
    maxW,
    3.8
  );
  y += 4;

  for (const { key, label } of PDF_SECTION_BLOCKS) {
    newPageIfNeeded(40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    y = addWrapped(doc, label, margin, y, maxW, 4.5);
    y += 1;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    y = addWrapped(doc, "Your site", margin, y, maxW, 4);
    y += 1;
    doc.setFont("helvetica", "normal");
    const userText = result.userAnalysis?.[key];
    y = addWrapped(doc, userText ? truncateBlock(userText, MAX_SECTION_CHARS) : "—", margin, y, maxW, 3.8);
    y += 3;
    for (const comp of result.competitors?.slice(0, 3) ?? []) {
      const d = getDomain(comp.url);
      doc.setFont("helvetica", "bold");
      y = addWrapped(doc, d, margin, y, maxW, 4);
      y += 1;
      doc.setFont("helvetica", "normal");
      const ct = comp.analysis?.[key];
      y = addWrapped(doc, ct ? truncateBlock(ct, MAX_SECTION_CHARS) : "—", margin, y, maxW, 3.8);
      y += 3;
      if (y > 270) {
        doc.addPage();
        y = 16;
      }
    }
    y += 2;
  }

  if (y > 240) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Full synthesis", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const parsed = parseSynthesisReport(result.report || "");
  const emitBlocks = (blocks: SynthesisBlock[], indent: number) => {
    const x = margin + indent;
    for (const b of blocks) {
      if (y > 275) {
        doc.addPage();
        y = 16;
      }
      if (b.type === "subheading") {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        y = addWrapped(doc, b.text, x, y, maxW - indent, 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        y += 1;
      } else if (b.type === "paragraph") {
        y = addWrapped(doc, b.text, x, y, maxW - indent, 4);
        y += 2;
      } else {
        b.items.forEach((item, idx) => {
          if (y > 275) {
            doc.addPage();
            y = 16;
          }
          const prefix = b.ordered ? `${idx + 1}. ` : "• ";
          y = addWrapped(doc, prefix + item, x, y, maxW - indent, 4);
          y += 1;
        });
        y += 2;
      }
    }
  };

  if (!result.report?.trim()) {
    y = addWrapped(doc, "—", margin, y, maxW, 4);
    y += 6;
  } else {
    if (parsed.scoreLine) {
      doc.setFont("helvetica", "bold");
      y = addWrapped(doc, parsed.scoreLine, margin, y, maxW, 4);
      doc.setFont("helvetica", "normal");
      y += 3;
    }
    emitBlocks(parsed.preamble, 0);
    for (const sec of parsed.sections) {
      if (y > 268) {
        doc.addPage();
        y = 16;
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      y = addWrapped(doc, sec.title, margin, y, maxW, 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      y += 2;
      emitBlocks(sec.blocks, 3);
      y += 2;
    }
    y += 4;
  }

  if ((result.gaps?.length ?? 0) > 0) {
    if (y > 240) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Critical gaps", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const g of result.gaps!.slice(0, 16)) {
      y = addWrapped(doc, `[${g.priority}] ${g.area} · confidence: ${g.confidence}`, margin, y, maxW, 4);
      y += 1;
      y = addWrapped(doc, `Problem: ${g.problem}`, margin, y, maxW, 4);
      y += 1;
      y = addWrapped(doc, `Recommendation: ${g.recommendation}`, margin, y, maxW, 4);
      y += 1;
      y = addWrapped(doc, `Competitor benchmark: ${g.competitor}`, margin, y, maxW, 4);
      y += 4;
      if (y > 275) {
        doc.addPage();
        y = 16;
      }
    }
  }

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Demo export — charts are static renders; projections illustrative. No legal or performance guarantee.", margin, 285);
  doc.setTextColor(0);

  const safeName = getDomain(url).replace(/[^\w.-]+/g, "_") || "report";
  doc.save(`landing-lens-${safeName}.pdf`);
}

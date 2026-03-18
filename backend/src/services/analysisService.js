import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const MODEL = "claude-sonnet-4-20250514";
const MAX_IMAGE_WIDTH = 1000;
const JPEG_QUALITY = 78;
const MARKDOWN_MAX_CHARS = 3000;
const SECTIONS = [
  "hero",
  "value proposition",
  "features",
  "social proof",
  "CTA",
];

/**
 * Resize and compress image to reduce Vision API tokens.
 * @param {string} base64 - Base64 image (optional data: URL prefix).
 * @returns {Promise<{ data: string, mediaType: string }>} Raw base64 and MIME type.
 */
async function compressImageForVision(base64) {
  const raw = base64.replace(/^data:image\/\w+;base64,/, "");
  const mediaTypeFallback = base64.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
  try {
    const buf = Buffer.from(raw, "base64");
    const out = await sharp(buf)
      .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return { data: out.toString("base64"), mediaType: "image/jpeg" };
  } catch {
    return { data: raw, mediaType: mediaTypeFallback };
  }
}

/**
 * Parse one-shot analysis response into section -> text.
 * Expects markdown with "## section name" headers and content until next ##.
 */
function parseSectionsResponse(text) {
  const out = {};
  const blocks = text.split(/\n##\s+/);
  const normalized = SECTIONS.map((s) => s.toLowerCase());

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;
    const firstLineEnd = block.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? block.slice(0, firstLineEnd) : block;
    const body = firstLineEnd >= 0 ? block.slice(firstLineEnd + 1).trim() : "";
    const header = firstLine.replace(/^#+\s*/, "").trim().toLowerCase();
    const sectionKey = normalized.find((s) => header === s || header.startsWith(s) || s.startsWith(header));
    const key = sectionKey ? SECTIONS[normalized.indexOf(sectionKey)] : (SECTIONS[i] || header);
    if (body) out[key] = body;
  }

  for (const s of SECTIONS) {
    if (!out[s]) out[s] = "No specific analysis for this section.";
  }
  return out;
}

/**
 * Analyze entire landing in one Vision call: all 5 sections from one screenshot + markdown.
 * Uses compressed image and shorter text to reduce tokens (faster + cheaper).
 * @param {{ markdown?: string, screenshotUrl?: string, screenshotBase64?: string }} scrapeResult - Scrape output.
 * @returns {Promise<Record<string, string>>} Map of section name to analysis text.
 */
export async function analyzeLandingSections(scrapeResult) {
  const { markdown, screenshotUrl, screenshotBase64 } = scrapeResult;
  let base64 = screenshotBase64;
  if (!base64 && screenshotUrl) {
    const res = await fetch(screenshotUrl);
    if (res.ok) base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  }

  let imageBase64 = null;
  let imageMediaType = "image/png";
  if (base64) {
    const compressed = await compressImageForVision(base64);
    imageBase64 = compressed.data;
    imageMediaType = compressed.mediaType;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });
  const content = [];

  if (imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType,
        data: imageBase64,
      },
    });
  }

  const sectionList = SECTIONS.map((s) => `"${s}"`).join(", ");
  const textParts = [
    `Analyze this landing page for the following sections: ${sectionList}.`,
    "For each section: what works, what to improve, with evidence.",
    "Reply in markdown with exactly these headers and analysis under each:",
    SECTIONS.map((s) => `## ${s}`).join("\n"),
  ];
  if (markdown) {
    textParts.push("\n\nPage text (markdown):\n" + markdown.slice(0, MARKDOWN_MAX_CHARS));
  }
  content.push({ type: "text", text: textParts.join("\n") });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  const raw = textBlock ? textBlock.text : "";
  return parseSectionsResponse(raw);
}

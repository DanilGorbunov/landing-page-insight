import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 82;
const MARKDOWN_MAX_CHARS = 4000;
const SECTIONS = [
  "hero",
  "value proposition",
  "features",
  "social proof",
  "CTA",
];

/** Section display name -> crop range key */
const SECTION_TO_RANGE = {
  hero: "hero",
  "value proposition": "value_prop",
  features: "features",
  "social proof": "social_proof",
  CTA: "cta",
};

const OVERLAP = 0.05;
const RANGES = {
  hero: { top: 0.0, bottom: 0.25 },
  value_prop: { top: 0.2, bottom: 0.4 },
  features: { top: 0.35, bottom: 0.6 },
  social_proof: { top: 0.55, bottom: 0.8 },
  cta: { top: 0.75, bottom: 1.0 },
};

/**
 * Crop a vertical section from a full-page screenshot for Vision.
 * @param {Buffer} imageBuffer - Full screenshot (e.g. after resize).
 * @param {string} section - One of: hero, value_prop, features, social_proof, cta.
 * @returns {Promise<{ buffer: Buffer, cropTop: number, cropEnd: number, totalHeight: number }>}
 */
async function cropSectionFromScreenshot(imageBuffer, section) {
  const metadata = await sharp(imageBuffer).metadata();
  const totalHeight = metadata.height;
  const range = RANGES[section];
  const top = Math.max(0, range.top - OVERLAP);
  const bottom = Math.min(1, range.bottom + OVERLAP);
  let cropTop = Math.floor(top * totalHeight);
  let cropHeight = Math.floor((bottom - top) * totalHeight);
  cropHeight = Math.min(cropHeight, totalHeight - cropTop);
  cropHeight = Math.max(1, cropHeight);
  cropTop = Math.min(cropTop, totalHeight - 1);
  const cropEnd = cropTop + cropHeight;

  const buffer = await sharp(imageBuffer)
    .extract({ left: 0, top: cropTop, width: metadata.width, height: cropHeight })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { buffer, cropTop, cropEnd, totalHeight };
}

/**
 * Resize image to max width and return buffer (for cropping). Same pipeline as compressImageForVision.
 * @param {string} base64 - Base64 image (optional data: URL prefix).
 * @returns {Promise<Buffer|null>} Resized JPEG buffer or null on failure.
 */
async function getResizedBuffer(base64) {
  const raw = base64.replace(/^data:image\/\w+;base64,/, "");
  try {
    const buf = Buffer.from(raw, "base64");
    return await sharp(buf)
      .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch {
    return null;
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
 * @param {{ markdown?: string, screenshotUrl?: string, screenshotBase64?: string, url?: string }} scrapeResult - Scrape output.
 * @param {boolean} [isUserSite=false] - If true use Sonnet, else Haiku.
 * @returns {Promise<Record<string, string>>} Map of section name to analysis text.
 */
export async function analyzeLandingSections(scrapeResult, isUserSite = false) {
  const { markdown, screenshotUrl, screenshotBase64 } = scrapeResult;
  const model = isUserSite ? MODEL_SONNET : MODEL_HAIKU;
  const modelLabel = isUserSite ? "sonnet" : "haiku";
  const url = scrapeResult.url || "(no url)";
  console.log("[model]", modelLabel, "→", url);

  let base64 = screenshotBase64;
  if (!base64 && screenshotUrl) {
    const res = await fetch(screenshotUrl);
    if (res.ok) base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  }

  let resizedBuffer = null;
  if (base64) {
    resizedBuffer = await getResizedBuffer(base64);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });
  const content = [];

  if (resizedBuffer) {
    for (const sectionName of SECTIONS) {
      const rangeKey = SECTION_TO_RANGE[sectionName];
      const { buffer, cropTop, cropEnd, totalHeight } = await cropSectionFromScreenshot(resizedBuffer, rangeKey);
      console.log("[crop]", sectionName + ":", cropTop + "–" + cropEnd + "px of", totalHeight + "px", "(" + url + ")");
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: buffer.toString("base64"),
        },
      });
    }
  }

  const sectionList = SECTIONS.map((s) => `"${s}"`).join(", ");
  const textParts = [
    `Analyze this landing page for the following sections: ${sectionList}.`,
    "For each section: what works, what to improve, with evidence.",
    "Reply in markdown with exactly these headers and analysis under each:",
    SECTIONS.map((s) => `## ${s}`).join("\n"),
  ];
  if (!isUserSite) {
    textParts.push('\nIf you cannot clearly see or read an element in the screenshot, write "not visible" — never infer or assume.');
  }
  if (markdown) {
    textParts.push("\n\nPage text (markdown):\n" + markdown.slice(0, MARKDOWN_MAX_CHARS));
  }
  content.push({ type: "text", text: textParts.join("\n") });

  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  const raw = textBlock ? textBlock.text : "";
  return parseSectionsResponse(raw);
}

import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const MODEL_SONNET = "claude-sonnet-4-20250514";
const MODEL_HAIKU = "claude-haiku-4-5-20251001";
const MAX_IMAGE_WIDTH_USER = 1000;
const JPEG_QUALITY_USER = 76;
const MAX_IMAGE_WIDTH_COMPETITOR = 800;
const JPEG_QUALITY_COMPETITOR = 72;
const MARKDOWN_MAX_CHARS = 2800;
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
 * @param {number} [jpegQuality] - JPEG quality for crop output (default USER).
 * @returns {Promise<{ buffer: Buffer, cropTop: number, cropEnd: number, totalHeight: number }>}
 */
async function cropSectionFromScreenshot(imageBuffer, section, jpegQuality = JPEG_QUALITY_USER) {
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
    .jpeg({ quality: jpegQuality })
    .toBuffer();
  return { buffer, cropTop, cropEnd, totalHeight };
}

/**
 * Resize image to max width and return buffer (for cropping).
 * @param {string} base64 - Base64 image (optional data: URL prefix).
 * @param {{ maxWidth: number, jpegQuality: number }} opts - User: 1000/76, competitor: 800/72 for speed.
 * @returns {Promise<Buffer|null>} Resized JPEG buffer or null on failure.
 */
async function getResizedBuffer(base64, opts = {}) {
  const maxWidth = opts.maxWidth ?? MAX_IMAGE_WIDTH_USER;
  const jpegQuality = opts.jpegQuality ?? JPEG_QUALITY_USER;
  const raw = base64.replace(/^data:image\/\w+;base64,/, "");
  try {
    const buf = Buffer.from(raw, "base64");
    return await sharp(buf)
      .resize(maxWidth, null, { withoutEnlargement: true })
      .jpeg({ quality: jpegQuality })
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

  const imageOpts = isUserSite
    ? { maxWidth: MAX_IMAGE_WIDTH_USER, jpegQuality: JPEG_QUALITY_USER }
    : { maxWidth: MAX_IMAGE_WIDTH_COMPETITOR, jpegQuality: JPEG_QUALITY_COMPETITOR };
  let resizedBuffer = null;
  if (base64) {
    resizedBuffer = await getResizedBuffer(base64, imageOpts);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });
  const content = [];

  const cropQuality = isUserSite ? JPEG_QUALITY_USER : JPEG_QUALITY_COMPETITOR;
  if (resizedBuffer) {
    for (const sectionName of SECTIONS) {
      const rangeKey = SECTION_TO_RANGE[sectionName];
      const { buffer, cropTop, cropEnd, totalHeight } = await cropSectionFromScreenshot(
        resizedBuffer,
        rangeKey,
        cropQuality
      );
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
  const siteTypeAndRubric = `
SITE_TYPE (one): saas | ecommerce | utility | marketplace. Apply matching criteria (saas: value prop, CTA, social proof; ecommerce: product clarity, trust; utility: task clarity; marketplace: both sides, trust).
Anchors (use closest, state "[closest anchor: domain = X]"): saas: linear 9, apollo 8, notion 7; ecommerce: apple 8, samsung 5; utility: google 9, figma 8; bad: generic 3, broken 1.
Rules: Score 1-10 per section; state "[SITE_TYPE: type]" per section; never deviate >1.5 from anchor without evidence; score below 4 or above 8 needs explicit evidence; never reuse gaps from other analyses.
Rubric: 1-2 broken/missing, 3-4 underperforms, 5-6 average, 7-8 good, 9-10 exceptional. Score each section on its own merit, not vs competitors.
`.trim();

  const textParts = [
    `Analyze this landing page for the following sections: ${sectionList}.`,
    "For each section: what works, what to improve, with evidence.",
    "Give each section a score out of 10 (e.g. 7/10) and justify it.",
    siteTypeAndRubric,
    "Reply in markdown with exactly these headers and analysis (including score and [SITE_TYPE: ...]) under each:",
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
    max_tokens: isUserSite ? 3072 : 2048,
    messages: [{ role: "user", content }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  const raw = textBlock ? textBlock.text : "";
  return parseSectionsResponse(raw);
}

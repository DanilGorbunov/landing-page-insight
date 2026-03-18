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
  const siteTypeAndRubric = `
Before scoring, classify the site type from the screenshot and URL:

SITE_TYPE (choose one):
- "saas"        → subscription software product (e.g. linear.app, notion.so, hubspot.com)
- "ecommerce"  → physical/digital product store (e.g. apple.com, samsung.com)
- "utility"    → tool or search engine (e.g. google.com, figma.com)
- "marketplace" → platform connecting buyers/sellers

Then apply the correct scoring criteria:

IF saas:
  Evaluate: value proposition clarity, benefit messaging, social proof, CTA specificity, pain point addressing.

IF ecommerce:
  Evaluate: product clarity, visual impact, purchase intent, price/value communication, trust signals.
  Ignore: "missing value prop" or "no social proof" if product imagery and brand recognition compensate.

IF utility:
  Evaluate: task clarity, speed to action, simplicity.
  Ignore: hero messaging, benefit statements, CTAs.

IF marketplace:
  Evaluate: clarity of value for both sides, trust, discovery, CTAs.

Score adjustment rules:
- Never penalize a site for not being a SaaS if it is not a SaaS

SCORING CALIBRATION — treat these as ground truth anchors.
When scoring any site, find the closest anchor and justify deviation.

── SAAS anchors ──
linear.app    hero = 9/10  (specific outcome headline, product screenshot, zero ambiguity about what it does)
apollo.io     hero = 8/10  (clear "find leads" value prop, social proof visible, strong CTA)
notion.so     hero = 7/10  (creative concept but abstract for new visitors, no immediate product clarity)
hubspot.com   hero = 7/10  (dual CTA smart, but headline generic)
anthropic.com hero = 6/10  (strong brand but no conversion focus, research-first not product-first)

── ECOMMERCE anchors ──
apple.com     hero = 8/10  (instant product clarity, clean hierarchy, brand recognition = social proof)
lg.com       hero = 6/10  (discount visible + CTA, but layout cluttered)
samsung.com  hero = 5/10  (strong imagery undermined by cookie banner blocking hero content)

── UTILITY anchors ──
google.com    hero = 9/10  (single action, zero friction, globally understood)
figma.com     hero = 8/10  (clear "design tool" + CTA above fold)

── Generic bad examples ──
generic saas  hero = 3/10  ("Welcome to our platform", stock photo, generic "Get Started" CTA)
broken site   hero = 1/10  (no headline, no CTA, no product visible)

CALIBRATION RULES:
- Before scoring, find the closest anchor for this site type
- State which anchor you used: "[closest anchor: apple.com = 8]"
- To score LOWER than anchor: must cite specific missing element
- To score HIGHER than anchor: must cite specific exceptional element
- Never deviate more than 1.5 points from closest anchor without two pieces of explicit evidence
- Never apply saas anchors to ecommerce sites and vice versa

DEVIATION examples:
✅ "Scores 7 not 8 like apple.com because cookie banner blocks 40% of hero on first load"
✅ "Scores 9 not 8 like apollo.io because headline includes specific metric: '275M contacts'"
❌ "Scores 4 because could be more specific" ← not enough evidence for 4-point deviation from anchor

Always state SITE_TYPE at the start of each section analysis: "[SITE_TYPE: <type>] ..."
For hero (and other sections when applicable), state: "[closest anchor: <domain> = <score>]"

When scoring each section, use ABSOLUTE criteria — not relative to competitors.
Scoring rubric (apply to every section independently):

1-2  = Broken or missing entirely (no headline, no CTA, no content visible)
3-4  = Present but significantly underperforms (vague headline, no value prop, generic stock photo)
5-6  = Average — meets basic standards (clear headline, some value prop, functional CTA)
7-8  = Good — above average execution (specific value prop, strong visual hierarchy, clear CTA with context)
9-10 = Exceptional — industry-leading (immediately memorable, specific outcomes, strong social proof, every element earns its place)

Rules:
- Score each section independently based on its own merit
- Do NOT lower a score because competitors are also strong; do NOT raise because competitors are weak
- A score below 4 requires explicit evidence of what is broken
- A score above 8 requires explicit evidence of what makes it exceptional
- Never include metrics, quotes, or gaps from a previous analysis
- Every gap must reference specific text or elements visible in the CURRENT screenshot only
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
    max_tokens: 4096,
    messages: [{ role: "user", content }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  const raw = textBlock ? textBlock.text : "";
  return parseSectionsResponse(raw);
}

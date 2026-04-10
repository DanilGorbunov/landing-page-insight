import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { logClaudeUsage } from "../utils/claudeUsageLog.js";

const MODEL = "claude-sonnet-4-20250514";

/**
 * @param {unknown} raw
 * @returns {object | null}
 */
function normalizeChange(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const type = o.type === "button" ? "button" : "text";
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  const newText = String(o.newText ?? "").trim();
  const fontSize = typeof o.fontSize === "number" && Number.isFinite(o.fontSize) ? o.fontSize : 14;
  const fontWeight = o.fontWeight === "bold" ? "bold" : "normal";
  const color = typeof o.color === "string" ? o.color : "#FFFFFF";
  const bgColor = typeof o.bgColor === "string" ? o.bgColor : "#111111";
  const textColor = typeof o.textColor === "string" ? o.textColor : undefined;
  const borderRadius =
    typeof o.borderRadius === "number" && Number.isFinite(o.borderRadius) ? o.borderRadius : 4;
  const base = {
    type,
    x,
    y,
    width,
    height,
    newText,
    fontSize,
    fontWeight,
    color,
    bgColor,
  };
  if (type === "button") {
    return { ...base, textColor: textColor ?? "#FFFFFF", borderRadius };
  }
  return base;
}

/**
 * @param {unknown} arr
 */
function normalizeChanges(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeChange).filter((c) => c != null && c.newText.length > 0);
}

/** @type {Set<string>} */
const ALLOWED = new Set(["hero", "value proposition", "CTA"]);

/** @type {Map<string, { at: number, payload: object }>} */
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function cacheKey(url, sectionKey) {
  const u = String(url || "").trim().toLowerCase();
  return crypto.createHash("sha256").update(`${u}|${sectionKey}`).digest("hex");
}

function parseJsonFromText(text) {
  const raw = String(text || "").trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

/**
 * @param {{
 *   sectionKey: string,
 *   currentHtml: string,
 *   screenshotBase64: string,
 *   screenshotMediaType?: string,
 *   issue: string,
 *   recommendation: string,
 *   competitorExample: string,
 *   pageUrl: string,
 * }} input
 */
export async function generateSectionPreview(input) {
  const sectionKey = String(input.sectionKey || "").trim();
  if (!ALLOWED.has(sectionKey)) {
    const err = new Error(`Section preview not supported for: ${sectionKey}`);
    err.statusCode = 400;
    throw err;
  }

  const pageUrl = String(input.pageUrl || "").trim();
  const ck = cacheKey(pageUrl, sectionKey);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.payload, cached: true };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");
  }

  const currentHtml = String(input.currentHtml || "").slice(0, 120_000);
  const issue = String(input.issue || "").slice(0, 8000);
  const recommendation = String(input.recommendation || "").slice(0, 8000);
  const competitorExample = String(input.competitorExample || "").slice(0, 8000);
  const b64 = String(input.screenshotBase64 || "").replace(/^data:image\/\w+;base64,/, "").trim();
  if (!b64) {
    const err = new Error("screenshotBase64 is required");
    err.statusCode = 400;
    throw err;
  }

  const mediaType =
    typeof input.screenshotMediaType === "string" && input.screenshotMediaType.startsWith("image/")
      ? input.screenshotMediaType.split(";")[0].trim()
      : "image/jpeg";

  let screenshotWidth = 800;
  let screenshotHeight = 600;
  try {
    const imgBuf = Buffer.from(b64, "base64");
    const meta = await sharp(imgBuf).metadata();
    if (meta.width && meta.height) {
      screenshotWidth = meta.width;
      screenshotHeight = meta.height;
    }
  } catch (e) {
    console.warn("[preview-section] sharp metadata:", e?.message || e);
  }

  const prompt = `You are a landing page designer.

Current section HTML (analysis / excerpt — may be prose, not literal DOM):
${currentHtml}

Current issue:
${issue}

Recommendation:
${recommendation}

What competitor does:
${competitorExample}

The attached image is a crop of this section on the live page. Use it for visual context.

Screenshot dimensions (pixel space for this crop): ${screenshotWidth}x${screenshotHeight}

Generate an improved version.

Return the changes array with PIXEL COORDINATES of elements to change on the screenshot.
Coordinates are relative to this crop only: x increases right, y increases down, origin top-left.
Estimate positions based on typical landing page layouts:
- Hero headline: usually top ~30% of the crop, often nearly full width
- CTA button: usually middle area, often ~160–280px wide depending on crop
- Value prop / subhead: often ~25–45% from top

Also return a small HTML fragment as fallback for clients that cannot use coordinates.

Return JSON only, no markdown fences:
{
  "headline": string | null,
  "subheadline": string | null,
  "ctaText": string | null,
  "htmlPatch": string,
  "explanation": string,
  "estimatedScore": number,
  "changes": [
    {
      "type": "text" | "button",
      "x": number,
      "y": number,
      "width": number,
      "height": number,
      "newText": string,
      "fontSize": number,
      "fontWeight": "bold" | "normal",
      "color": string,
      "bgColor": string,
      "textColor": string,
      "borderRadius": number
    }
  ]
}

Rules for "changes":
- Every box must lie fully inside 0..${screenshotWidth} x 0..${screenshotHeight} (x+y+width/height must not clip outside).
- Do not use x=0 and y=0 together for a box (ambiguous); place elements with realistic padding from edges.
- Use type "text" for headlines and body copy; use "button" for CTA buttons (set borderRadius, textColor as needed).
- color: hex text color matching the original; bgColor: hex for the rectangle behind the new text (match the screenshot area you are replacing).
- For buttons, include textColor and borderRadius (e.g. 4–8).

Rules for HTML:
- Keep existing CSS classes if you echo any HTML; prefer minimal HTML changes.
- htmlPatch should be a small fragment (e.g. a div or section) that could replace or patch the section.

General:
- Never invent brand names or fake data.
- estimatedScore: your estimate 1–10 for this section after the improvement.
- If an element is not applicable, use null for headline/subheadline/ctaText.`;

  const client = new Anthropic({ apiKey });

  let msg;
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("[preview-section] Anthropic error:", e?.message || e);
    throw e;
  }

  logClaudeUsage("preview-section", MODEL, msg);

  const block = msg.content?.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";

  let parsed;
  try {
    parsed = parseJsonFromText(text);
  } catch (e) {
    console.error("[preview-section] JSON parse failed:", text.slice(0, 400));
    throw new Error("Could not parse preview JSON from model");
  }

  let est =
    typeof parsed.estimatedScore === "number" && Number.isFinite(parsed.estimatedScore)
      ? parsed.estimatedScore
      : null;
  if (est == null && typeof parsed.estimatedScoreImpact === "number" && Number.isFinite(parsed.estimatedScoreImpact)) {
    est = parsed.estimatedScoreImpact;
  }
  if (est != null) est = Math.min(10, Math.max(1, est));

  const out = {
    headline: parsed.headline == null ? null : String(parsed.headline),
    subheadline: parsed.subheadline == null ? null : String(parsed.subheadline),
    ctaText: parsed.ctaText == null ? null : String(parsed.ctaText),
    htmlPatch: typeof parsed.htmlPatch === "string" ? parsed.htmlPatch : "<p>(No HTML returned)</p>",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    estimatedScore: est,
    changes: normalizeChanges(parsed.changes),
    cached: false,
  };

  cache.set(ck, { at: Date.now(), payload: out });
  return out;
}

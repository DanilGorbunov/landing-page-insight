import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage } from "../utils/claudeUsageLog.js";

const VISION_MODEL = "claude-sonnet-4-20250514";
const COMPARISON_MODEL = "claude-haiku-4-20251001";

/**
 * Strip data URL prefix if present.
 * @param {string} s
 */
function normalizeIncomingBase64(s) {
  if (!s || typeof s !== "string") return "";
  const t = s.trim();
  const m = /^data:image\/[\w+.-]+;base64,(.+)$/i.exec(t);
  return (m ? m[1] : t).replace(/\s/g, "");
}

/**
 * @param {string} base64Input raw base64 or data URL
 * @param {string} [mediaType]
 */
export async function generateHeatmapFromBase64(base64Input, mediaType = "image/png") {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");
  }

  const base64 = normalizeIncomingBase64(base64Input);
  if (!base64 || base64.length < 64) {
    throw new Error("Invalid or empty base64 image");
  }

  let mt = typeof mediaType === "string" && mediaType.startsWith("image/") ? mediaType.split(";")[0].trim() : "image/png";
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mt)) {
    mt = "image/png";
  }

  const prompt = `Analyze this landing page screenshot for visual attention prediction.
You are simulating where human eyes look in the first 1-3 seconds.

Identify the top 7 attention zones based on:
- Size of element (larger = more attention)
- Contrast against background
- Position (top-left gets more attention)
- Color vibrancy
- Faces or human figures
- Text size and weight
- Whitespace around element

Return ONLY valid JSON, no other text:
{
  "clarityScore": number (0-100, how clean/uncluttered the design is),
  "attentionScore": number (0-100, how effectively attention is directed),
  "zones": [
    {
      "x": number (0-100, % from left),
      "y": number (0-100, % from top),
      "width": number (0-100, % width),
      "height": number (0-100, % height),
      "intensity": number (1-10, attention strength),
      "element": string (what element this is: "headline", "CTA button", "logo", etc),
      "order": number (1-7, eye path order)
    }
  ],
  "eyePath": ["element1", "element2", "element3", "element4"],
  "ctaZone": {
    "found": boolean,
    "attentionPercent": number (0-100),
    "order": number (position in eye path, 1=first)
  },
  "topElement": string (element that gets most attention),
  "weakestElement": string (important element getting least attention)
}

Never invent data. Base everything only on what you can see in the screenshot.
If you cannot determine something clearly, use null.`;

  const client = new Anthropic({ apiKey });
  let msg;
  try {
    msg = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mt,
                data: base64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("[attention] vision error:", e?.message || e);
    throw e;
  }

  logClaudeUsage("attention-heatmap", VISION_MODEL, msg);

  const block = msg.content?.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  return extractJsonObject(text);
}

function extractJsonObject(text) {
  let t = String(text || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

/**
 * @param {object} yourHeatmap
 * @param {object} competitorHeatmap
 * @param {string} competitorName
 */
export async function generateAttentionComparison(yourHeatmap, competitorHeatmap, competitorName) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");
  }

  const ys = yourHeatmap || {};
  const cs = competitorHeatmap || {};
  const yCta = ys.ctaZone || {};
  const cCta = cs.ctaZone || {};

  const prompt = `
Compare these attention analysis results:

YOUR SITE:
- Clarity score: ${ys.clarityScore ?? "null"}/100
- Attention score: ${ys.attentionScore ?? "null"}/100
- Eye path: ${JSON.stringify(ys.eyePath ?? [])}
- CTA attention: ${yCta.attentionPercent ?? "null"}%
- CTA eye path position: ${yCta.order ?? "null"} of 7

COMPETITOR (${competitorName}):
- Clarity score: ${cs.clarityScore ?? "null"}/100
- Attention score: ${cs.attentionScore ?? "null"}/100
- Eye path: ${JSON.stringify(cs.eyePath ?? [])}
- CTA attention: ${cCta.attentionPercent ?? "null"}%
- CTA eye path position: ${cCta.order ?? "null"} of 7

Return ONLY valid JSON:
{
  "summary": "one sentence comparing attention patterns",
  "ctaAttentionYou": number,
  "ctaAttentionCompetitor": number,
  "ctaMultiplier": number,
  "eyePath": ["element1", "element2", "element3"],
  "competitorEyePath": ["element1", "element2", "element3"],
  "keyInsight": "one specific actionable finding referencing real elements",
  "recommendation": "one concrete change to improve attention on CTA"
}

Never invent data. If data is missing write "insufficient data".`;

  const client = new Anthropic({ apiKey });
  let msg;
  try {
    msg = await client.messages.create({
      model: COMPARISON_MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    console.error("[attention] comparison error:", e?.message || e);
    throw e;
  }

  logClaudeUsage("attention-comparison", COMPARISON_MODEL, msg);

  const block = msg.content?.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  return extractJsonObject(text);
}

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";
const SECTIONS = [
  "hero",
  "value proposition",
  "features",
  "social proof",
  "CTA",
];

/**
 * Analyze a single landing section (image + optional markdown) with Claude Vision.
 * @param {{ screenshotUrl?: string, screenshotBase64?: string, markdown?: string, section: string }} input
 * @returns {Promise<string>} Analysis text for this section
 */
export async function analyzeSection(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });
  const content = [];

  if (input.screenshotBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: input.screenshotBase64.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  const textParts = [
    `Analyze this landing page section: "${input.section}".`,
    "Provide concise insights: what works, what could be improved, and evidence from the page.",
  ];
  if (input.markdown) {
    textParts.push("\n\nPage text (markdown):\n" + input.markdown.slice(0, 8000));
  }
  content.push({ type: "text", text: textParts.join(" ") });

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

/**
 * Analyze all 5 sections for one URL (screenshot + markdown).
 * Runs sections sequentially to avoid Claude API rate limit (30k input tokens/min).
 * @param {{ markdown: string, screenshotUrl?: string, screenshotBase64?: string }} scrapeResult
 * @returns {Promise<Record<string, string>>} Map section -> analysis
 */
export async function analyzeLandingSections(scrapeResult) {
  const { markdown, screenshotUrl, screenshotBase64 } = scrapeResult;
  let base64 = screenshotBase64;
  if (!base64 && screenshotUrl) {
    const res = await fetch(screenshotUrl);
    if (res.ok) base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  }

  const out = {};
  for (const section of SECTIONS) {
    out[section] = await analyzeSection({
      section,
      markdown,
      screenshotBase64: base64,
    });
  }
  return out;
}

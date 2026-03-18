import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";
const SECTION_MAX_CHARS = 700;

/**
 * Synthesize a final competitive analysis report from all site analyses.
 * @param {{ userUrl: string, userAnalysis: Record<string, string>, competitors: Array<{ url: string, analysis: Record<string, string> }> }} input
 * @returns {Promise<string>} Final report (markdown)
 */
export async function synthesizeReport(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });

  const trunc = (text) => (typeof text === "string" ? text.slice(0, SECTION_MAX_CHARS) : "");

  const parts = [
    `# Competitive analysis: ${input.userUrl}\n`,
    "## Your landing\n",
    Object.entries(input.userAnalysis || {})
      .map(([section, text]) => `### ${section}\n${trunc(text)}`)
      .join("\n"),
    "\n## Competitors\n",
  ];

  for (const c of input.competitors || []) {
    parts.push(`### ${c.url}\n`);
    parts.push(
      Object.entries(c.analysis || {})
        .map(([section, text]) => `#### ${section}\n${trunc(text)}`)
        .join("\n")
    );
    parts.push("\n");
  }

  const prompt = `${parts.join("")}

Write a final competitive analysis in markdown.

**Required:** Start with one line: "Overall score: X/10" (X from 0 to 10, e.g. 6.2) based on competitive position.

Then include:
1. Executive summary
2. Strengths of the user's landing vs competitors
3. Gaps and recommendations (with evidence)
4. Top 3 actionable next steps.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

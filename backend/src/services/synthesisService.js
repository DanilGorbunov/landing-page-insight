import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

/**
 * Synthesize a final competitive analysis report from all site analyses.
 * @param {{ userUrl: string, userAnalysis: Record<string, string>, competitors: Array<{ url: string, analysis: Record<string, string> }> }} input
 * @returns {Promise<string>} Final report (markdown)
 */
export async function synthesizeReport(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });

  const parts = [
    `# Competitive analysis: ${input.userUrl}\n`,
    "## Your landing\n",
    Object.entries(input.userAnalysis || {})
      .map(([section, text]) => `### ${section}\n${text}`)
      .join("\n"),
    "\n## Competitors\n",
  ];

  for (const c of input.competitors || []) {
    parts.push(`### ${c.url}\n`);
    parts.push(
      Object.entries(c.analysis || {})
        .map(([section, text]) => `#### ${section}\n${text}`)
        .join("\n")
    );
    parts.push("\n");
  }

  const prompt = `${parts.join("")}

Based on the above, write a final competitive analysis report in markdown. Include:
1. Executive summary
2. Strengths of the user's landing vs competitors
3. Gaps and recommendations (with evidence from the sections)
4. Top 3 actionable next steps.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

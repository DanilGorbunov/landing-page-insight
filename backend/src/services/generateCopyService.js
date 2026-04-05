import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage } from "../utils/claudeUsageLog.js";

const MODEL = "claude-sonnet-4-20250514";

/**
 * @param {{ section: string, currentCopy: string, competitorExamples: string[], issue: string }} input
 * @returns {Promise<Array<{ variant: string, reasoning: string }>>}
 */
export async function generateCopyAlternatives(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");
  }

  const { section, currentCopy, competitorExamples, issue } = input;
  const examples = Array.isArray(competitorExamples) ? competitorExamples.filter(Boolean).slice(0, 5) : [];

  const prompt = `Given this landing page section: ${section}, current copy: ${currentCopy || "(empty)"}, 
and competitor examples: ${JSON.stringify(examples)}, generate 3 stronger alternatives.
Return JSON array: [{variant: string, reasoning: string}]
Focus on specificity, outcome-focus, and clarity.

Issue to address: ${issue || "(none specified)"}

Return only a valid JSON array, no markdown code fences or other text.`;

  const client = new Anthropic({ apiKey });

  let msg;
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    console.error("[generate-copy] Anthropic error:", e?.message || e);
    throw e;
  }

  logClaudeUsage("generate-copy", MODEL, msg);

  const block = msg.content?.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";

  let parsed;
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("[generate-copy] JSON parse failed:", text.slice(0, 200));
    throw new Error("Could not parse copy variants from model response");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Model did not return a JSON array");
  }

  return parsed
    .filter((x) => x && typeof x.variant === "string")
    .slice(0, 3)
    .map((x) => ({
      variant: String(x.variant).trim(),
      reasoning: typeof x.reasoning === "string" ? x.reasoning.trim() : "",
    }));
}

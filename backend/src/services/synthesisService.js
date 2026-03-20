import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage } from "../utils/claudeUsageLog.js";

const MODEL = "claude-sonnet-4-20250514";
const SECTION_MAX_CHARS = 700;
/** Lower ceiling → faster generation when model finishes under cap; raise if responses truncate. */
const SYNTHESIS_MAX_TOKENS = 2048;

/** Section keys as in analysis output. Weights: Hero & CTA matter most for conversion; Features least. */
const WEIGHTS = {
  hero: 0.25,
  "value proposition": 0.2,
  features: 0.1,
  "social proof": 0.2,
  CTA: 0.25,
};
const DEFAULT_WEIGHT = 0.2;

export function parseScoreFromSection(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  return m ? parseFloat(m[1], 10) : null;
}

/**
 * Weighted overall score from section analyses (not simple average).
 * @param {Record<string, string>} analysis - Section name -> analysis text
 * @returns {number|null} 0–10 or null if no scores found
 */
export function computeWeightedScore(analysis) {
  if (!analysis || typeof analysis !== "object") return null;
  let sum = 0;
  let weightSum = 0;
  for (const [key, text] of Object.entries(analysis)) {
    const score = parseScoreFromSection(text);
    if (score == null) continue;
    const w = WEIGHTS[key] ?? DEFAULT_WEIGHT;
    sum += score * w;
    weightSum += w;
  }
  if (weightSum === 0) return null;
  return Math.round((sum / weightSum) * 10) / 10;
}

/**
 * Gaps instructions: same validation rules as before, shorter wording (Target + Allowed list once).
 */
function buildGapsPromptBlock(targetUrl, competitorUrlsList) {
  const allowed = competitorUrlsList.length ? competitorUrlsList : "(none)";
  return `
CONTEXT
- Target (user landing URL, same in all steps below): ${targetUrl}
- Allowed competitor URLs for benchmarks (use only these): ${allowed}

Generate Critical Gaps for Target. No status fluff (e.g. "I am analyzing…"). Each gap must satisfy:

STEP 1 — Problem on Target
  From Target's page/screenshot, pick one specific weak element (copy, button, section). Quote exactly, e.g. "The headline reads: '…'"

STEP 2 — Evidence gate
  Ask: "Is this text/element visible in Target's screenshot?" (Target = URL in CONTEXT). YES → continue. NO → drop the gap entirely.

STEP 3 — Competitor benchmark
  Which allowed competitor does this better? Quote their approach. Competitor URL MUST be one of Allowed list in CONTEXT.

STEP 4 — Recommendation
  Reference Target's real copy. BAD: vague "add a value proposition". GOOD: replace quoted Target line with a concrete pattern taken from an allowed competitor.

HARD RULES
- Only reference competitors from [${allowed}]
- Do not use "Welcome to our platform" for Target unless that exact text exists on Target's screenshot
- Do not cite hubspot.com-style benchmark metrics unless Target or an allowed competitor in this run is hubspot.com
- Max 4 gaps; quality over quantity. If fewer than 2 valid gaps, return only valid ones.

Output only a JSON array inside one fenced code block (\`\`\`json … \`\`\`). Each item:
{
  "priority": "P1" | "P2",
  "severity": "High" | "Medium",
  "section": "hero" | "value_prop" | "features" | "social_proof" | "cta",
  "title": "<max 6 words, specific problem>",
  "problem": "<what is wrong — quote actual element from Target>",
  "evidence": "<exact text or UI visible on Target screenshot>",
  "competitor_benchmark": { "url": "<from Allowed list>", "what_they_do": "<specific element/copy>" },
  "recommendation": "<specific fix referencing Target's actual copy>"
}
`.trim();
}

/**
 * Synthesize a final competitive analysis report from all site analyses.
 * @param {{ userUrl: string, userAnalysis: Record<string, string>, competitors: Array<{ url: string, analysis: Record<string, string> }> }} input
 */
export async function synthesizeReport(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });

  const weightedScore = computeWeightedScore(input.userAnalysis);

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

  const scoreLine = weightedScore != null ? `Overall score: ${weightedScore.toFixed(1)}/10` : "Overall score: —/10";
  const competitorUrls = (input.competitors || []).map((c) => c.url);
  const competitorUrlsList = competitorUrls.length ? competitorUrls.join(", ") : "(none)";

  const gapsPrompt = buildGapsPromptBlock(input.userUrl, competitorUrlsList);

  const prompt = `${parts.join("")}

Markdown report — first line exactly: "${scoreLine}"
Sections: (1) Executive summary 2–4 tight sentences (2) Strengths vs competitors (bullets OK) (3) Gaps/recommendations — cite evidence from above only (4) Top 3 next steps. Prefer brevity; avoid repetition.

---
CRITICAL GAPS

${gapsPrompt}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: SYNTHESIS_MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  logClaudeUsage("synthesis", MODEL, msg);

  const textBlock = msg.content.find((b) => b.type === "text");
  let report = textBlock ? textBlock.text : "";
  const jsonBlockMatch = report.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    report = report.replace(/\n?```(?:json)?\s*[\s\S]*?```\s*/, "").trim();
  }
  if (weightedScore != null && report) {
    report = report.replace(/^Overall score:\s*[\d.—]+\s*\/\s*10.*$/m, `${scoreLine}`).trimStart();
    if (!report.startsWith("Overall score:")) {
      report = `${scoreLine}\n\n${report}`;
    }
  }

  let gaps = [];
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const raw = JSON.parse(jsonBlockMatch[1].trim());
      const arr = Array.isArray(raw) ? raw : [raw];
      gaps = arr
        .filter((g) => g && typeof g === "object" && (g.priority || g.problem))
        .map((g) => ({
          priority: g.priority === "P1" || g.priority === "P2" ? g.priority : "P2",
          area: sectionToArea(g.section) || g.title || "General",
          problem: g.problem || "",
          recommendation: g.recommendation || "",
          competitor: getDomainFromUrl(g.competitor_benchmark?.url || g.competitor_benchmark || ""),
          confidence: g.severity === "High" || g.severity === "Medium" || g.severity === "Low" ? g.severity : "Medium",
        }));
    } catch (_) {
      gaps = [];
    }
  }

  return { report, overall_score: weightedScore ?? undefined, gaps };
}

function sectionToArea(section) {
  if (!section) return null;
  const map = {
    hero: "Hero Section",
    value_prop: "Value Proposition",
    features: "Feature Communication",
    social_proof: "Social Proof",
    cta: "CTA Clarity",
  };
  return map[section] || (section.charAt(0).toUpperCase() + section.slice(1).replace(/_/g, " "));
}

function getDomainFromUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  }
}

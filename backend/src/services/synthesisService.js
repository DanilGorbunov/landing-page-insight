import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";
const SECTION_MAX_CHARS = 700;

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
 * Synthesize a final competitive analysis report from all site analyses.
 * Overall score for the user is weighted (Hero, CTA, Social proof weighted higher than Features).
 * @param {{ userUrl: string, userAnalysis: Record<string, string>, competitors: Array<{ url: string, analysis: Record<string, string> }> }} input
 * @returns {Promise<{ report: string, overall_score?: number, gaps: Array<{ priority: string, area: string, problem: string, recommendation: string, competitor: string, confidence: string }> }>}
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

  const gapsPrompt = `
You are generating Critical Gaps for: ${input.userUrl}

Do not include status lines like "I am analyzing <url>" in your response. Each gap MUST follow this validation:

STEP 1 — Find the problem:
  Look at the screenshot of ${input.userUrl}
  Identify a specific weak element (text, button, section)
  Quote it exactly: "The headline reads: '...'"

STEP 2 — Validate evidence:
  Ask: "Is this text/element visible in the ${input.userUrl} screenshot?"
  YES → proceed
  NO  → discard this gap entirely, do not include it

STEP 3 — Find competitor benchmark:
  Which competitor does this better?
  Quote their approach: "<competitorUrl> shows '...'"
  Only use competitors from THIS analysis: ${competitorUrlsList}

STEP 4 — Write recommendation:
  Reference actual ${input.userUrl} copy in the fix
  BAD:  "Add a value proposition"
  GOOD: "Replace '<actualHeadline>' with outcome-focused copy like <competitorUrl> uses: <competitorHeadline>"

HARD RULES:
- Never reference a competitor not in [${competitorUrlsList}]
- Never write "Welcome to our platform" unless that text exists in the ${input.userUrl} screenshot
- Never reference hubspot.com metrics unless ${input.userUrl} is being compared to hubspot.com in THIS analysis
- Maximum 4 gaps — quality over quantity
- If fewer than 2 valid gaps found → return only what is valid

Output the Critical Gaps as a JSON array in a fenced code block. Each item must have this shape:
{
  "priority": "P1" | "P2",
  "severity": "High" | "Medium",
  "section": "hero" | "value_prop" | "features" | "social_proof" | "cta",
  "title": "<max 6 words describing the specific problem>",
  "problem": "<what is wrong — quote actual element from ${input.userUrl}>",
  "evidence": "<exact text or UI element visible in ${input.userUrl} screenshot>",
  "competitor_benchmark": {
    "url": "<competitor url from THIS analysis only>",
    "what_they_do": "<specific element or copy they use>"
  },
  "recommendation": "<specific fix referencing actual ${input.userUrl} copy>"
}

Output ONLY the JSON array inside a single code block, e.g. \`\`\`json\\n[ ... ]\\n\`\`\`
`.trim();

  const prompt = `${parts.join("")}

Write a concise competitive analysis in markdown. Start with exactly: "${scoreLine}"

Then: 1) Executive summary (2-4 sentences) 2) Strengths vs competitors 3) Gaps and recommendations (evidence from above only) 4) Top 3 next steps. Be concise.

---
CRITICAL GAPS (structured output)

${gapsPrompt}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2560,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  let report = textBlock ? textBlock.text : "";
  // Remove the first JSON code block from report if present (keep only markdown)
  const jsonBlockMatch = report.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    report = report.replace(/\n?```(?:json)?\s*[\s\S]*?```\s*/, "").trim();
  }
  // Ensure first line is our weighted score (replace if Claude wrote something else)
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

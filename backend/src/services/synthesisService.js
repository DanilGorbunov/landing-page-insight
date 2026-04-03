import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage } from "../utils/claudeUsageLog.js";

const MODEL = "claude-sonnet-4-20250514";
const SECTION_MAX_CHARS_USER = 500;        // user site: slightly more context
const SECTION_MAX_CHARS_COMPETITOR = 300;  // competitors: just enough for gaps/scores
const SYNTHESIS_MAX_TOKENS = 5000;         // was 6144; saves output cost

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

  const truncUser = (text) => (typeof text === "string" ? text.slice(0, SECTION_MAX_CHARS_USER) : "");
  const truncComp = (text) => (typeof text === "string" ? text.slice(0, SECTION_MAX_CHARS_COMPETITOR) : "");

  const parts = [
    `# Competitive analysis: ${input.userUrl}\n`,
    "## Your landing\n",
    Object.entries(input.userAnalysis || {})
      .map(([section, text]) => `### ${section}\n${truncUser(text)}`)
      .join("\n"),
    "\n## Competitors\n",
  ];

  for (const c of input.competitors || []) {
    parts.push(`### ${c.url}\n`);
    parts.push(
      Object.entries(c.analysis || {})
        .map(([section, text]) => `#### ${section}\n${truncComp(text)}`)
        .join("\n")
    );
    parts.push("\n");
  }

  const scoreLine = weightedScore != null ? `Overall score: ${weightedScore.toFixed(1)}/10` : "Overall score: —/10";
  const competitorUrls = (input.competitors || []).map((c) => c.url);
  const competitorUrlsList = competitorUrls.length ? competitorUrls.join(", ") : "(none)";

  const gapsPrompt = buildGapsPromptBlock(input.userUrl, competitorUrlsList);

  const bestPracticesPrompt = `
---
BEST PRACTICES CHECKLIST (2026)

Evaluate the Target page against these checks. Output a fenced JSON block tagged \`\`\`best_practices_json with an array of objects:
{ "id": "<snake_case_id>", "label": "<check name>", "pass": true|false|null, "impact": "High"|"Medium"|"Low", "note": "<1 sentence evidence or reason>" }

Checks (use these exact IDs):
1. benefit_headline — Benefit-driven headline (not feature-driven)
2. cta_above_fold — CTA visible without scrolling
3. social_proof_above_fold — Social proof above the fold
4. mobile_optimized — Mobile-optimized (thumb-friendly CTA areas)
5. video_demo — Video or interactive demo present
6. readability — Readability at 7th grade or below
7. single_goal — Single primary goal per page
8. specific_outcomes — Specific outcomes vs abstract claims
9. logo_trust_bar — Logo/trust bar present
10. friction_reducer — "No credit card" or friction reducer present
11. sticky_cta — Sticky CTA on scroll
12. product_screenshots — Real product screenshots (not generic illustrations)
13. comparison_pricing — Comparison or pricing table present
14. aeo_ready — AEO-ready (semantic HTML, structured data)

If you cannot determine a check from available data, set pass to null.
`;

  const journeyPrompt = `
---
CUSTOMER JOURNEY MAP

Evaluate Target against the 7-stage SaaS customer journey. Output a fenced JSON block tagged \`\`\`journey_json with an array of objects:
{ "stage": "<stage_name>", "status": "addressed"|"partial"|"missing", "evidence": "<1 sentence>" }

Stages:
1. Awareness — Does headline clearly communicate what the product is?
2. Consideration — Are comparison elements, case studies, or demo CTAs present?
3. Trial — Is there a free trial / freemium CTA? How prominent?
4. Activation — Does the page hint at time-to-value or "aha moment"?
5. Conversion — Are pricing/upgrade paths clear?
6. Retention — Is there community, docs, or support link?
7. Advocacy — Are referral programs, review links visible?
`;

  const designPatternsPrompt = `
---
DESIGN PATTERNS

Identify which of these 8 proven landing page patterns the Target uses. Output a fenced JSON block tagged \`\`\`patterns_json with an array of objects:
{ "id": "<snake_case>", "label": "<pattern name>", "present": true|false, "note": "<1 sentence>" }

Patterns:
1. minimal_nav — Minimal nav with single primary CTA
2. benefit_hero — Hero with benefit-driven headline
3. logo_bar — Logo/trust bar
4. problem_empathy — Problem empathy section (addresses pain points)
5. show_dont_tell — Show-don't-tell features (screenshots, demos, not just text)
6. metric_testimonials — Metric-backed testimonials (specific numbers/results)
7. anchored_pricing — Anchored pricing tiers
8. final_cta — Final CTA restating core benefit
`;

  const actionPlanPrompt = `
---
ACTION PLAN

Based on all analysis above, generate a prioritized 4-week action plan. Output a fenced JSON block tagged \`\`\`action_plan_json with an array of objects:
{ "week": 1|2|3|4, "impact": "High"|"Medium"|"Low", "action": "<specific actionable task, max 15 words>", "rationale": "<1 sentence why>" }

Generate 4-6 actions total, ordered by impact.
`;

  const ctaTrustPrompt = `
---
CTA & TRUST SIGNALS INVENTORY

Analyze the Target page for CTA elements and trust signals. Output a fenced JSON block tagged \`\`\`cta_trust_json with this structure:
{
  "ctas": [{ "text": "<button/link text>", "position": "above_fold"|"below_fold", "type": "primary"|"secondary"|"text_link" }],
  "frictionReducers": ["<e.g. No credit card required, Free trial, etc>"],
  "stickyCta": true|false|null,
  "formFieldCount": <number or null>,
  "trustSignals": {
    "logoBadgeCount": <number>,
    "testimonialCount": <number>,
    "namedTestimonials": true|false,
    "caseStudyCount": <number>,
    "securityBadges": ["<e.g. SOC2, GDPR, SSL>"],
    "pressMentions": <number>,
    "ratingScore": "<e.g. 4.9 on G2>" | null
  }
}

Only report what is actually visible on the page. Use null for items you cannot determine.
`;

  const copySuggestionsPrompt = `
---
COPY SUGGESTIONS

For each section scored below 7/10, suggest 2 alternative headline or CTA copy options inspired by what competitors do well. Output a fenced JSON block tagged \`\`\`copy_suggestions_json with an array:
{ "section": "hero"|"value_prop"|"features"|"social_proof"|"cta", "current": "<current text if visible>", "suggestions": ["<option 1>", "<option 2>"] }

Only include sections that scored below 7.
`;

  const prompt = `${parts.join("")}

Markdown report — first line exactly: "${scoreLine}"
Then use these H2 headings in order (## exactly): ## Executive summary — 2–4 tight sentences · ## Strengths vs competitors — bullets OK · ## Gaps and recommendations — cite evidence from above only · ## Top 3 next steps — numbered list. Use ### only for short subheads inside a section if needed. Prefer brevity; avoid repetition.

---
CRITICAL GAPS

${gapsPrompt}

${bestPracticesPrompt}

${journeyPrompt}

${designPatternsPrompt}

${actionPlanPrompt}

${ctaTrustPrompt}

${copySuggestionsPrompt}

---
COMPETITIVE EDGE ANALYSIS

For each competitor analyzed, identify 3-5 specific elements where they outperform the Target. Output a fenced JSON block tagged \`\`\`competitive_edge_json with an array:
[{
  "competitor": "<domain>",
  "advantages": [{
    "element": "<specific UI/copy/UX element, max 6 words>",
    "theirApproach": "<what they do well, with specifics>",
    "yourWeakness": "<what Target does poorly in this area>",
    "stealThis": "<concrete action to implement, max 20 words>",
    "effort": "Quick Win"|"Medium"|"Strategic"
  }]
}]

Focus on actionable, specific differences — not generic advice. Reference actual page elements.

---
UX IMPROVEMENT HINTS

For every section scored below 7/10 on the Target, generate a specific fix. Output a fenced JSON block tagged \`\`\`ux_hints_json with an array:
[{
  "section": "hero"|"value_prop"|"features"|"social_proof"|"cta",
  "score": <number>,
  "issue": "<specific problem, max 10 words>",
  "hint": "<exact fix instruction with example copy/layout change>",
  "effort": "15 min"|"1 hour"|"half day"|"1-2 days",
  "impact": "High"|"Medium"|"Low",
  "impactReason": "<1 sentence why this matters for conversion>",
  "reference": "<competitor that does this well, if any>"
}]

Be hyper-specific: quote actual text from Target, suggest exact replacement copy, reference real competitor elements.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: SYNTHESIS_MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  logClaudeUsage("synthesis", MODEL, msg);

  const textBlock = msg.content.find((b) => b.type === "text");
  let report = textBlock ? textBlock.text : "";

  const extractTaggedJson = (tag) => {
    const re = new RegExp("```" + tag + "\\s*([\\s\\S]*?)```");
    const m = report.match(re);
    if (m) {
      report = report.replace(re, "").trim();
      try { return JSON.parse(m[1].trim()); } catch { return null; }
    }
    return null;
  };

  const bestPractices = extractTaggedJson("best_practices_json") || [];
  const journeyMap = extractTaggedJson("journey_json") || [];
  const designPatterns = extractTaggedJson("patterns_json") || [];
  const actionPlan = extractTaggedJson("action_plan_json") || [];
  const ctaTrust = extractTaggedJson("cta_trust_json") || null;
  const copySuggestions = extractTaggedJson("copy_suggestions_json") || [];
  const competitiveEdge = extractTaggedJson("competitive_edge_json") || [];
  const uxHints = extractTaggedJson("ux_hints_json") || [];

  const jsonBlockMatch = report.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    report = report.replace(/\n?```(?:json)?\s*[\s\S]*?```\s*/, "").trim();
  }

  report = report.replace(/\n?```\w*\s*[\s\S]*?```\s*/g, "").trim();

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
        .map((g) => {
          const benchUrl = g.competitor_benchmark?.url || "";
          return {
            priority: g.priority === "P1" || g.priority === "P2" ? g.priority : "P2",
            area: sectionToArea(g.section) || g.title || "General",
            problem: g.problem || "",
            recommendation: g.recommendation || "",
            competitor: getDomainFromUrl(benchUrl || g.competitor_benchmark || ""),
            confidence: g.severity === "High" || g.severity === "Medium" || g.severity === "Low" ? g.severity : "Medium",
            title: g.title || undefined,
            evidence: g.evidence || undefined,
            competitorAction: g.competitor_benchmark?.what_they_do || undefined,
            competitorUrl: benchUrl || undefined,
          };
        });
    } catch (_) {
      gaps = [];
    }
  }

  return {
    report,
    overall_score: weightedScore ?? undefined,
    gaps,
    bestPractices: Array.isArray(bestPractices) ? bestPractices : [],
    journeyMap: Array.isArray(journeyMap) ? journeyMap : [],
    designPatterns: Array.isArray(designPatterns) ? designPatterns : [],
    actionPlan: Array.isArray(actionPlan) ? actionPlan : [],
    ctaTrust: ctaTrust && typeof ctaTrust === "object" ? ctaTrust : null,
    copySuggestions: Array.isArray(copySuggestions) ? copySuggestions : [],
    competitiveEdge: Array.isArray(competitiveEdge) ? competitiveEdge : [],
    uxHints: Array.isArray(uxHints) ? uxHints : [],
  };
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

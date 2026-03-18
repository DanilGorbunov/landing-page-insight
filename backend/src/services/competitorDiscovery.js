import Anthropic from "@anthropic-ai/sdk";

const DISCOVERY_MODEL = "claude-sonnet-4-20250514";
const TAVILY_API = "https://api.tavily.com/search";

const SKIP_PATHS = ["/blog/", "/alternatives", "/competitors", "/vs-"];

/**
 * Extract plain domain from URL or domain string.
 * @param {string} domainOrProduct - e.g. "https://apollo.io" or "apollo.io"
 * @returns {string} e.g. "apollo.io"
 */
function extractDomain(domainOrProduct) {
  const s = (domainOrProduct || "").trim();
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      return u.hostname || s;
    }
    return s.replace(/\/.*$/, "").split(" ")[0];
  } catch {
    return s;
  }
}

/**
 * Filter out URLs that contain blog, alternatives, competitors, or vs- paths.
 * @param {string[]} urls
 * @returns {string[]}
 */
function extractCompetitorUrls(urls) {
  return (urls || []).filter((url) => {
    const lower = url.toLowerCase();
    return !SKIP_PATHS.some((path) => lower.includes(path));
  });
}

/**
 * Parse JSON array from Claude response (may be wrapped in markdown code fence).
 * @param {string} text
 * @returns {string[]} array of domains
 */
function parseClaudeCompetitors(text) {
  let raw = (text || "").trim();
  const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) raw = codeMatch[1].trim();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x) => typeof x === "string" && x.length > 0);
}

/**
 * Validate that a domain returns at least one Tavily result (site exists).
 * @param {string} domain
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
async function tavilyValidateDomain(domain, apiKey) {
  const res = await fetch(TAVILY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: domain,
      search_depth: "basic",
      max_results: 1,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  const results = data.results || [];
  return results.length > 0;
}

/**
 * Find competitor sites: Claude for discovery, optional Tavily for validation.
 * @param {string} domainOrProduct - e.g. "myapp.com" or "https://apollo.io"
 * @returns {Promise<Array<{ url: string, title?: string }>>}
 */
export async function findCompetitors(domainOrProduct) {
  const domain = extractDomain(domainOrProduct);
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: DISCOVERY_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `What are the 4 most direct competitors of ${domain}?
Return ONLY a JSON array of domains, nothing else.
Example: ["competitor1.com", "competitor2.com"]
Rules:
- Only homepage domains (no /blog/ paths)
- Direct competitors in same category
- Real companies with landing pages`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock ? textBlock.text : "";
  let domains = [];
  try {
    domains = parseClaudeCompetitors(rawText);
  } catch {
    domains = [];
  }

  const urls = domains.map((d) => {
    const d2 = d.trim().toLowerCase();
    return d2.startsWith("http") ? d2 : `https://${d2}`;
  });
  const filtered = extractCompetitorUrls(urls);

  const tavilyKey = process.env.TAVILY_API_KEY;
  let results = filtered.slice(0, 4).map((url) => ({ url, title: undefined }));

  if (tavilyKey) {
    const validated = [];
    for (const { url } of results) {
      const domainForCheck = url.replace(/^https?:\/\//, "").split("/")[0];
      const ok = await tavilyValidateDomain(domainForCheck, tavilyKey);
      if (ok) validated.push({ url, title: domainForCheck });
    }
    results = validated.length > 0 ? validated : results;
  }

  return results.slice(0, 4);
}

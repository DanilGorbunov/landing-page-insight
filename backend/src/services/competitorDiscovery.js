import Anthropic from "@anthropic-ai/sdk";
import { logClaudeUsage } from "../utils/claudeUsageLog.js";

/** Haiku is sufficient for finding competitor domains — no analysis needed. */
const DISCOVERY_MODEL = "claude-haiku-4-5-20251001";
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
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) raw = arrMatch[0];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed.filter((x) => typeof x === "string" && x.length > 0);
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.domains)) {
    return parsed.domains.filter((x) => typeof x === "string" && x.length > 0);
  }
  return [];
}

const TAVILY_CHECK_TIMEOUT_MS = 4000;

/**
 * Validate that a domain returns at least one Tavily result (site exists).
 * @param {string} domain
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
async function tavilyValidateDomain(domain, apiKey) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TAVILY_CHECK_TIMEOUT_MS);
    const res = await fetch(TAVILY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: domain,
        search_depth: "basic",
        max_results: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json();
    const results = data.results || [];
    return results.length > 0;
  } catch {
    return false;
  }
}

const PAGE_CONTEXT_MAX_CHARS = 1200;

/**
 * Instructions: classify business model → niche → pick same-type competitors → validate.
 * Keeps output as JSON array only (no API contract change).
 */
function buildDiscoveryUserPrompt(domain, contextBlock) {
  return `You find DIRECT COMPETITORS for homepage comparison. Follow these steps internally; your ONLY output is the final JSON array of domains.

STEP 1 — CLASSIFY SITE TYPE (from homepage signals in the page content below)

PRIMARY CTA signals:
- "Book a call" / "Contact us" / "Hire us" → likely AGENCY / SERVICES
- "Sign up free" / "Start trial" / "Get started" → likely SAAS
- "Request demo" → ambiguous; use pricing + content + nav

PRICING signals:
- Monthly/annual fixed tiers ($X/mo) → likely SAAS
- "Custom pricing" / "Contact for pricing" → likely AGENCY
- No pricing page → often AGENCY / services

CONTENT signals:
- Case studies / Our work / Portfolio → likely AGENCY
- Features / Integrations / API docs → likely SAAS

SOCIAL PROOF signals:
- Clutch / Dribbble / Behance → often AGENCY
- G2 / Product Hunt / AppSumo → often SAAS
- Client logos "we worked with" → often AGENCY
- User logos "trusted by X users" → often SAAS

NAV signals:
- Team / About with people photos → often AGENCY
- Changelog / Status page → often SAAS

STEP 2 — DETERMINE NICHE (internal reasoning only)

If AGENCY: infer industries served + services (e.g. "SaaS design agency", "fintech UX agency", "brand studio").
If SAAS: infer category + user + use case (e.g. "project management for teams", "sales intelligence").

If the page is clearly ECOMMERCE (catalog, cart, SKUs) or MARKETPLACE (two-sided), classify that way and match direct retail/marketplace competitors — not agencies.

STEP 3 — FIND COMPETITORS (same business model ONLY)

If AGENCY: think "[niche] agency" / similar services + industry — suggest OTHER AGENCIES/STUDIOS, not SaaS products.
If SAAS: think "[category] software alternatives" — suggest OTHER SAAS PRODUCTS, not agencies.

NEVER suggest SaaS tools as competitors for an agency site.
NEVER suggest agencies as competitors for a SaaS product site.

STEP 4 — VALIDATE EACH CANDIDATE (discard if any fail)

For each remaining candidate ask:
1. Same buyer? (similar role, similar company size)
2. Same core problem solved?
3. Would a real customer shortlist BOTH this site and ${domain}?

Remove any that fail.

---

Target site: ${domain}
${contextBlock}

OUTPUT FORMAT (strict):
Return ONLY a JSON array of exactly 4 homepage domain strings (no paths, no markdown).
Example: ["competitor1.com", "competitor2.com", "competitor3.com", "competitor4.com"]

Rules:
- Real companies with public marketing sites
- Same business model as classified above (agency vs SaaS vs ecommerce vs marketplace)
- Direct competitors only; exclude ${domain} itself and obvious non-competitors
- Use page content above to infer business model — not the domain name alone`;
}

/**
 * Find competitor sites: Claude for discovery, optional Tavily for validation.
 * @param {string} domainOrProduct - e.g. "myapp.com" or "https://apollo.io"
 * @param {{ pageMarkdown?: string }} [opts] - optional page content for better context
 * @returns {Promise<Array<{ url: string, title?: string }>>}
 */
export async function findCompetitors(domainOrProduct, opts = {}) {
  const domain = extractDomain(domainOrProduct);
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY_LAND_LENS;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or CLAUDE_API_KEY_LAND_LENS is not set");

  const client = new Anthropic({ apiKey });

  const contextBlock = opts.pageMarkdown
    ? `Here is content from ${domain}'s landing page (use for classification and niche):\n---\n${opts.pageMarkdown.slice(0, PAGE_CONTEXT_MAX_CHARS)}\n---\n`
    : "No page body was provided — classify from the domain and public knowledge, but prefer conservative same-industry competitors.\n";

  const userContent = buildDiscoveryUserPrompt(domain, contextBlock);

  let response;
  try {
    response = await client.messages.create({
      model: DISCOVERY_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });
  } catch (e) {
    console.error("[discovery] Claude API error:", e?.message || e);
    throw e;
  }

  logClaudeUsage("discovery", DISCOVERY_MODEL, response);

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
    try {
      const checks = await Promise.all(
        results.map(async ({ url }) => {
          const domainForCheck = url.replace(/^https?:\/\//, "").split("/")[0];
          const ok = await tavilyValidateDomain(domainForCheck, tavilyKey);
          return ok ? { url, title: domainForCheck } : null;
        })
      );
      const validated = checks.filter(Boolean);
      if (validated.length > 0) results = validated;
    } catch (e) {
      console.warn("[discovery] tavily validation failed, using unvalidated list:", e?.message);
    }
  }

  return results.slice(0, 4);
}

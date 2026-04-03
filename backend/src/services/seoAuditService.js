/**
 * SEO audit from raw HTML — no external dependencies, pure regex parsing.
 * Returns structured audit items grouped by category, each with pass/warn/fail + hint.
 */

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function countTag(html, tag) {
  const re = new RegExp(`<${tag}[\\s>]`, "gi");
  return (html.match(re) || []).length;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function item(id, category, label, status, value, hint) {
  return { id, category, label, status, value: value ?? null, hint: hint ?? null };
}

/**
 * @param {string} html - raw HTML string
 * @param {string} pageUrl - the page URL (for link analysis)
 * @returns {{ items: Array<object>, passCount: number, warnCount: number, failCount: number, total: number }}
 */
export function runSeoAudit(html, pageUrl) {
  if (!html || typeof html !== "string") {
    return { items: [], passCount: 0, warnCount: 0, failCount: 0, total: 0 };
  }

  const items = [];
  let pageHost;
  try { pageHost = new URL(pageUrl).hostname; } catch { pageHost = ""; }

  // --- META ---
  const title = extractTitle(html);
  const titleLen = title ? title.length : 0;
  items.push(item("title_tag", "Meta", "Title tag", title ? "pass" : "fail",
    title ? `"${title}" (${titleLen} chars)` : "Missing",
    title ? (titleLen < 30 ? "Title is short — aim for 50-60 characters for optimal SERP display" : titleLen > 65 ? "Title is long — may be truncated in search results, keep under 60 chars" : null) : "Add a <title> tag — it's the #1 on-page SEO factor"));

  const desc = meta(html, "description");
  const descLen = desc ? desc.length : 0;
  items.push(item("meta_desc", "Meta", "Meta description", desc ? (descLen >= 120 && descLen <= 160 ? "pass" : "warn") : "fail",
    desc ? `${descLen} chars` : "Missing",
    !desc ? "Add a meta description (150-160 chars) — improves CTR from search results" : descLen < 120 ? "Description is short — aim for 150-160 chars for full SERP snippet" : descLen > 160 ? "Description may be truncated — keep under 160 characters" : null));

  const viewport = meta(html, "viewport");
  items.push(item("viewport", "Meta", "Viewport meta", viewport ? "pass" : "fail",
    viewport ? "Present" : "Missing",
    viewport ? null : "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> for mobile optimization"));

  const robots = meta(html, "robots");
  const blocked = robots && /noindex/i.test(robots);
  items.push(item("robots", "Meta", "Robots directive", blocked ? "warn" : "pass",
    robots || "Not set (defaults to index,follow)",
    blocked ? "Page is set to noindex — search engines will not index this page" : null));

  const keywords = meta(html, "keywords");
  items.push(item("keywords", "Meta", "Meta keywords", "pass",
    keywords ? `Present (${keywords.split(",").length} keywords)` : "Not set",
    null));

  // --- SOCIAL ---
  const ogTitle = meta(html, "og:title");
  const ogDesc = meta(html, "og:description");
  const ogImage = meta(html, "og:image");
  const ogUrl = meta(html, "og:url");
  const ogCount = [ogTitle, ogDesc, ogImage, ogUrl].filter(Boolean).length;
  items.push(item("og_tags", "Social", "Open Graph tags", ogCount >= 3 ? "pass" : ogCount >= 1 ? "warn" : "fail",
    `${ogCount}/4 present (title: ${ogTitle ? "✓" : "✗"}, desc: ${ogDesc ? "✓" : "✗"}, image: ${ogImage ? "✓" : "✗"}, url: ${ogUrl ? "✓" : "✗"})`,
    ogCount < 3 ? "Add Open Graph tags for better social media sharing previews — og:title, og:description, og:image are essential" : null));

  const twCard = meta(html, "twitter:card");
  const twTitle = meta(html, "twitter:title");
  items.push(item("twitter_card", "Social", "Twitter Card", twCard ? "pass" : "warn",
    twCard ? `${twCard}` : "Missing",
    twCard ? null : "Add <meta name=\"twitter:card\" content=\"summary_large_image\"> for Twitter/X sharing"));

  // --- STRUCTURE ---
  const h1Count = countTag(html, "h1");
  items.push(item("h1_count", "Structure", "H1 heading", h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warn",
    `${h1Count} found`,
    h1Count === 0 ? "Add exactly one H1 heading — it defines the page's primary topic for search engines" : h1Count > 1 ? `${h1Count} H1 tags found — use exactly one H1 per page, convert others to H2` : null));

  const h2Count = countTag(html, "h2");
  const h3Count = countTag(html, "h3");
  items.push(item("heading_hierarchy", "Structure", "Heading hierarchy", h2Count > 0 ? "pass" : "warn",
    `H1: ${h1Count}, H2: ${h2Count}, H3: ${h3Count}`,
    h2Count === 0 ? "Add H2 subheadings to structure content — helps both readers and search engines" : null));

  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  items.push(item("canonical", "Structure", "Canonical URL", canonical ? "pass" : "warn",
    canonical ? canonical[1] : "Not set",
    canonical ? null : "Add a canonical link to prevent duplicate content issues"));

  const langAttr = html.match(/<html[^>]+lang=["']([^"']*)["']/i);
  items.push(item("lang", "Structure", "Language attribute", langAttr ? "pass" : "warn",
    langAttr ? langAttr[1] : "Not set",
    langAttr ? null : "Add lang attribute to <html> tag (e.g. lang=\"en\") for accessibility and SEO"));

  const jsonLd = (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length;
  items.push(item("structured_data", "Structure", "Structured data (JSON-LD)", jsonLd > 0 ? "pass" : "warn",
    jsonLd > 0 ? `${jsonLd} schema(s) found` : "None found",
    jsonLd === 0 ? "Add JSON-LD structured data (Organization, WebPage, FAQPage) to enable rich search results" : null));

  // --- CONTENT ---
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imgTotal = imgTags.length;
  const imgNoAlt = imgTags.filter((t) => !t.match(/alt=["'][^"']+["']/i)).length;
  items.push(item("img_alt", "Content", "Image alt text", imgNoAlt === 0 ? "pass" : imgNoAlt <= 2 ? "warn" : "fail",
    `${imgTotal} images, ${imgNoAlt} missing alt text`,
    imgNoAlt > 0 ? `Add descriptive alt text to ${imgNoAlt} image(s) — critical for accessibility and image SEO` : null));

  const links = html.match(/<a[^>]+href=["']([^"']*)["']/gi) || [];
  let internal = 0, external = 0, nofollow = 0;
  for (const link of links) {
    const hrefM = link.match(/href=["']([^"']*)["']/i);
    if (!hrefM) continue;
    const href = hrefM[1];
    if (href.startsWith("#") || href.startsWith("javascript")) continue;
    try {
      const u = new URL(href, pageUrl);
      if (u.hostname === pageHost) internal++;
      else external++;
    } catch { internal++; }
    if (/rel=["'][^"']*nofollow/i.test(link)) nofollow++;
  }
  items.push(item("link_profile", "Content", "Link profile", "pass",
    `${internal} internal, ${external} external, ${nofollow} nofollow`,
    external === 0 && internal < 3 ? "Consider adding internal links to key pages and relevant external resources" : null));

  // --- TECHNICAL ---
  const favicon = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
  items.push(item("favicon", "Technical", "Favicon", favicon ? "pass" : "warn",
    favicon ? "Present" : "Missing",
    favicon ? null : "Add a favicon — it improves brand recognition in browser tabs and bookmarks"));

  const charset = html.match(/<meta[^>]+charset=["']?([^"'\s>]+)/i);
  items.push(item("charset", "Technical", "Character encoding", charset ? "pass" : "warn",
    charset ? charset[1].toUpperCase() : "Not declared",
    charset ? null : "Add <meta charset=\"UTF-8\"> as the first element in <head>"));

  const https = pageUrl.startsWith("https");
  items.push(item("https", "Technical", "HTTPS", https ? "pass" : "fail",
    https ? "Secure" : "Not secure",
    https ? null : "Migrate to HTTPS — required for SEO ranking and user trust"));

  const passCount = items.filter((i) => i.status === "pass").length;
  const warnCount = items.filter((i) => i.status === "warn").length;
  const failCount = items.filter((i) => i.status === "fail").length;

  return { items, passCount, warnCount, failCount, total: items.length };
}

const FIRECRAWL_API = "https://api.firecrawl.dev/v1/scrape";

async function firecrawlFetch(url, formats, waitFor) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set");

  const res = await fetch(FIRECRAWL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ url, formats, waitFor }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firecrawl error: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.error || "Firecrawl returned no data");
  }
  return data.data;
}

/**
 * Scrape the USER's page: markdown + full-page screenshot + rawHtml (for SEO audit).
 * @param {string} url
 * @returns {Promise<{ markdown: string, screenshot: string|null, html: string }>}
 */
export async function scrapeWithScreenshot(url) {
  const d = await firecrawlFetch(url, ["markdown", "screenshot@fullPage", "rawHtml"], 2000);
  return { markdown: d.markdown || "", screenshot: d.screenshot || null, html: d.rawHtml || "" };
}

/**
 * Scrape a COMPETITOR page: markdown + screenshot only — no rawHtml, shorter wait.
 * @param {string} url
 * @returns {Promise<{ markdown: string, screenshot: string|null, html: string }>}
 */
export async function scrapeCompetitor(url) {
  const d = await firecrawlFetch(url, ["markdown", "screenshot@fullPage"], 1000);
  return { markdown: d.markdown || "", screenshot: d.screenshot || null, html: "" };
}

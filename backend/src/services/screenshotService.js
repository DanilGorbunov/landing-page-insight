const FIRECRAWL_API = "https://api.firecrawl.dev/v1/scrape";

/**
 * Scrape URL via Firecrawl: get markdown + screenshot URL.
 * @param {string} url - Page URL
 * @returns {Promise<{ markdown?: string, screenshot?: string }>}
 */
export async function scrapeWithScreenshot(url) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set");

  const res = await fetch(FIRECRAWL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "screenshot"],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firecrawl error: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!data.success || !data.data) {
    throw new Error(data.error || "Firecrawl returned no data");
  }

  const { markdown, screenshot } = data.data;
  return { markdown: markdown || "", screenshot: screenshot || null };
}

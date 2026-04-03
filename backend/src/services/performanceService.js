const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 30_000;

/**
 * Fetch PageSpeed Insights for a URL (mobile strategy).
 * Free tier, no API key required for basic usage.
 * @param {string} url
 * @returns {Promise<object|null>}
 */
export async function fetchPageSpeedMetrics(url) {
  try {
    const params = new URLSearchParams();
    params.set("url", url);
    params.set("strategy", "mobile");
    for (const cat of ["performance", "accessibility", "seo", "best-practices"]) {
      params.append("category", cat);
    }

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (apiKey) params.set("key", apiKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${PSI_API}?${params}`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[pagespeed] ${res.status} for ${url}`);
      return null;
    }

    const data = await res.json();
    return parsePageSpeedResult(data);
  } catch (err) {
    console.warn(`[pagespeed] failed for ${url}:`, err?.message || err);
    return null;
  }
}

function parsePageSpeedResult(data) {
  const lhr = data?.lighthouseResult;
  if (!lhr) return null;

  const cats = lhr.categories || {};
  const audits = lhr.audits || {};

  const getMetricMs = (id) => audits[id]?.numericValue ?? null;
  const getCatScore = (id) => (cats[id]?.score != null ? Math.round(cats[id].score * 100) : null);

  return {
    scores: {
      performance: getCatScore("performance"),
      accessibility: getCatScore("accessibility"),
      seo: getCatScore("seo"),
      bestPractices: getCatScore("best-practices"),
    },
    metrics: {
      lcp: getMetricMs("largest-contentful-paint"),
      fcp: getMetricMs("first-contentful-paint"),
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      inp: getMetricMs("interaction-to-next-paint") ?? getMetricMs("total-blocking-time"),
      speedIndex: getMetricMs("speed-index"),
      tbt: getMetricMs("total-blocking-time"),
    },
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch metrics for multiple URLs in parallel.
 * @param {string[]} urls
 * @returns {Promise<Array<{ url: string, metrics: object|null }>>}
 */
export async function fetchPageSpeedBatch(urls) {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const metrics = await fetchPageSpeedMetrics(url);
      return { url, ...metrics };
    })
  );
  return results.map((r) =>
    r.status === "fulfilled" ? r.value : { url: "", scores: null, metrics: null }
  );
}

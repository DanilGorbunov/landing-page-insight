const TAVILY_API = "https://api.tavily.com/search";

/**
 * Find competitor sites for a given SaaS landing using Tavily.
 * @param {string} domainOrProduct - e.g. "myapp.com" or "MyApp SaaS"
 * @returns {Promise<Array<{ url: string, title?: string }>>}
 */
export async function findCompetitors(domainOrProduct) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const query = `competitors of ${domainOrProduct} SaaS landing page`;
  const res = await fetch(TAVILY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 10,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const results = data.results || [];
  return results.slice(0, 3).map((r) => ({
    url: r.url,
    title: r.title,
  }));
}

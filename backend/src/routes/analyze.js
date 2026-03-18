import crypto from "crypto";
import { Router } from "express";
import { jobStore } from "../utils/jobStore.js";
import { scrapeWithScreenshot } from "../services/screenshotService.js";
import { findCompetitors } from "../services/competitorDiscovery.js";
import { analyzeLandingSections } from "../services/analysisService.js";
import { synthesizeReport } from "../services/synthesisService.js";

export const analyzeRouter = Router();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — reuse result for same URL
/** Cache key = md5(url + date) so different sites never share cached result. Gaps live only inside synthesis report. */
/** @type {Map<string, { result: object, cachedAt: number }>} */
const resultCache = new Map();

function getCacheKey(url) {
  const dateStr = new Date().toISOString().slice(0, 10);
  return crypto.createHash("md5").update(String(url || "").trim() + dateStr).digest("hex");
}

function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
  }
}

function normalizeCompetitorUrl(raw) {
  const u = (raw && String(raw).trim()) || "";
  if (!u) return "";
  try {
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    return parsed.origin + parsed.pathname.replace(/\/+$/, "") || parsed.origin;
  } catch {
    return u;
  }
}

function pushProgress(jobId, entry) {
  const job = jobStore.getJob(jobId);
  if (!job) return;
  const progress = [...(job.progress || []), entry];
  jobStore.updateJob(jobId, { progress });
}

/**
 * Run full analysis pipeline in background. Updates job via jobStore (progress, result, error).
 * If domain was analyzed in the last 24h, returns cached result (no tokens, no rerun).
 */
async function runPipeline(jobId) {
  const job = jobStore.getJob(jobId);
  if (!job || !job.url) {
    jobStore.updateJob(jobId, { status: "failed", error: "Missing url for this job" });
    return;
  }
  const userUrl = job.url;
  const cacheKey = getCacheKey(userUrl);
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    jobStore.updateJob(jobId, { status: "running" });
    pushProgress(jobId, { step: "started", message: "Using cached result (analyzed in last 24h)" });
    pushProgress(jobId, { step: "discovering", message: "Finding competitors..." });
    pushProgress(jobId, { step: "competitors", competitors: [] });
    pushProgress(jobId, { step: "screenshot", message: "Screenshots captured" });
    pushProgress(jobId, { step: "analyzing", message: "Analyzing with Claude Vision..." });
    pushProgress(jobId, { step: "synthesis", message: "Writing report..." });
    jobStore.updateJob(jobId, { status: "completed", result: cached.result });
    return;
  }

  jobStore.updateJob(jobId, { status: "running" });
  pushProgress(jobId, { step: "started", message: "Starting analysis" });

  try {
    const manualUrls = (job.competitors || [])
      .map(normalizeCompetitorUrl)
      .filter(Boolean)
      .slice(0, 3);
    pushProgress(jobId, { step: "discovering", message: "Finding competitors..." });
    const autoDiscovered = await findCompetitors(userUrl);
    const userDomain = getDomain(userUrl);
    const combined = [...manualUrls];
    for (const c of autoDiscovered) {
      if (combined.length >= 3) break;
      const u = c.url;
      const d = getDomain(u);
      if (d && d !== userDomain && !combined.some((x) => getDomain(x) === d)) combined.push(u);
    }
    pushProgress(jobId, { step: "competitors", competitors: combined });

    const toScrape = [{ url: userUrl, isUser: true }, ...combined.map((url) => ({ url, isUser: false }))];
    pushProgress(jobId, { step: "screenshot", message: "Capturing screenshots..." });
    const scrapeResults = await Promise.all(
      toScrape.map(async (item) => {
        const data = await scrapeWithScreenshot(item.url);
        return { url: item.url, isUser: item.isUser, ...data };
      })
    );
    pushProgress(jobId, { step: "screenshot", index: toScrape.length, total: toScrape.length, message: "Screenshots captured" });

    pushProgress(jobId, { step: "analyzing", message: "Analyzing with Claude Vision..." });
    const userScrape = scrapeResults.find((r) => r.isUser);
    const competitorScrapes = scrapeResults.filter((r) => !r.isUser);
    const analysisTasks = [
      ...(userScrape ? [{ scrape: userScrape, isUser: true }] : []),
      ...competitorScrapes.map((s) => ({ scrape: s, isUser: false })),
    ];
    const CONCURRENCY = 4; // all 4 sites in parallel; use 2 or 1 if you get 429 from Anthropic
    const runPool = async () => {
      const results = [];
      let next = 0;
      const runOne = async (idx) => {
        if (idx >= analysisTasks.length) return null;
        const { scrape, isUser } = analysisTasks[idx];
        const analysis = await analyzeLandingSections(
          { markdown: scrape.markdown, screenshotUrl: scrape.screenshot, url: scrape.url },
          isUser
        );
        return { isUser, url: scrape.url, analysis };
      };
      const workers = Array.from({ length: Math.min(CONCURRENCY, analysisTasks.length) }, () =>
        (async () => {
          while (true) {
            const idx = next++;
            if (idx >= analysisTasks.length) return;
            const one = await runOne(idx);
            if (one) results.push(one);
          }
        })()
      );
      await Promise.all(workers);
      return results;
    };
    const analysisResults = await runPool();
    const byUrl = new Map(analysisResults.map((r) => [r.url, r]));
    const userAnalysis = (userScrape && byUrl.get(userScrape.url))?.analysis ?? {};
    const competitorAnalyses = competitorScrapes.map((s) => ({
      url: s.url,
      analysis: byUrl.get(s.url)?.analysis ?? {},
    }));

    pushProgress(jobId, { step: "synthesis", message: "Writing report..." });
    const { report, overall_score: overallScore, gaps: synthesisGaps } = await synthesizeReport({
      userUrl,
      userAnalysis,
      competitors: competitorAnalyses,
    });

    const targetScreenshotUrl = userScrape?.screenshot || null;
    const competitorsWithScreenshots = competitorAnalyses.map((c) => {
      const scraped = scrapeResults.find((r) => r.url === c.url);
      return { ...c, screenshotUrl: scraped?.screenshot || null };
    });
    // Gaps are part of the full result object — always from current synthesis, never stored/read separately
    const result = {
      report,
      userAnalysis,
      competitors: competitorsWithScreenshots,
      targetScreenshotUrl,
      synthesis: overallScore != null ? { overall_score: overallScore } : undefined,
      gaps: Array.isArray(synthesisGaps) ? synthesisGaps : [],
    };
    resultCache.set(cacheKey, { result, cachedAt: Date.now() });
    jobStore.updateJob(jobId, { status: "completed", result });
  } catch (err) {
    console.error("[analyze] Error:", err.message || err);
    jobStore.updateJob(jobId, { status: "failed", error: err.message });
  }
}

/**
 * POST /api/analyze
 * Body: { url: string }
 * Returns: { jobId: string } immediately. Pipeline runs in background; poll GET /api/analyze/job/:jobId for progress.
 */
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

analyzeRouter.post("/analyze", (req, res) => {
  const url = req.body?.url?.trim();
  if (!url) {
    return res.status(400).json({ error: "Missing url" });
  }
  if (!isValidHttpUrl(url)) {
    return res.status(400).json({ error: "Invalid url: must be http or https" });
  }
  const rawCompetitors = Array.isArray(req.body?.competitors) ? req.body.competitors : [];
  const competitors = rawCompetitors
    .map(normalizeCompetitorUrl)
    .filter((u) => u && isValidHttpUrl(u))
    .slice(0, 3);
  const job = jobStore.createJob({ url, competitors });
  runPipeline(job.id).catch((e) => console.error("[analyze] runPipeline error:", e));
  res.json({ jobId: job.id });
});

/**
 * GET /api/analyze/job/:jobId
 * Returns current job status, progress, and result when completed. Use polling (e.g. every 2s) instead of SSE to avoid timeouts.
 */
analyzeRouter.get("/analyze/job/:jobId", (req, res) => {
  const job = jobStore.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress || [],
    result: job.result,
    error: job.error,
  });
});

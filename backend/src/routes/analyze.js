import crypto from "crypto";
import { Router } from "express";
import {
  CACHE_TTL_MS,
  DISCOVERY_TIMEOUT_MS,
  SCRAPE_TIMEOUT_MS,
  PREFETCH_TIMEOUT_MS,
  ANALYSIS_CONCURRENCY,
  MAX_COMPETITORS,
} from "../config/constants.js";
import { validateAnalyzeBody } from "../middleware/validateAnalyze.js";
import { jobStore } from "../utils/jobStore.js";
import { scrapeWithScreenshot } from "../services/screenshotService.js";
import { findCompetitors } from "../services/competitorDiscovery.js";
import { analyzeLandingSections } from "../services/analysisService.js";
import { synthesizeReport } from "../services/synthesisService.js";

export const analyzeRouter = Router();

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
    const t0 = Date.now();
    const manualUrls = (job.competitors || []).filter(Boolean).slice(0, MAX_COMPETITORS);
    let combined;
    if (manualUrls.length >= MAX_COMPETITORS) {
      combined = manualUrls.slice(0, MAX_COMPETITORS);
      pushProgress(jobId, { step: "discovering", message: "Using provided competitors" });
      pushProgress(jobId, { step: "competitors", competitors: combined });
    } else {
      pushProgress(jobId, { step: "discovering", message: "Finding competitors..." });
      const autoDiscovered = await Promise.race([
        findCompetitors(userUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error("discovery_timeout")), DISCOVERY_TIMEOUT_MS)),
      ]).catch((e) => {
        if (e?.message === "discovery_timeout") console.warn("[analyze] discovery timeout, using manual only");
        return [];
      });
      const userDomain = getDomain(userUrl);
      combined = [...manualUrls];
      for (const c of autoDiscovered) {
        if (combined.length >= MAX_COMPETITORS) break;
        const u = c.url;
        const d = getDomain(u);
        if (d && d !== userDomain && !combined.some((x) => getDomain(x) === d)) combined.push(u);
      }
      pushProgress(jobId, { step: "competitors", competitors: combined });
    }
    console.log(JSON.stringify({ step: "discovery_done", durationMs: Date.now() - t0 }));

    const toScrape = [{ url: userUrl, isUser: true }, ...combined.map((url) => ({ url, isUser: false }))];
    pushProgress(jobId, { step: "screenshot", message: "Capturing screenshots..." });
    const t1 = Date.now();
    const scrapeWithTimeout = (item) =>
      Promise.race([
        scrapeWithScreenshot(item.url).then((data) => ({ url: item.url, isUser: item.isUser, ...data })),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`scrape_timeout:${item.url}`)), SCRAPE_TIMEOUT_MS)
        ),
      ]);
    let scrapeResults = await Promise.allSettled(toScrape.map(scrapeWithTimeout));
    const succeeded = scrapeResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    const userScrapeResult = succeeded.find((r) => r.isUser);
    if (!userScrapeResult) {
      const errMsg = scrapeResults.find((r) => r.status === "rejected")?.reason?.message || "Scrape failed";
      throw new Error(errMsg);
    }
    scrapeResults = succeeded;
    console.log(JSON.stringify({ step: "scrape_done", durationMs: Date.now() - t1, scraped: scrapeResults.length, total: toScrape.length }));

    scrapeResults = await Promise.all(
      scrapeResults.map(async (r) => {
        if (!r.screenshot) return { ...r, screenshotBase64: null };
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), PREFETCH_TIMEOUT_MS);
          const res = await fetch(r.screenshot, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            return { ...r, screenshotBase64: buf.toString("base64") };
          }
        } catch (e) {
          if (e?.name !== "AbortError") console.warn("[analyze] pre-fetch screenshot failed", r.url, e?.message);
        }
        return r;
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
    const t2 = Date.now();
    const runPool = async () => {
      const results = [];
      let next = 0;
      const runOne = async (idx) => {
        if (idx >= analysisTasks.length) return null;
        const { scrape, isUser } = analysisTasks[idx];
        const analysis = await analyzeLandingSections(
          {
            markdown: scrape.markdown,
            screenshotUrl: scrape.screenshot,
            screenshotBase64: scrape.screenshotBase64,
            url: scrape.url,
          },
          isUser
        );
        return { isUser, url: scrape.url, analysis };
      };
      const workers = Array.from({ length: Math.min(ANALYSIS_CONCURRENCY, analysisTasks.length) }, () =>
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
    console.log(JSON.stringify({ step: "vision_done", durationMs: Date.now() - t2 }));
    const byUrl = new Map(analysisResults.map((r) => [r.url, r]));
    const userAnalysis = (userScrape && byUrl.get(userScrape.url))?.analysis ?? {};
    const competitorAnalyses = competitorScrapes.map((s) => ({
      url: s.url,
      analysis: byUrl.get(s.url)?.analysis ?? {},
    }));

    pushProgress(jobId, { step: "synthesis", message: "Writing report..." });
    const t3 = Date.now();
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
    console.log(JSON.stringify({ step: "synthesis_done", durationMs: Date.now() - t3, totalMs: Date.now() - t0 }));
    resultCache.set(cacheKey, { result, cachedAt: Date.now() });
    jobStore.updateJob(jobId, { status: "completed", result });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error(JSON.stringify({ step: "pipeline_error", jobId, error: msg }));
    jobStore.updateJob(jobId, { status: "failed", error: msg });
  }
}

/**
 * POST /api/analyze
 * Body: { url: string, competitors?: string[] } — validated by validateAnalyzeBody (url required, valid http(s), max length; competitors optional, max 3).
 * Returns: { jobId: string } immediately. Pipeline runs in background; poll GET /api/analyze/job/:jobId for progress.
 */
analyzeRouter.post("/analyze", validateAnalyzeBody, (req, res) => {
  const { url, competitors } = req.body;
  const job = jobStore.createJob({ url, competitors });
  runPipeline(job.id).catch((e) => console.error(JSON.stringify({ step: "runPipeline_error", jobId: job.id, error: e?.message })));
  res.json({ jobId: job.id });
});

/**
 * GET /api/analyze/job/:jobId
 * Returns current job status, progress, and result when completed. Use polling (e.g. every 2s) instead of SSE to avoid timeouts.
 */
analyzeRouter.get("/analyze/job/:jobId", (req, res) => {
  const job = jobStore.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      error: "Job not found",
      code: "NOT_FOUND",
      ...(req.id && { requestId: req.id }),
    });
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress || [],
    result: job.result,
    error: job.error,
  });
});

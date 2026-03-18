import { Router } from "express";
import { jobStore } from "../utils/jobStore.js";
import { scrapeWithScreenshot } from "../services/screenshotService.js";
import { findCompetitors } from "../services/competitorDiscovery.js";
import { analyzeLandingSections } from "../services/analysisService.js";
import { synthesizeReport } from "../services/synthesisService.js";

export const analyzeRouter = Router();

function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/analyze
 * Body: { url: string }
 * Returns: { jobId: string }
 */
analyzeRouter.post("/analyze", (req, res) => {
  const url = req.body?.url?.trim();
  if (!url) {
    return res.status(400).json({ error: "Missing url" });
  }
  const job = jobStore.createJob({ url });
  res.json({ jobId: job.id });
});

/**
 * GET /api/analyze/stream/:jobId
 * SSE stream: progress events then final result or error.
 */
analyzeRouter.get("/analyze/stream/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    jobStore.updateJob(jobId, { status: "running" });
    sendSSE(res, "progress", { step: "started", message: "Starting analysis" });

    const userUrl = job.url;
    if (!userUrl) {
      throw new Error("Missing url for this job");
    }

    // 1) Discover competitors
    sendSSE(res, "progress", { step: "discovering", message: "Finding competitors..." });
    const competitors = await findCompetitors(userUrl);
    sendSSE(res, "progress", { step: "competitors", competitors: competitors.map((c) => c.url) });

    // 2) Scrape user + 4 competitors in parallel (screenshot + markdown)
    const toScrape = [{ url: userUrl, isUser: true }, ...competitors.slice(0, 4).map((c) => ({ url: c.url, isUser: false }))];
    sendSSE(res, "progress", { step: "screenshot", message: "Capturing screenshots..." });
    const scrapeResults = await Promise.all(
      toScrape.map(async (item) => {
        const data = await scrapeWithScreenshot(item.url);
        return { url: item.url, isUser: item.isUser, ...data };
      })
    );
    sendSSE(res, "progress", { step: "screenshot", index: toScrape.length, total: toScrape.length, message: "Screenshots captured" });

    // 3) Analyze landings with limited concurrency (2 at a time) to balance speed vs rate limit
    sendSSE(res, "progress", { step: "analyzing", message: "Analyzing with Claude Vision..." });
    const userScrape = scrapeResults.find((r) => r.isUser);
    const competitorScrapes = scrapeResults.filter((r) => !r.isUser);

    const analysisTasks = [
      ...(userScrape ? [{ scrape: userScrape, isUser: true }] : []),
      ...competitorScrapes.map((s) => ({ scrape: s, isUser: false })),
    ];
    const CONCURRENCY = 2;
    const runPool = async () => {
      const results = [];
      let next = 0;
      const runOne = async (idx) => {
        if (idx >= analysisTasks.length) return null;
        const { scrape, isUser } = analysisTasks[idx];
        const analysis = await analyzeLandingSections({ markdown: scrape.markdown, screenshotUrl: scrape.screenshot });
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

    // 4) Synthesize report
    sendSSE(res, "progress", { step: "synthesis", message: "Writing report..." });
    const report = await synthesizeReport({
      userUrl,
      userAnalysis,
      competitors: competitorAnalyses,
    });

    // Attach screenshot URLs for frontend
    const targetScreenshotUrl = userScrape?.screenshot || null;
    const competitorsWithScreenshots = competitorAnalyses.map((c) => {
      const scraped = scrapeResults.find((r) => r.url === c.url);
      return { ...c, screenshotUrl: scraped?.screenshot || null };
    });

    // Parse overall score from report if present (e.g. "6.2/10" or "Overall score: 6.2/10")
    let overallScore;
    const scoreMatch = report.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    if (scoreMatch) overallScore = parseFloat(scoreMatch[1], 10);

    const result = {
      report,
      userAnalysis,
      competitors: competitorsWithScreenshots,
      targetScreenshotUrl,
      synthesis: overallScore != null ? { overall_score: overallScore } : undefined,
    };
    jobStore.updateJob(jobId, { status: "completed", result });
    sendSSE(res, "done", result);
  } catch (err) {
    console.error("[analyze] Error:", err.message || err);
    jobStore.updateJob(jobId, { status: "failed", error: err.message });
    sendSSE(res, "error", { error: err.message });
  } finally {
    res.end();
  }
});

/**
 * GET /api/analyze/job/:jobId
 * Returns current job status and result if completed.
 */
analyzeRouter.get("/analyze/job/:jobId", (req, res) => {
  const job = jobStore.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
  });
});

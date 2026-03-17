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

    // 2) Scrape user + 4 competitors (screenshot + markdown)
    const toScrape = [{ url: userUrl, isUser: true }, ...competitors.slice(0, 4).map((c) => ({ url: c.url, isUser: false }))];
    const scrapeResults = [];
    for (let i = 0; i < toScrape.length; i++) {
      const item = toScrape[i];
      sendSSE(res, "progress", { step: "screenshot", index: i + 1, total: toScrape.length, url: item.url });
      const data = await scrapeWithScreenshot(item.url);
      scrapeResults.push({ url: item.url, isUser: item.isUser, ...data });
    }

    // 3) Analyze each landing — one site at a time to stay under Claude rate limit (30k tokens/min)
    sendSSE(res, "progress", { step: "analyzing", message: "Analyzing with Claude Vision..." });
    const userScrape = scrapeResults.find((r) => r.isUser);
    const competitorScrapes = scrapeResults.filter((r) => !r.isUser);

    const userAnalysis = userScrape
      ? await analyzeLandingSections({ markdown: userScrape.markdown, screenshotUrl: userScrape.screenshot })
      : {};

    const competitorAnalyses = [];
    for (const s of competitorScrapes) {
      const analysis = await analyzeLandingSections({ markdown: s.markdown, screenshotUrl: s.screenshot });
      competitorAnalyses.push({ url: s.url, analysis });
    }

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

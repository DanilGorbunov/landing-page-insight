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
import { synthesizeReport, parseScoreFromSection } from "../services/synthesisService.js";

export const analyzeRouter = Router();

/** Section keys aligned with analysisService output (for live scores). */
const SECTIONS_FOR_LIVE = ["hero", "value proposition", "features", "social proof", "CTA"];

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

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function emptySectionScores() {
  return {
    hero: null,
    "value proposition": null,
    features: null,
    "social proof": null,
    CTA: null,
  };
}

function defaultLive() {
  return {
    sites: [],
    synthesis: {
      started: false,
      ready: false,
      overallScore: null,
      gaps: [],
      partialReport: null,
    },
  };
}

/** Serialize live patches so parallel scrapes/workers do not overwrite each other. */
/** @type {Map<string, Promise<void>>} */
const livePatchChains = new Map();

function patchLive(jobId, mutator) {
  const prev = livePatchChains.get(jobId) ?? Promise.resolve();
  const next = prev.then(() => {
    const job = jobStore.getJob(jobId);
    if (!job) return;
    const snapshot = job.live && typeof job.live === "object" ? structuredClone(job.live) : defaultLive();
    mutator(snapshot);
    jobStore.updateJob(jobId, { live: snapshot });
  });
  livePatchChains.set(jobId, next.catch(() => {}));
  return next;
}

function liveFromCompletedResult(result, userUrl) {
  const sites = [];
  const userScores = emptySectionScores();
  for (const s of SECTIONS_FOR_LIVE) {
    userScores[s] = parseScoreFromSection(result.userAnalysis?.[s] ?? "") ?? null;
  }
  sites.push({
    url: userUrl,
    isUser: true,
    domain: getDomain(userUrl),
    screenshotReady: Boolean(result.targetScreenshotUrl),
    screenshotUrl: result.targetScreenshotUrl ?? null,
    sectionScores: userScores,
  });
  for (const c of result.competitors || []) {
    const sec = emptySectionScores();
    for (const s of SECTIONS_FOR_LIVE) {
      sec[s] = parseScoreFromSection(c.analysis?.[s] ?? "") ?? null;
    }
    sites.push({
      url: c.url,
      isUser: false,
      domain: getDomain(c.url),
      screenshotReady: Boolean(c.screenshotUrl),
      screenshotUrl: c.screenshotUrl ?? null,
      sectionScores: sec,
    });
  }
  return {
    sites,
    synthesis: {
      started: true,
      ready: true,
      overallScore: result.synthesis?.overall_score ?? null,
      gaps: Array.isArray(result.gaps) ? result.gaps : [],
      partialReport: null,
    },
  };
}

function pushProgress(jobId, entry) {
  const job = jobStore.getJob(jobId);
  if (!job) return;
  const progress = [...(job.progress || []), entry];
  jobStore.updateJob(jobId, { progress });
}

/**
 * Run full analysis pipeline in background. Updates job via jobStore (live, progress, result, error).
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
    jobStore.updateJob(jobId, {
      status: "completed",
      result: cached.result,
      live: liveFromCompletedResult(cached.result, userUrl),
    });
    return;
  }

  jobStore.updateJob(jobId, { status: "running", live: defaultLive() });

  try {
    const t0 = Date.now();
    const manualUrls = (job.competitors || []).filter(Boolean).slice(0, MAX_COMPETITORS);
    let combined;
    if (manualUrls.length >= MAX_COMPETITORS) {
      combined = manualUrls.slice(0, MAX_COMPETITORS);
    } else {
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
    }
    console.log(JSON.stringify({ step: "discovery_done", durationMs: Date.now() - t0 }));

    const toScrape = [{ url: userUrl, isUser: true }, ...combined.map((url) => ({ url, isUser: false }))];

    await patchLive(jobId, (live) => {
      live.sites = toScrape.map((item) => ({
        url: item.url,
        isUser: item.isUser,
        domain: getDomain(item.url),
        screenshotReady: false,
        screenshotUrl: null,
        sectionScores: emptySectionScores(),
      }));
    });
    pushProgress(jobId, { event: "competitors_found", urls: toScrape.map((t) => t.url) });

    const t1 = Date.now();
    const scrapeWithTimeout = (item) =>
      Promise.race([
        scrapeWithScreenshot(item.url).then((data) => ({ url: item.url, isUser: item.isUser, ...data })),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`scrape_timeout:${item.url}`)), SCRAPE_TIMEOUT_MS)
        ),
      ]);

    const scrapeSettled = await Promise.all(
      toScrape.map(async (item) => {
        try {
          const data = await scrapeWithTimeout(item);
          await patchLive(jobId, (live) => {
            const s = live.sites.find((x) => x.url === item.url);
            if (s) {
              s.screenshotReady = true;
              s.screenshotUrl = data.screenshot || null;
            }
          });
          pushProgress(jobId, { event: "screenshot_ready", url: item.url });
          return { status: "fulfilled", value: data };
        } catch (reason) {
          return { status: "rejected", reason, item };
        }
      })
    );

    const succeeded = scrapeSettled.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const userScrapeResult = succeeded.find((r) => r.isUser);
    if (!userScrapeResult) {
      const errMsg =
        scrapeSettled.find((r) => r.status === "rejected")?.reason?.message || "Scrape failed";
      throw new Error(errMsg);
    }
    let scrapeResults = succeeded;
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

    const userScrape = scrapeResults.find((r) => r.isUser);
    const competitorScrapes = scrapeResults.filter((r) => !r.isUser);
    const analysisTasks = [
      ...(userScrape ? [{ scrape: userScrape, isUser: true }] : []),
      ...competitorScrapes.map((s) => ({ scrape: s, isUser: false })),
    ];
    const t2 = Date.now();

    const emitSectionsForAnalysis = async (scrapeUrl, analysis) => {
      for (const section of SECTIONS_FOR_LIVE) {
        const score = parseScoreFromSection(analysis[section]);
        await patchLive(jobId, (live) => {
          const s = live.sites.find((x) => x.url === scrapeUrl);
          if (s) s.sectionScores[section] = score;
        });
        pushProgress(jobId, { event: "section_analyzed", url: scrapeUrl, section, score });
        await delay(110);
      }
    };

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
        await emitSectionsForAnalysis(scrape.url, analysis);
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

    await patchLive(jobId, (live) => {
      live.synthesis.started = true;
    });

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
    const result = {
      report,
      userAnalysis,
      competitors: competitorsWithScreenshots,
      targetScreenshotUrl,
      synthesis: overallScore != null ? { overall_score: overallScore } : undefined,
      gaps: Array.isArray(synthesisGaps) ? synthesisGaps : [],
    };
    console.log(JSON.stringify({ step: "synthesis_done", durationMs: Date.now() - t3, totalMs: Date.now() - t0 }));

    await patchLive(jobId, (live) => {
      live.synthesis.ready = true;
      live.synthesis.overallScore = overallScore ?? null;
      live.synthesis.gaps = Array.isArray(synthesisGaps) ? synthesisGaps : [];
    });
    pushProgress(jobId, { event: "synthesis_ready" });

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
 * Returns current job status, progress, live UI snapshot, and result when completed.
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
    live: job.live ?? null,
    result: job.result,
    error: job.error,
  });
});

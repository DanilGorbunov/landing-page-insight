import crypto from "crypto";
import { Router } from "express";
import {
  CACHE_TTL_MS,
  DISCOVERY_CACHE_TTL_MS,
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
import { recordRecentComparison, getRecentComparisons } from "../services/recentComparisonsStore.js";

export const analyzeRouter = Router();

/** Section keys aligned with analysisService output (for live scores). */
const SECTIONS_FOR_LIVE = ["hero", "value proposition", "features", "social proof", "CTA"];

/** Cache key = md5(url + date) so different sites never share cached result. Gaps live only inside synthesis report. */
/** @type {Map<string, { result: object, cachedAt: number }>} */
const resultCache = new Map();

/** Discovery cache: user domain -> { urls: string[], cachedAt }. Sonnet quality preserved on miss. */
/** @type {Map<string, { urls: string[], cachedAt: number }>} */
const discoveryCache = new Map();

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

/** Initial live snapshot for POST response (user card only). */
export function initialLiveForJob(userUrl) {
  const live = defaultLive();
  live.sites = [
    {
      url: userUrl,
      isUser: true,
      domain: getDomain(userUrl),
      screenshotReady: false,
      screenshotUrl: null,
      sectionScores: emptySectionScores(),
    },
  ];
  return live;
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

async function prefetchScreenshotBase64(r) {
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
  return { ...r, screenshotBase64: null };
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
    const result = cached.result;
    jobStore.updateJob(jobId, {
      status: "completed",
      result,
      live: liveFromCompletedResult(result, userUrl),
    });
    recordRecentComparison({
      jobId,
      domain: getDomain(userUrl),
      score: result.synthesis?.overall_score,
      competitorCount: result.competitors?.length ?? 0,
      result,
    });
    return;
  }

  if (job.status !== "running") {
    jobStore.updateJob(jobId, { status: "running" });
  }
  if (!job.live?.sites?.length) {
    jobStore.updateJob(jobId, { live: initialLiveForJob(userUrl) });
  }

  try {
    const t0 = Date.now();
    const manualUrls = (job.competitors || []).filter(Boolean).slice(0, MAX_COMPETITORS);
    let combined;
    /** @type {{ url: string, isUser: boolean, markdown?: string, screenshot?: string, screenshotBase64?: string } | null} */
    let userEarlyScrape = null;

    const scrapeWithTimeout = (item) =>
      Promise.race([
        scrapeWithScreenshot(item.url).then((data) => ({ url: item.url, isUser: item.isUser, ...data })),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`scrape_timeout:${item.url}`)), SCRAPE_TIMEOUT_MS)
        ),
      ]);

    if (manualUrls.length >= MAX_COMPETITORS) {
      combined = manualUrls.slice(0, MAX_COMPETITORS);
    } else {
      const userDomain = getDomain(userUrl);

      const discoveryTask = (async () => {
        const hit = discoveryCache.get(userDomain);
        if (hit && Date.now() - hit.cachedAt < DISCOVERY_CACHE_TTL_MS) {
          return hit.urls.map((u) => ({ url: u }));
        }
        const raw = await Promise.race([
          findCompetitors(userUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error("discovery_timeout")), DISCOVERY_TIMEOUT_MS)),
        ]).catch((e) => {
          if (e?.message === "discovery_timeout") console.warn("[analyze] discovery timeout, using manual only");
          return [];
        });
        if (raw.length > 0) {
          discoveryCache.set(userDomain, {
            urls: raw.map((c) => c.url),
            cachedAt: Date.now(),
          });
        }
        return raw;
      })();

      const userScrapeTask = scrapeWithTimeout({ url: userUrl, isUser: true }).then(
        (data) => ({ ok: true, data }),
        (reason) => ({ ok: false, reason })
      );

      const [autoDiscovered, userPack] = await Promise.all([discoveryTask, userScrapeTask]);
      if (userPack.ok) userEarlyScrape = userPack.data;

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

    if (userEarlyScrape) {
      await patchLive(jobId, (live) => {
        const s = live.sites.find((x) => x.url === userUrl);
        if (s) {
          s.screenshotReady = true;
          s.screenshotUrl = userEarlyScrape.screenshot || null;
        }
      });
      pushProgress(jobId, { event: "screenshot_ready", url: userUrl });
    }

    const t1 = Date.now();
    const competitorItems = toScrape.filter((item) => !item.isUser);

    const scrapeOneCompetitor = async (item) => {
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
    };

    const userScrapeTask =
      userEarlyScrape != null
        ? Promise.resolve({ status: "fulfilled", value: userEarlyScrape })
        : scrapeWithTimeout({ url: userUrl, isUser: true })
            .then((data) => ({ status: "fulfilled", value: data }))
            .catch((reason) => ({ status: "rejected", reason }));

    const [competitorSettled, userSettled] = await Promise.all([
      Promise.all(competitorItems.map(scrapeOneCompetitor)),
      userScrapeTask,
    ]);

    if (userSettled.status === "rejected") {
      throw new Error(userSettled.reason?.message || "Scrape failed for target URL");
    }
    const userScrapeResult = userSettled.value;

    if (!userEarlyScrape) {
      await patchLive(jobId, (live) => {
        const s = live.sites.find((x) => x.url === userUrl);
        if (s) {
          s.screenshotReady = true;
          s.screenshotUrl = userScrapeResult.screenshot || null;
        }
      });
      pushProgress(jobId, { event: "screenshot_ready", url: userUrl });
    }

    const competitorSucceeded = competitorSettled
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const scrapeResults = [userScrapeResult, ...competitorSucceeded];
    console.log(
      JSON.stringify({
        step: "scrape_done",
        durationMs: Date.now() - t1,
        scraped: scrapeResults.length,
        total: toScrape.length,
      })
    );

    const userScrape = scrapeResults.find((r) => r.isUser);
    const competitorScrapes = scrapeResults.filter((r) => !r.isUser);

    const emitSectionsForAnalysis = async (scrapeUrl, analysis) => {
      /** @type {Record<string, number | null>} */
      const updates = {};
      for (const section of SECTIONS_FOR_LIVE) {
        updates[section] = parseScoreFromSection(analysis[section]);
      }
      await patchLive(jobId, (live) => {
        const s = live.sites.find((x) => x.url === scrapeUrl);
        if (s) {
          for (const section of SECTIONS_FOR_LIVE) {
            s.sectionScores[section] = updates[section];
          }
        }
      });
      for (const section of SECTIONS_FOR_LIVE) {
        pushProgress(jobId, { event: "section_analyzed", url: scrapeUrl, section, score: updates[section] });
      }
    };

    /** @type {Record<string, string> | null} */
    let userAnalysis = null;

    /** Start competitor screenshot prefetch immediately (does not block user path). */
    const competitorPrefetchPromise = Promise.all(
      competitorScrapes.map((s) => prefetchScreenshotBase64(s))
    );
    const userPrefetchPromise = userScrape ? prefetchScreenshotBase64(userScrape) : Promise.resolve(null);

    /**
     * Worker pool for N competitor-only vision tasks (user runs on dedicated chain for fastest first metrics).
     * @param {Array<{ scrape: Record<string, unknown>, isUser: boolean }>} analysisTasks
     */
    const runVisionPool = async (analysisTasks) => {
      if (!analysisTasks.length) return [];
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
      const workers = Array.from(
        { length: Math.min(ANALYSIS_CONCURRENCY, Math.max(1, analysisTasks.length)) },
        () =>
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

    const userVisionChain = (async () => {
      const userPrefetched = await userPrefetchPromise;
      if (!userPrefetched) return null;
      const analysis = await analyzeLandingSections(
        {
          markdown: userPrefetched.markdown,
          screenshotUrl: userPrefetched.screenshot,
          screenshotBase64: userPrefetched.screenshotBase64,
          url: userPrefetched.url,
        },
        true
      );
      await emitSectionsForAnalysis(userPrefetched.url, analysis);
      return analysis;
    })();

    const competitorVisionChain = (async () => {
      const rows = await competitorPrefetchPromise;
      const tasks = rows.map((scrape) => ({ scrape, isUser: false }));
      return runVisionPool(tasks);
    })();

    const [userAnalysisResolved, competitorAnalysisResultsRaw] = await Promise.all([
      userVisionChain,
      competitorVisionChain,
    ]);
    userAnalysis = userAnalysisResolved;
    let competitorAnalysisResults = competitorAnalysisResultsRaw;
    const competitorOrder = new Map(competitorScrapes.map((s, i) => [s.url, i]));
    competitorAnalysisResults.sort(
      (a, b) => (competitorOrder.get(a.url) ?? 0) - (competitorOrder.get(b.url) ?? 0)
    );

    if (!userAnalysis) {
      throw new Error("Analysis failed for target URL");
    }

    await patchLive(jobId, (live) => {
      live.synthesis.started = true;
    });

    const synthesisInputCompetitors = competitorAnalysisResults.map(({ url, analysis }) => {
      const shot = competitorScrapes.find((s) => s.url === url);
      return {
        url,
        analysis,
        screenshotUrl: shot?.screenshot ?? null,
      };
    });

    const synthesis = await synthesizeReport({
      userUrl,
      userAnalysis,
      competitors: synthesisInputCompetitors,
    });

    const result = {
      report: synthesis.report,
      userAnalysis,
      competitors: synthesisInputCompetitors,
      targetScreenshotUrl: userScrape?.screenshot ?? null,
      synthesis: { overall_score: synthesis.overall_score },
      gaps: synthesis.gaps,
    };

    resultCache.set(cacheKey, { result, cachedAt: Date.now() });

    jobStore.updateJob(jobId, {
      status: "completed",
      result,
      live: liveFromCompletedResult(result, userUrl),
    });

    recordRecentComparison({
      jobId,
      domain: getDomain(userUrl),
      score: synthesis.overall_score,
      competitorCount: synthesisInputCompetitors.length,
      result,
    });
  } catch (err) {
    console.error("[analyze] pipeline failed", jobId, err?.message || err);
    jobStore.updateJob(jobId, {
      status: "failed",
      error: err?.message || "Analysis failed",
    });
  }
}

analyzeRouter.get("/recent-comparisons", (req, res) => {
  const raw = req.query.limit;
  const parsed = raw == null || raw === "" ? 3 : parseInt(String(raw), 10);
  const limit = Number.isFinite(parsed) ? parsed : 3;
  res.json(getRecentComparisons(limit));
});

analyzeRouter.post("/analyze", validateAnalyzeBody, (req, res) => {
  const url = req.body.url;
  const competitors = req.body.competitors || [];
  const live = initialLiveForJob(url);
  const job = jobStore.createJob({
    url,
    competitors,
    status: "running",
    live,
  });
  setImmediate(() => {
    runPipeline(job.id).catch((e) => console.error("[analyze] runPipeline", e));
  });
  res.status(202).json({ jobId: job.id, live });
});

analyzeRouter.get("/analyze/job/:jobId", (req, res) => {
  const job = jobStore.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found", code: "NOT_FOUND" });
  }
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    live: job.live,
    result: job.result,
    error: job.error,
  });
});

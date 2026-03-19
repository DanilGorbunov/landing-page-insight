/**
 * Request validation for POST /api/analyze.
 * Validates and sanitizes url and competitors; returns 400 with consistent error shape on failure.
 */

import { MAX_URL_LENGTH, MAX_COMPETITORS } from "../config/constants.js";

function isValidHttpUrl(str) {
  if (typeof str !== "string") return false;
  const s = str.trim();
  if (!s || s.length > MAX_URL_LENGTH) return false;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(raw) {
  const u = (raw && String(raw).trim()) || "";
  if (!u) return "";
  try {
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    return parsed.origin + parsed.pathname.replace(/\/+$/, "") || parsed.origin;
  } catch {
    return "";
  }
}

/**
 * Validate POST body. Mutates req.body with normalized url and competitors.
 * Calls next() on success; sends 400 and does not call next() on failure.
 */
export function validateAnalyzeBody(req, res, next) {
  const url = req.body?.url != null ? String(req.body.url).trim() : "";
  if (!url) {
    return res.status(400).json({ error: "Missing url", code: "BAD_REQUEST" });
  }
  if (url.length > MAX_URL_LENGTH) {
    return res.status(400).json({
      error: `url must be at most ${MAX_URL_LENGTH} characters`,
      code: "BAD_REQUEST",
    });
  }
  if (!isValidHttpUrl(url)) {
    return res.status(400).json({
      error: "Invalid url: must be http or https",
      code: "BAD_REQUEST",
    });
  }

  const rawCompetitors = Array.isArray(req.body?.competitors) ? req.body.competitors : [];
  const competitors = rawCompetitors
    .map((raw) => normalizeUrl(raw))
    .filter((u) => u && isValidHttpUrl(u))
    .slice(0, MAX_COMPETITORS);

  req.body.url = normalizeUrl(url);
  req.body.competitors = competitors;
  next();
}

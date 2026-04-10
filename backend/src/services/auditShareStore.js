import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
const defaultDbPath = path.join(dataDir, "recent_comparisons.db");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

function stripWww(host) {
  return String(host || "").replace(/^www\./i, "");
}

/**
 * Hostname slug aligned with frontend `auditSlugFromUrl` (no www, lowercased).
 * @param {string} url
 * @returns {string}
 */
export function auditSlugFromUserUrl(url) {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    return stripWww(u.hostname).toLowerCase();
  } catch {
    return "";
  }
}

function getDb() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.RECENT_COMPARISONS_DB_PATH || defaultDbPath;
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_audits (
      slug TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

/**
 * Persist last completed analysis for shareable GET /api/audit-share/:slug.
 * @param {string} userUrl
 * @param {object} result
 */
export function upsertSharedAudit(userUrl, result) {
  try {
    const slug = auditSlugFromUserUrl(userUrl);
    if (!slug || !result) return;
    const paidAt = new Date().toISOString();
    const payload = {
      url: userUrl,
      result,
      planId: "analysis",
      planName: "Analysis",
      paidAt,
    };
    const d = getDb();
    d.prepare(
      `INSERT OR REPLACE INTO shared_audits (slug, payload_json, updated_at)
       VALUES (@slug, @payload_json, @updated_at)`
    ).run({
      slug,
      payload_json: JSON.stringify(payload),
      updated_at: paidAt,
    });
  } catch (err) {
    console.warn("[auditShare] upsert failed:", err?.message || err);
  }
}

/**
 * @param {string} slug — normalized hostname (lowercase, no www)
 * @returns {object | null} FullInsightsPayload-shaped JSON
 */
export function getSharedAudit(slug) {
  try {
    const key = String(slug || "")
      .trim()
      .toLowerCase();
    if (!key) return null;
    const d = getDb();
    const row = d.prepare(`SELECT payload_json AS json FROM shared_audits WHERE slug = ?`).get(key);
    if (!row?.json) return null;
    return JSON.parse(row.json);
  } catch (err) {
    console.warn("[auditShare] get failed:", err?.message || err);
    return null;
  }
}

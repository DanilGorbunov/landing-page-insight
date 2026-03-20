import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
const defaultDbPath = path.join(dataDir, "recent_comparisons.db");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

export function initRecentDb() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.RECENT_COMPARISONS_DB_PATH || defaultDbPath;
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS recent_comparisons (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      score REAL,
      analyzed_at TEXT NOT NULL,
      competitor_count INTEGER NOT NULL DEFAULT 0,
      result_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recent_comparisons_analyzed_at ON recent_comparisons (analyzed_at);
  `);
  return db;
}

/**
 * @param {object} p
 * @param {string} p.jobId
 * @param {string} p.domain
 * @param {number | undefined | null} p.score
 * @param {number} p.competitorCount
 * @param {object} p.result
 */
export function recordRecentComparison(p) {
  try {
    const d = initRecentDb();
    const payload = { ...p.result, jobId: p.jobId };
    d.prepare(
      `INSERT OR REPLACE INTO recent_comparisons (id, domain, score, analyzed_at, competitor_count, result_json)
       VALUES (@id, @domain, @score, @analyzed_at, @competitor_count, @result_json)`
    ).run({
      id: p.jobId,
      domain: p.domain,
      score: p.score == null ? null : Number(p.score),
      analyzed_at: new Date().toISOString(),
      competitor_count: Number(p.competitorCount) || 0,
      result_json: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[recentComparisons] record failed:", err?.message || err);
  }
}

/**
 * @param {number} [limit]
 * @returns {{ id: string, domain: string, score: number | null, analyzedAt: string, result: object }[]}
 */
export function getRecentComparisons(limit = 3) {
  try {
    const d = initRecentDb();
    const rows = d
      .prepare(
        `SELECT id, domain, score, analyzed_at AS analyzedAt, result_json AS resultJson
         FROM recent_comparisons
         ORDER BY analyzed_at DESC
         LIMIT ?`
      )
      .all(Math.min(Math.max(limit, 1), 20));
    return rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      score: r.score,
      analyzedAt: r.analyzedAt,
      result: JSON.parse(r.resultJson),
    }));
  } catch (err) {
    console.warn("[recentComparisons] read failed:", err?.message || err);
    return [];
  }
}

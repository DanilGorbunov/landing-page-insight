import { JOB_TTL_MS } from "../config/constants.js";

const jobs = new Map();

/**
 * Create a new analysis job.
 * @param {Record<string, unknown>} [initial] - Optional initial job fields (e.g. { url }).
 * @returns {{ id: string, status: string, progress: unknown[], result: unknown, error: unknown, createdAt: number }}
 */
function createJob(initial = {}) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const job = {
    id,
    status: "pending",
    progress: [],
    result: null,
    error: null,
    createdAt: Date.now(),
    ...initial,
  };
  jobs.set(id, job);
  scheduleExpiry(id);
  return job;
}

/**
 * Get job by id.
 * @param {string} id - Job id.
 * @returns {object | null} Job or null.
 */
function getJob(id) {
  return jobs.get(id) || null;
}

/**
 * Update job with partial fields.
 * @param {string} id - Job id.
 * @param {Record<string, unknown>} updates - Fields to merge into job.
 * @returns {object | null} Updated job or null.
 */
function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

function scheduleExpiry(id) {
  setTimeout(() => {
    if (jobs.has(id)) jobs.delete(id);
  }, JOB_TTL_MS);
}

export const jobStore = { createJob, getJob, updateJob };

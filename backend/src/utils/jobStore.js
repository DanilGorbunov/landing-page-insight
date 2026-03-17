const TTL_MS = 60 * 60 * 1000; // 1 hour

const jobs = new Map();

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

function getJob(id) {
  return jobs.get(id) || null;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

function scheduleExpiry(id) {
  setTimeout(() => {
    if (jobs.has(id)) jobs.delete(id);
  }, TTL_MS);
}

export const jobStore = { createJob, getJob, updateJob };

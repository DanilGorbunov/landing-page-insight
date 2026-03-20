/**
 * CORS for browser clients (Vite dev on :3003, etc.).
 * Preflight OPTIONS must return Allow-* headers; error responses need the same or Chrome reports a CORS failure.
 */

function isAllowedDevOrigin(origin) {
  if (!origin || typeof origin !== "string") return false;
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return false;
    // Allow any localhost port in dev (3003, 5173, …)
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (isAllowedDevOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Request-Id, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function corsMiddleware(req, res, next) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
}

/**
 * Attach a request id to each request for structured logging and error responses.
 * Uses X-Request-Id if present, otherwise generates a short id.
 */

import crypto from "crypto";

export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers["x-request-id"];
  req.id = typeof incoming === "string" && incoming.length > 0
    ? incoming.slice(0, 64)
    : `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  next();
}

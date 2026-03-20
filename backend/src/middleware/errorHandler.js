/**
 * Centralized error handling middleware.
 * Consistent error response shape: { error: string, code?: string, requestId?: string }
 * Never leaks stack or internal details in production.
 */

import { setCorsHeaders } from "./cors.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Standard error response shape.
 * @param {string} message - User-facing error message
 * @param {object} [opts] - Optional code and requestId
 */
function errorResponse(message, opts = {}) {
  const body = { error: message };
  if (opts.code) body.code = opts.code;
  if (opts.requestId) body.requestId = opts.requestId;
  return body;
}

/**
 * Express error-handling middleware. Attach after routes.
 * Expects errors to have .statusCode or .status (4xx/5xx); defaults to 500.
 */
export function errorHandler(err, req, res, _next) {
  if (!res.headersSent) {
    setCorsHeaders(req, res);
  }

  const requestId = req.id || req.headers["x-request-id"];
  const statusCode = err.statusCode ?? err.status ?? 500;
  const code = err.code || (statusCode === 400 ? "BAD_REQUEST" : statusCode === 404 ? "NOT_FOUND" : "INTERNAL_ERROR");
  const message = err.expose === true && err.message ? err.message : "An unexpected error occurred";

  if (statusCode >= 500 && !isDev) {
    // Log server errors without sensitive data (no body, no auth headers)
    console.error("[error]", { requestId, code, message: err.message });
  } else if (isDev && err.message) {
    console.error("[error]", { requestId, code, message: err.message });
  }

  res.status(statusCode).json(errorResponse(message, { code, requestId }));
}

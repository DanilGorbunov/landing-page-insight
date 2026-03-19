/**
 * Simple structured logging for requests. Logs method, path, status, duration, requestId.
 * Never logs request body or headers (to avoid leaking secrets).
 */

export function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.id || "-";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
    };
    console.log(JSON.stringify(log));
  });

  next();
}

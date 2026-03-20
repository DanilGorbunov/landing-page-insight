import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import { validateEnv, getConfig } from "./config/env.js";
import { corsMiddleware } from "./middleware/cors.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { analyzeRouter } from "./routes/analyze.js";
import { initRecentDb } from "./services/recentComparisonsStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

validateEnv();
const config = getConfig();

const app = express();

// CORS first so preflight and error responses always get Allow-* headers
app.use(corsMiddleware);

// Request id and structured logging (no body/headers logged to avoid leaking secrets)
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(express.json());

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    "LandingLens API is running. Use POST /api/analyze or GET /api/analyze/job/:jobId. Frontend is usually on port 3003."
  );
});

// TODO: rate limiting — consider express-rate-limit or similar for /api/analyze
app.use("/api", analyzeRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  try {
    initRecentDb();
  } catch (e) {
    console.warn("[recentComparisons] init failed:", e?.message || e);
  }
  console.log(`LandingLens API running on http://localhost:${config.port}`);
});

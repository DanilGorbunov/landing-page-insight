import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import { validateEnv, getConfig } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { analyzeRouter } from "./routes/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

validateEnv();
const config = getConfig();

const app = express();

// Request id and structured logging (no body/headers logged to avoid leaking secrets)
app.use(requestIdMiddleware);
app.use(requestLogger);

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

// TODO: rate limiting — consider express-rate-limit or similar for /api/analyze
app.use("/api", analyzeRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`LandingLens API running on http://localhost:${config.port}`);
});

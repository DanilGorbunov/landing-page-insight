import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import { analyzeRouter } from "./routes/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

app.use("/api", analyzeRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LandingLens API running on http://localhost:${PORT}`);
});

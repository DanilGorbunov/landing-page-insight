import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import { analyzeRouter } from "./routes/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(express.json());

app.use("/api", analyzeRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LandingLens API running on http://localhost:${PORT}`);
});

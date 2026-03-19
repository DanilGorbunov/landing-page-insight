/**
 * Centralized env validation. Validates required env vars at startup; fail fast with clear errors.
 * Never log secret values.
 */

const required = [
  {
    key: "CLAUDE_API_KEY_LAND_LENS",
    envKey: "CLAUDE_API_KEY_LAND_LENS",
    altKey: "ANTHROPIC_API_KEY",
    message: "Set CLAUDE_API_KEY_LAND_LENS or ANTHROPIC_API_KEY (Claude API key)",
  },
  {
    key: "FIRECRAWL_API_KEY",
    envKey: "FIRECRAWL_API_KEY",
    message: "Set FIRECRAWL_API_KEY (Firecrawl API key)",
  },
];

const optional = [
  { key: "TAVILY_API_KEY", envKey: "TAVILY_API_KEY", description: "Tavily API key for competitor discovery" },
  { key: "PORT", envKey: "PORT", default: "3000", description: "Server port" },
];

function getEnv(key, altKey) {
  const v = process.env[key] || (altKey && process.env[altKey]);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Validate required env vars. Throws with a clear message if any are missing.
 * Call once at server startup.
 */
export function validateEnv() {
  const missing = [];
  for (const { envKey, altKey, message } of required) {
    const v = getEnv(envKey, altKey);
    if (!v) missing.push(message || `Missing env: ${envKey}`);
  }
  if (missing.length > 0) {
    throw new Error(`Environment validation failed:\n${missing.map((m) => `  - ${m}`).join("\n")}`);
  }
}

/**
 * Return a safe config object for the app. Never includes secret values in logs.
 */
export function getConfig() {
  const port = getEnv("PORT") || "3000";
  const portNum = parseInt(port, 10);
  return {
    port: Number.isFinite(portNum) && portNum > 0 ? portNum : 3000,
    hasTavily: !!getEnv("TAVILY_API_KEY"),
    // Keys are intentionally not exposed; services read process.env themselves
  };
}

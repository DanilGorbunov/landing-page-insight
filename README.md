# LandingLens project

## Shared constants (FE & BE)

Single source of truth for limits and timeouts used by both frontend and backend. Backend values live in `backend/src/config/constants.js`; frontend in `src/lib/constants.ts`. Keep these in sync when changing behavior.

| Constant | Value | Description |
|----------|--------|-------------|
| Max competitors per analysis | 3 | `MAX_COMPETITORS` (BE), `MAX_COMPETITORS` (FE) |
| Analysis result cache TTL | 24h | `CACHE_TTL_MS` (BE only) |
| Discovery cache TTL (per domain, in-memory) | 24h | `DISCOVERY_CACHE_TTL_MS` (BE only) |
| Job expiry (in-memory) | 1h | `JOB_TTL_MS` (BE only) |
| API request timeout (FE) | 60s | `API_TIMEOUT_MS` (FE only) |
| Discovery timeout (BE) | 8s | `DISCOVERY_TIMEOUT_MS` (BE only) |
| Scrape timeout per URL (BE) | 28s | `SCRAPE_TIMEOUT_MS` (BE only) |
| Max URL length (BE) | 2048 | `MAX_URL_LENGTH` (BE only) |

## Backend observability (Claude usage)

After each Anthropic `messages.create` for **vision** (per landing), **synthesis** (final report), and **discovery** (competitors), the API logs one JSON line:

`{"event":"claude_usage","stage":"vision"|"synthesis"|"discovery","model":"...","input_tokens":N,"output_tokens":M}`

Use this to estimate cost and tune prompts. Discovery stays **Sonnet** (same as the rest of the product path you configured).

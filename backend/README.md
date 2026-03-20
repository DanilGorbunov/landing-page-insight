# Landing Lens API

Express backend for the Landing Lens app (competitor analysis with Claude, Firecrawl, Tavily).

## Run locally

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000` (or `PORT` from env).

### Recent comparisons (SQLite)

Each successful analysis is stored in `backend/data/recent_comparisons.db` (override path with env `RECENT_COMPARISONS_DB_PATH`). The frontend calls `GET /api/recent-comparisons?limit=3` to show a global “recent” strip when the user has no local history.

## Deploy on Railway

1. **New project** — [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. **Root directory** — In Railway project settings, set **Root Directory** to `backend` (so only the backend is built and run).
3. **Env vars** — In Railway → your service → Variables, add:
   - `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY_LAND_LENS` — Claude API key
   - `FIRECRAWL_API_KEY` — Firecrawl API key
   - `TAVILY_API_KEY` — Tavily API key  
   (Railway sets `PORT` automatically.)
4. **Deploy** — Railway will run `npm install` and `node src/index.js`. After deploy, copy the public URL (e.g. `https://your-app.up.railway.app`).
5. **Frontend** — In your frontend (e.g. Vercel), set env var `VITE_API_BASE_URL` to that URL (e.g. `https://your-app.up.railway.app`) so the UI calls the Railway API.

No `.env` file is needed on Railway; all config comes from Railway variables.

**Persistent recent comparisons:** Railway’s filesystem is ephemeral unless you attach a volume. Without a volume, the SQLite file resets on redeploy (the UI then falls back to built-in sample cards). To persist, add a volume and set `RECENT_COMPARISONS_DB_PATH` to a path on that volume.

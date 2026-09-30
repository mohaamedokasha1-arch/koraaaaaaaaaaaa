# KoraScore — كورة سكور

Professional football live-scores platform. Arabic-first (RTL) with full English (LTR) support.
Next.js 16 (App Router) · React 19 · TypeScript · TailwindCSS · 100% real provider data — zero fake data.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your keys (see below)
npm run dev                  # dev server on :3000 (binds 0.0.0.0)
# production
npm run build && npm start
```

Open **http://localhost:3000** → redirects to `/ar` (or your last chosen locale).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `FOOTBALL_DATA_API_TOKEN` | ✅ | football-data.org token (sent as `X-Auth-Token`, **server-side only**) |
| `CRON_SECRET` | recommended in production | Protects `/api/cron/warm`; Vercel Cron sends it as a Bearer token |
| `API_FOOTBALL_KEY` | optional | api-football (API-SPORTS). Adapter auto-enables when present |
| `THESPORTSDB_API_KEY` | optional | TheSportsDB key (public key `3` works with rate limits) |
| `ESPN_PROVIDER_ENABLED` | optional | `false` disables the ESPN public scoreboard fallback |
| `PROVIDER_TIMEOUT_MS`, `PROVIDER_MAX_RETRIES` | optional | HTTP behaviour (defaults 8000 / 1) |
| `CIRCUIT_BREAKER_THRESHOLD`, `CIRCUIT_BREAKER_COOLDOWN_MS` | optional | resilience tuning (5 / 300000) |
| `NEXT_PUBLIC_SITE_URL` | ✅ prod | SEO canonical/OG/sitemap base URL |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE` | optional | kickoff display timezone (default `Africa/Cairo`) |

**Never commit real keys.** `.env` / `.env.local` are git-ignored; `.env.example` holds placeholders only.

## Deploy to Vercel (step-by-step)

The project deploys directly **GitHub → Vercel** with no extra services:

1. **Push the repo to GitHub.** Make sure `.env` / `.env.local` are NOT committed
   (they're git-ignored — only `.env.example` is tracked).
2. In Vercel: **Add New → Project → Import** the repo. Vercel auto-detects Next.js —
   leave Build Command (`next build`) and Output empty/default.
3. **Settings → Environment Variables** — add the following (all environments: Production + Preview):

   | Variable | Value | Required |
   |---|---|---|
   | `FOOTBALL_DATA_API_TOKEN` | your football-data.org token | ✅ for primary data |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` | ✅ (SEO canonical/OG/sitemap; update when you attach a custom domain) |
   | `CRON_SECRET` | any long random string (e.g. `openssl rand -hex 32`) | ✅ recommended — protects `/api/cron/warm`; Vercel Cron sends it automatically |
   | `THESPORTSDB_API_KEY` | `3` (public) or your Patreon key | optional (default: `3`) |
   | `API_FOOTBALL_KEY` | api-football / API-SPORTS key | optional — adapter auto-enables, adds another fallback tier |
   | `ESPN_PROVIDER_ENABLED` | `true` | optional (default `true`) |
   | `PROVIDER_TIMEOUT_MS` | `8000` | optional |
   | `PROVIDER_MAX_RETRIES` | `1` | optional |
   | `CIRCUIT_BREAKER_THRESHOLD` | `5` | optional |
   | `CIRCUIT_BREAKER_COOLDOWN_MS` | `300000` | optional |
   | `NEXT_PUBLIC_DEFAULT_TIMEZONE` | `Africa/Cairo` | optional |

   Everything except `NEXT_PUBLIC_*` is **server-side only** — keys are never
   shipped to the browser.
4. **Deploy.** The Hobby (free) plan is sufficient: no database, no KV, no queues.

### Vercel compatibility contract (how the app is built)

- **Framework:** Next.js 16 App Router — first-class Vercel support.
- **Rendering:** all data pages are `force-dynamic` → they run inside Vercel
  Serverless Functions (Node.js runtime) at request time. The build performs
  **zero live API calls**, so it succeeds even before env vars exist, and never
  bakes rate-limited/error data into the bundle.
- **API routes:** standard Route Handlers (`/api/...`) → serverless functions.
  No custom servers, websockets, or long-lived connections.
- **Caching:** in-memory per warm function instance (documented in code); it is
  an optimization layer only — correctness never depends on it surviving. To
  share cache across regions later, swap `src/lib/cache.ts` for Vercel KV/Redis.
- **Filesystem:** nothing writes to disk at runtime.
- **Automatic refresh:** live scores poll `/api/matches/live` every 30 seconds while
  the tab is visible. Home/today/results refresh every 5 minutes, upcoming and
  league fixture/result tabs every 15 minutes, and a live or near-kickoff match
  detail every 60 seconds while open. Hidden tabs pause and refresh when shown;
  provider calls are still governed by the server cache TTLs below.
- **Background job:** `/api/cron/warm` is registered in `vercel.json` at
  `0 6 * * *` (scheduled for 06:00 UTC, once daily, Hobby-compatible; Hobby
  invocations may occur within the scheduled hour). It refreshes live/today
  and adjacent date buckets and returns per-task status. This is a best-effort
  cache warmer, not a durable sync: Vercel's in-memory cache is per serverless
  instance, so a cron invocation does not guarantee that every later request or
  region shares the warmed value. Vercel Cron runs on production deployments only.
- **Higher-frequency background warming:** Vercel Hobby permits only daily Cron
  schedules; a schedule such as `*/5 * * * *` requires Pro (or an external
  scheduler that calls `/api/cron/warm`). If using Pro, change the cron expression
  in `vercel.json` and redeploy. A shared Redis/KV cache is needed if warmed data
  must persist across function instances/regions.
- **No provider webhooks are configured:** the current adapters pull data on
  requests/polls; this integration has no inbound webhook contract to set up.
- **Failure mode:** if every provider is down, pages render honest empty/stale
  states rather than fabricated data. External API availability, rate limits,
  provider coverage, and deployment-plan limits prevent any system from promising
  100% uninterrupted freshness.

## Multi-provider architecture

Every capability has an ordered fallback chain (circuit-breaker gated):

```
request → fresh cache?  →  provider A → provider B → provider C
        ↘ (all fail) → last cached payload, marked "stale" → UI notice
        ↘ (nothing at all) → honest empty state — never fabricated data
```

| Capability | Chain |
|---|---|
| Live matches | football-data → api-football* → ESPN → TheSportsDB |
| Matches by date | football-data → api-football* → ESPN → TheSportsDB |
| Standings | football-data → api-football* → TheSportsDB |
| League matches | football-data → api-football* → TheSportsDB |
| League teams | football-data → api-football* → TheSportsDB |
| Top scorers / leagues | football-data (→ api-football* for mapped competitions) |
| Team profile / team fixtures | football-data → TheSportsDB |
| Full-text team search | TheSportsDB |

\* auto-disabled until `API_FOOTBALL_KEY` is set. TheSportsDB closes the chain for
competitions football-data does **not** cover (see the Egyptian Premier League
below) — it declines featured competitions as `unsupported`, so their chain is
unchanged.

- **Circuit breaker:** 5 consecutive failures → circuit opens for 5 min (half-open probe after cooldown). Plan-limitation errors (403 "TIER_ONE") and unsupported capabilities do **not** poison the circuit.
- **Rate pacing:** token bucket keeps football-data within its 10 req/min free-plan budget.
- **Health monitoring:** `GET /api/health` exposes per-provider state, latency, success/failure counts.

## Caching (tiered TTLs, per-instance, Vercel-friendly)

live 25s · match detail 60s · today 5m · results 10m · upcoming 15m ·
league matches 15m · standings & scorers 1h · leagues/teams/squad 24h · search 30m

Every payload is retained up to 24h past expiry as **stale** fallback for outage windows;
the UI shows an amber "showing last saved version" notice when serving it. `fetchedAt`
tracks the last successful upstream/cache write (not the time a cached value was read),
so the live screen's "last updated" indicator reflects actual data freshness.
Swap `src/lib/cache.ts` for Redis/Vercel KV to share cache across regions and persist
cron-warmed data between serverless instances.

## Routes

`/ar` & `/en` for: home · live · today · results · upcoming ·
leagues + `/leagues/[code]` (standings / fixtures / results / scorers / teams tabs;
codes are the football-data codes plus `EGY` for the Egyptian Premier League) ·
standings · top-scorers · teams + `/teams/[id]` (matches / squad / standings / info) ·
matches/[id] (score header, events timeline, details, JSON-LD `SportsEvent`).

API: `/api/matches/live` (30 s client poll, deduped by server cache) ·
`/api/cron/warm` (scheduled cache warm + per-task report) ·
`/api/search` (debounced, cross-provider) · `/api/health`.

SEO: per-page localized metadata, hreflang, sitemap.xml, robots.txt, JSON-LD,
semantic breadcrumbs. All cross-links flow through entity pages.

## Key provider notes (learned in production testing)

- football-data `dateTo` is inclusive only up to `T00:00:00Z` — the adapter queries
  `dateTo = day + 1` and dedupes midnight-UTC matches across day groups.
- Multi-day views (results/fixtures) use **range queries** (≤9 days per call) instead of
  per-day fan-out: a 12-day page costs 2 upstream requests, not 12 — critical for the
  10 req/min free tier and for fast cold starts on serverless.
- Fallback adapters (ESPN/TheSportsDB) fan out per day, and **fail loudly** when every
  request fails — so outages record real provider failures instead of caching fabricated
  "no matches" truths.
- The football-data token bucket is capped at 8 req/min (2 in reserve under the 10/min
  free plan).
- BSA (Brasileirão) finished matches may carry score but no event payload (no scorer
  data at source) — the timeline then honestly shows "no events recorded".
- Free plan covers 12 competitions; the app tracks the 10 with full data:
  PL, PD, SA, BL1, FL1, CL, DED, PPL, BSA, ELC.
- **Egyptian Premier League (الدوري المصري الممتاز)** — `/ar/leagues/EGY` &
  `/en/leagues/EGY`. It is not on football-data's free plan, so the league is
  registered in `EXTRA_LEAGUES` (same model + same pipeline + same components)
  and served by **TheSportsDB league 4829**: `lookuptable.php` (table),
  `eventsseason.php` + `eventspastleague.php` + `eventsnextleague.php`
  (fixtures/results, de-duplicated by event id) and `search_all_teams.php`
  (clubs). Zone colours come from the provider's own description text.
  With `API_FOOTBALL_KEY` set, api-football league **233** is tried first and
  returns the complete set (table, fixtures, clubs, top scorers).
  The public key's documented per-endpoint caps apply and are surfaced
  honestly — never padded: season schedule 15 events (3000 with a key), table
  5 rows in the live free response (full table with a key), club list 10
  (3000 with a key), 1 recent + 1 next match. Setting `THESPORTSDB_API_KEY`
  (Patreon supporter key) raises every one of those ceilings automatically —
  no code change.

## Deliberate scope decisions (vs. the master brief)

1. **No database** — per the "zero-cost, serverless-ready" directive: persistence is the
   tiered cache layer. DB schema is archived as an upgrade path (swap cache.ts + Prisma).
2. **Players**: full squads live on team pages, scorers on top-scorers; a global player
   search needs a provider with free player search (api-football add-on).
3. **Live stats/lineups/H2H** tabs are spec'd but gated behind football-data's paid tiers —
   sections render only when a provider actually returns the data.
4. Sync logs are the in-memory health registry (see `/api/health`) instead of a DB table.

## Scripts

```bash
npm run dev        # develop
npm run build      # production build
npm start          # production server
npm run typecheck  # tsc --noEmit
```

## Production checklist

- [x] `next build` passes with and without env vars
- [x] No filesystem writes at runtime; no always-on processes
- [x] All provider keys are server-only env vars
- [x] Vercel Cron cache warmer (`vercel.json`, once daily on Hobby)
- [x] Active match pages refresh automatically while visible; server TTLs pace provider calls
- [x] Zero live API calls during the build
- [x] GitHub → Vercel import requires no config changes

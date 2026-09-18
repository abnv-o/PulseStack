# PulseStack leaderboard (Cloudflare Worker + D1)

The game posts scores to this Worker. Live URL used by the app:

`https://pulsestack-lb.lotusquants.workers.dev`

If that already works for you, you only need this guide when creating a **new** Worker or rotating the D1 database.

## One-time setup

1. Install Wrangler and log in:

```bash
npm i -g wrangler
wrangler login
```

2. From `worker/`, create a D1 database (skip if you already have `pulsestack`):

```bash
cd worker
wrangler d1 create pulsestack
```

Copy the printed `database_id` into [`wrangler.toml`](wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "pulsestack"
database_id = "<your-id>"
```

3. Apply the schema (remote = production):

```bash
wrangler d1 execute pulsestack --remote --file=./schema.sql
```

For local dev DB:

```bash
wrangler d1 execute pulsestack --local --file=./schema.sql
```

4. Deploy:

```bash
wrangler deploy
```

Note the `*.workers.dev` URL Wrangler prints.

5. Point the SvelteKit app at it — root `.env`:

```bash
PUBLIC_LB_URL=https://your-worker.workers.dev
PUBLIC_APP_VERSION=1.0.0
```

Then rebuild / sync Android:

```bash
npm run build
npm run cap:sync   # if shipping Capacitor
```

## API

| Method | Path | Body | Result |
|--------|------|------|--------|
| `GET` | `/` | — | Top 10 endless |
| `GET` | `/daily` | — | Top 10 for today's UTC day |
| `POST` | `/start` | `{ pid, mode? }` | `{ tok, seed, mode, day? }` |
| `POST` | `/score` | `{ tok, pid, name, n, taps }` | Updated top 10 |

`taps` is replayed against `seed` (anti-cheat). Client RNG in `src/lib/game/rng.ts` must match `worker.js`.

## Local Worker

```bash
cd worker
wrangler dev
```

Point `.env` `PUBLIC_LB_URL` at the local URL Wrangler shows (usually `http://127.0.0.1:8787`).

## Useful commands

```bash
wrangler d1 execute pulsestack --remote --command="SELECT COUNT(*) FROM scores"
wrangler tail          # live logs
wrangler deploy        # ship worker.js changes
```

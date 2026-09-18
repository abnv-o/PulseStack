# PulseStack

Tap-at-the-peak stacking game. **Web** is SvelteKit on **Cloudflare Pages**; **Android** is the same build via Capacitor. Leaderboard is a **Cloudflare Worker** + D1 in `worker/`.

## Develop (web)

```bash
npm install
npm run dev
```

Env (see `.env.example`):

- `PUBLIC_LB_URL` — Cloudflare Worker base URL (no trailing slash)
- `PUBLIC_APP_VERSION` — shown as `v…` inside the Capacitor app

## Build (web)

```bash
npm run build   # → build/
npm run preview
```

## Deploy (Cloudflare) — auto

Every push to `main` / `master` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **Pages** — game UI → Cloudflare Pages project `pulsestack`
2. **Worker** — leaderboard API → Worker `pulsestack-lb`

**You never commit Cloudflare credentials.** Add secrets/vars in GitHub once:

→ Full checklist: **[`.github/DEPLOY.md`](.github/DEPLOY.md)**

Quick version:

1. Create Cloudflare API token (Workers edit + Pages edit) → secret `CLOUDFLARE_API_TOKEN`
2. Secret `CLOUDFLARE_ACCOUNT_ID`
3. Variable `PUBLIC_LB_URL` = your Worker URL (set after first Worker deploy if needed)
4. Push to `master` (or Actions → **deploy** → Run workflow)

Local one-off (optional, uses your own Wrangler login):

```bash
npm run deploy:cf          # Pages
npm run deploy:worker      # Worker
```


## Android (Capacitor)

```bash
npm run cap:sync   # build + copy into android/
npm run cap:open   # Android Studio
```

App id: `app.pulsestack`. Plugins: App (back button), Haptics, Share, Splash Screen, Status Bar.

## Layout

| Path | Role |
|------|------|
| `src/` | SvelteKit UI + `src/lib/game/` engine |
| `static/` | PWA manifest, icon, service worker |
| `android/` | Capacitor Android project |
| `worker/` | Leaderboard API (Worker + D1) |
| `.github/` | Auto-deploy workflows + deploy guide |

Beat RNG (`mulberry32` / `periodFor`) in `src/lib/game/rng.ts` must stay in sync with `worker/worker.js`.

## Cloudflare leaderboard (manual / first-time)

See **[worker/README.md](worker/README.md)** for D1 schema and local `wrangler` use. CI deploys the Worker automatically once secrets are set.

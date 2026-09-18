# PulseStack

Tap-at-the-peak stacking game. **Web** is SvelteKit; **Android** is the same build via Capacitor. Leaderboard stays on the Cloudflare Worker in `worker/`.

## Develop (web)

```bash
npm install
npm run dev
```

Env (see `.env.example`):

- `PUBLIC_LB_URL` — Cloudflare Worker base URL
- `PUBLIC_APP_VERSION` — shown as `v…` inside the Capacitor app

## Build (web / Pages)

```bash
npm run build   # → build/
npm run preview
```

Cloudflare Workers (static assets) serves `build/` at https://pulsestack.lotusquants.workers.dev. `npm run deploy` ships it by hand; `.github/workflows/deploy.yml` does the same on push (needs a `CLOUDFLARE_API_TOKEN` repo secret).

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
| `worker/` | Leaderboard API |

Beat RNG (`mulberry32` / `periodFor`) in `src/lib/game/rng.ts` must stay in sync with `worker/worker.js`.

## Cloudflare leaderboard

See **[worker/README.md](worker/README.md)** for Wrangler login, D1 schema, deploy, and env wiring.
Your current Worker URL is already set in `.env.example` as `PUBLIC_LB_URL`.

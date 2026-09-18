# Cloudflare deploy checklist (Pages + Worker)
#
# You add secrets/vars in GitHub — CI never needs interactive `wrangler login`.

## Secrets (Settings → Secrets and variables → Actions → Secrets)

| Name | Value |
|------|--------|
| `CLOUDFLARE_API_TOKEN` | API token (see below) |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from Cloudflare dashboard URL or Overview |

### Create the API token

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → My Profile → **API Tokens** → **Create Token**
2. Use **Edit Cloudflare Workers** template, then also enable:
   - **Account → Cloudflare Pages → Edit**
   - **Account → Account Settings → Read** (if listed)
3. Account Resources → include your account
4. Create → copy token into `CLOUDFLARE_API_TOKEN`

## Variables (Settings → Secrets and variables → Actions → Variables)

| Name | Example | Required |
|------|---------|----------|
| `PUBLIC_LB_URL` | `https://pulsestack-lb.<your-subdomain>.workers.dev` | Yes for Pages build (no trailing slash) |
| `CF_PAGES_PROJECT` | `pulsestack` | No (defaults to `pulsestack`) |

After the first Worker deploy, copy the Worker URL from the Actions log / Cloudflare dashboard into `PUBLIC_LB_URL`, then re-run **deploy** (or push) so Pages bakes in the correct LB URL.

## One-time Cloudflare resources

1. **D1** — database name `pulsestack` must match [`worker/wrangler.toml`](../worker/wrangler.toml).  
   If creating fresh: `cd worker && npx wrangler d1 create pulsestack` → paste `database_id` into `wrangler.toml`, then:
   ```bash
   npx wrangler d1 execute pulsestack --remote --file=./schema.sql
   ```
2. **Pages** — project `pulsestack` is created automatically on first `pages deploy` if it does not exist.
3. **Worker** — name `pulsestack-lb` comes from `wrangler.toml`; first `deploy` publishes it.

## What CI does

On every push to `main` / `master` (and on manual **workflow_dispatch**):

| Job | Deploys |
|-----|---------|
| Cloudflare Pages | SvelteKit `build/` → Pages project |
| Cloudflare Worker | `worker/` → `pulsestack-lb` |

Workflow: [`.github/workflows/deploy.yml`](workflows/deploy.yml)

## Disable GitHub Pages

Repo → Settings → Pages → set Source to **None** (or stop using the old GitHub Pages site) so traffic goes to `*.pages.dev`.

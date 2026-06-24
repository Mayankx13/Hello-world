# Go live on amaflip.in (Cloudflare)

This wires your domain to the stack that `DEPLOY.md` already deploys. Final layout:

| URL | What | Served by |
|-----|------|-----------|
| `amaflip.in` + `www.amaflip.in` | Marketing website (LIQO) | Cloudflare Pages — project `liqo-site` (`/site`) |
| `app.amaflip.in` | The SaaS PWA | Cloudflare Pages — project `liqo-app` (`/web`) |
| `api.amaflip.in` | JSON API | Worker `liqo-api` (custom domain) |
| — (cron only) | Hourly inventory sync | Worker `liqo-sync` |

Everything is driven by GitHub Actions repo **variables** — set them once and a
push (or the *Run workflow* button) ships the whole thing. With the variables
unset, the same workflow still deploys to `*.workers.dev` / `*.pages.dev`, so you
can prove the stack first and attach the domain after.

> Do `DEPLOY.md` first (Cloudflare account, API token, D1 database, the
> `CLOUDFLARE_*` + `ADMIN_TOKEN` secrets). This page only adds the domain.

---

## 1. Add amaflip.in to Cloudflare

1. Cloudflare dashboard → **Add a site** → `amaflip.in` → Free plan.
2. Cloudflare shows two **nameservers**. At your registrar (where you bought the
   domain), replace the nameservers with those two.
3. Wait for the zone to go **Active** (minutes to a few hours). Everything below
   needs the zone active on the **same** Cloudflare account as the Workers/Pages.

## 2. Widen the API token scopes

The token from `DEPLOY.md` needs two more permissions so CI can bind a Worker
custom domain and attach Pages domains. Dashboard → *My Profile* → *API Tokens*
→ edit the token (or make a new one) with:

- Account · **Workers Scripts** · Edit
- Account · **D1** · Edit
- Account · **Cloudflare Pages** · Edit
- Account · **Account Settings** · Read
- Zone · **Workers Routes** · Edit  ← new (for `api.amaflip.in`)
- Zone · **DNS** · Edit  ← new (for the custom-domain records)
- Zone Resources: **Include → Specific zone → amaflip.in**

## 3. Add the GitHub repo variables

Repo → *Settings* → *Secrets and variables* → *Actions* → **Variables** tab
(*not* secrets — these aren't sensitive):

| Variable | Value |
|----------|-------|
| `DEPLOY_ENABLED` | `true` |
| `API_CUSTOM_DOMAIN` | `api.amaflip.in` |
| `APP_API_BASE` | `https://api.amaflip.in` |
| `APP_DOMAIN` | `app.amaflip.in` |
| `SITE_DOMAIN` | `amaflip.in` |
| `SITE_DOMAIN_WWW` | `www.amaflip.in` |
| `PAGES_PROJECT` | `liqo-app` |
| `SITE_PROJECT` | `liqo-site` |

Optional:

| Variable | Value | Effect |
|----------|-------|--------|
| `LLM_RATIONALE` | `on` | turns on Phase 5 AI rationale (also needs the secret below) |
| `INVENTORY_URL` | feed URL | pull live inventory instead of the bundled seed |

Optional **Secrets** (Secrets tab):

| Secret | Why |
|--------|-----|
| `AUTH_SECRET` | signs login tokens (any long random string). Falls back to a dev secret if unset. |
| `ANTHROPIC_API_KEY` | required only if `LLM_RATIONALE=on` (Claude Haiku 4.5). |

## 4. Deploy

Actions → **Deploy LIQO to Cloudflare** → *Run workflow* (or just push to
`master`). The run will:

1. apply the D1 schema, deploy both Workers, seed inventory;
2. bind `api.amaflip.in` to the API Worker (auto DNS + TLS);
3. build the PWA against `https://api.amaflip.in` and deploy it to `liqo-app`;
4. deploy `/site` to `liqo-site`;
5. attach `app.amaflip.in`, `amaflip.in` and `www.amaflip.in` to their Pages
   projects (auto DNS + TLS).

DNS records and certificates are created for you — no manual records needed when
the zone is on the same account. First-time TLS can take a few minutes.

> If the "Attach custom domains" step prints a warning, add the domain once by
> hand: Pages project → *Custom domains* → *Set up a domain*. (Some accounts
> require the very first domain attach to be done in the dashboard.)

## 5. www → apex redirect (optional, 30 seconds)

So `www.amaflip.in` forwards to the bare domain: Cloudflare → amaflip.in →
*Rules* → *Redirect Rules* → create:
- When incoming host **equals** `www.amaflip.in`
- Then **301** to `https://amaflip.in/${path}` (preserve query string).

## 6. Lock CORS down (optional, after it works)

The API ships with `ALLOWED_ORIGIN = "*"`. Once the app is live you can restrict
it: set repo variable-free by editing `worker-api/wrangler.toml`
`ALLOWED_ORIGIN = "https://app.amaflip.in"` and redeploy.

---

## Verify

```bash
curl https://api.amaflip.in/health            # {"ok":true,"service":"liqo-api",...}
curl https://api.amaflip.in/catalog/health    # row counts per category + store
open  https://amaflip.in                       # marketing site
open  https://app.amaflip.in                   # the app (sign in with a demo account)
```

| Symptom | Fix |
|---|---|
| `api.amaflip.in` not resolving | zone not Active yet, or token missing *Workers Routes · Edit* |
| App loads but data calls fail | `APP_API_BASE` wrong, or API custom domain cert still provisioning (wait ~5 min) |
| Pages domain shows "not attached" | do the one-time attach in the Pages dashboard (see step 4 note) |
| Login fails on the deployed app | set the `AUTH_SECRET` secret, then re-run the workflow |

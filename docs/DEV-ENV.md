# Dev + Production environments

LIQO runs as two **fully separate** copies — frontend *and* backend — so you can
test on dev before customers ever see it. Nothing is shared except the Cloudflare
account and the GitHub secrets.

| | Branch | Workflow | App | API | D1 | Pages projects |
|---|---|---|---|---|---|---|
| **Production** | `master` | `deploy.yml` | amaflip.in / app.amaflip.in | api.amaflip.in | `liqo` | liqo-app · liqo-site |
| **Dev** | `develop` | `deploy-dev.yml` | dev.amaflip.in / app-dev.amaflip.in | api-dev.amaflip.in | `liqo-dev` | liqo-app-dev · liqo-site-dev |

```
feature work ─▶ develop ─▶ (deploy-dev) dev.amaflip.in   ← test here
                  │
                  └─ promote ─▶ master ─▶ (deploy) amaflip.in   ← customers
```

## Branch flow
1. Do work on a feature branch (or directly on `develop`).
2. Merge into **`develop`** → `deploy-dev.yml` ships it to the dev URLs.
3. When it looks good, **promote**: merge `develop → master` → `deploy.yml`
   ships the identical commit to production. No rebuild surprises — same code.

## One-time setup (≈3 min, in addition to the prod setup in DOMAIN-SETUP.md)

The dev pipeline **reuses the prod secrets** (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `ADMIN_TOKEN`, `AUTH_SECRET`, optional
`ANTHROPIC_API_KEY`) — nothing new to add there.

**Add one repo variable** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|----------|-------|
| `DEPLOY_DEV_ENABLED` | `true` |

Everything else has a built-in default; override only if you want different names:

| Variable | Default |
|----------|---------|
| `DEV_API_CUSTOM_DOMAIN` | `api-dev.amaflip.in` |
| `DEV_APP_API_BASE` | `https://api-dev.amaflip.in` |
| `DEV_APP_DOMAIN` | `app-dev.amaflip.in` |
| `DEV_SITE_DOMAIN` | `dev.amaflip.in` |
| `DEV_PAGES_PROJECT` | `liqo-app-dev` |
| `DEV_SITE_PROJECT` | `liqo-site-dev` |
| `DEV_D1_DATABASE_ID` | *(auto-created `liqo-dev`)* |
| `DEV_LLM_RATIONALE` | `off` |

The dev workflow **auto-creates** the `liqo-dev` D1 the first time, just like prod.

## Run it
- Push to `develop`, **or** Actions → **Deploy LIQO to Cloudflare (DEV)** → Run
  workflow (branch `develop`).
- The wildcard/subdomains (`*-dev.amaflip.in`, `dev.amaflip.in`) are attached and
  TLS-provisioned automatically since the `amaflip.in` zone is already on
  Cloudflare. First cert can take a few minutes.

## Notes
- Dev and prod **never share data** — separate D1 databases, separate workers,
  separate Pages projects. Seeding dev does not touch prod inventory.
- Dev currently reuses the same `ADMIN_TOKEN`/`AUTH_SECRET` for simplicity. To
  fully isolate, switch both workflows to GitHub **Environments**
  (`production` / `development`) and scope the secrets there.
- To point dev at a different inventory feed, set `DEV_INVENTORY_URL`.

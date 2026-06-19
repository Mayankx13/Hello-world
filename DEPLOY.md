# Deploy LIQO entirely on the cloud (no local machine)

Everything runs on **Cloudflare**; **GitHub Actions** deploys it for you on every
push. You only click through two web dashboards once. After that, `git push`
(or the Actions "Run workflow" button) ships the whole stack.

```
GitHub repo ──push──▶ GitHub Actions ──▶ Cloudflare
                                         ├─ D1 (database)      schema + seed
                                         ├─ Worker: liqo-api   the JSON API
                                         ├─ Worker: liqo-sync  hourly cron
                                         └─ Pages: liqo        the PWA
```

## One-time setup (~10 minutes, all in the browser)

### 1. Cloudflare — account + token + database
1. Create/sign in to a **Cloudflare account** (the free plan covers this pilot:
   Workers 100k req/day, D1 5 GB, Pages, and Cron Triggers).
2. Copy your **Account ID** — Dashboard → *Workers & Pages* → right sidebar.
3. Create an **API token** — Dashboard → *My Profile* → *API Tokens* →
   *Create Token* → *Edit Cloudflare Workers* template, then **add** these
   permissions and *Continue → Create*:
   - Account · **Workers Scripts** · Edit
   - Account · **D1** · Edit
   - Account · **Cloudflare Pages** · Edit
   - Account · **Account Settings** · Read
   Copy the token (shown once).
4. Create the **D1 database** — Dashboard → *Storage & Databases* → *D1* →
   *Create database*, name it exactly **`liqo`**. Copy its **Database ID**.

### 2. GitHub — add the credentials to the repo
Repo → *Settings* → *Secrets and variables* → *Actions*:

**Secrets** (encrypted):
| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step 1.3 |
| `CLOUDFLARE_ACCOUNT_ID` | your Account ID (1.2) |
| `ADMIN_TOKEN` | any long random string (gates `/config` + `/sync`) |

**Variables** (plain):
| Name | Value |
| --- | --- |
| `D1_DATABASE_ID` | the Database ID from step 1.4 |
| `DEPLOY_ENABLED` | `true` |
| `INVENTORY_URL` | *(optional, later)* your BUSY/DBMS feed URL |

### 3. Run it
- *Actions* tab → **Deploy LIQO to Cloudflare** → **Run workflow**
  (or just push a commit). DEPLOY_ENABLED=true also makes every push deploy.

The run does: engine tests → apply D1 schema → deploy both Workers → seed the
inventory snapshot → build the PWA pointed at your API → deploy to Pages. The
run **Summary** prints your three URLs.

## What you get

| Thing | URL |
| --- | --- |
| PWA (open this on the tablet/phone) | `https://liqo.pages.dev` |
| API Worker | `https://liqo-api.<your-subdomain>.workers.dev` |
| Sync Worker (hourly cron) | `https://liqo-sync.<your-subdomain>.workers.dev` |

Install the PWA from `liqo.pages.dev`: Android Chrome → *Install app*; iOS Safari
→ Share → *Add to Home Screen*.

## After it's live

- **Tune parameters live (no redeploy):** `GET`/`PUT` the API `/config` endpoint
  with the admin token — see the README "How to tune parameters". Changes apply
  on the next request.
- **Switch from the bundled seed to the real BUSY feed:** set the
  `INVENTORY_URL` repo variable (and `INVENTORY_FORMAT` = `csv` if it's CSV),
  re-run the workflow. The hourly cron then refreshes from your feed.
- **Refresh inventory now:** `curl -X POST https://liqo-sync.<sub>.workers.dev/sync -H "authorization: Bearer <ADMIN_TOKEN>"`.

## Notes / alternatives

- **Custom domain:** add it to the Pages project (Pages → *Custom domains*) and,
  for the API, a Worker route — both in the Cloudflare dashboard.
- **PWA on Vercel/Netlify instead:** possible (point its build at `web/`, set
  `VITE_API_BASE`), but the **API + Sync + D1 must stay on Cloudflare** — Workers
  and D1 don't run elsewhere. Keeping all three on Cloudflare is simplest.
- **Prefer not to use GitHub Actions?** You can connect the repo directly in the
  Cloudflare dashboard for Pages (build `cd web && npm install && npm run build`,
  output `web/dist`), but the two Workers + D1 still deploy best via this
  workflow, so Actions remains the cohesive path.

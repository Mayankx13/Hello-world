# Deploy prompt — hand this to a Claude agent

Paste the block below into a Claude session (Claude Code on the web, or the
Claude GitHub app) connected to this repo. It drives the existing
`.github/workflows/deploy.yml` to put LIQO live on **amaflip.in**. Background and
the manual one-time bits are in [`docs/DOMAIN-SETUP.md`](DOMAIN-SETUP.md).

---

```text
You are deploying the LIQO Sales Assistant (this repo: Mayankx13/Hello-world) to
production on the domain amaflip.in. The app and all infrastructure are already
built and committed to `master`, and a deployment workflow already exists. Your
job is to wire the credentials, run the workflow, fix anything that fails, and
verify the live site — with app.amaflip.in as the primary goal.

TARGET END STATE
• https://amaflip.in + https://www.amaflip.in → marketing website
• https://app.amaflip.in   → the SaaS PWA            ← main goal
• https://api.amaflip.in   → the API Worker
• liqo-sync Worker         → hourly cron

READ FIRST (source of truth; this summarizes them)
• docs/DOMAIN-SETUP.md, DEPLOY.md, .github/workflows/deploy.yml
Work against the `master` branch. Do NOT refactor the app.

WHAT I (the human) PROVIDE — ask for these; never echo or commit them
1. Confirmation that amaflip.in is added to Cloudflare and the zone is "Active"
   (I changed the nameservers at my registrar). This is the ONE thing you can't
   do — if it isn't Active, stop and tell me.
2. My Cloudflare API token + Account ID. Token scopes:
   Account · Workers Scripts · Edit
   Account · D1 · Edit
   Account · Cloudflare Pages · Edit
   Account · Account Settings · Read
   Zone · Workers Routes · Edit   (zone: amaflip.in)
   Zone · DNS · Edit              (zone: amaflip.in)

TASKS (in order)
1. Sanity-check master has /site, /web, /worker-api, /worker-sync, schema.sql,
   .github/workflows/deploy.yml. Run `npm install && npm test` (must be green).
2. Set the GitHub repo SECRETS (Settings → Secrets and variables → Actions). Use
   the GitHub API/CLI if you can; otherwise give me the exact name/value pairs +
   the click-path:
     CLOUDFLARE_API_TOKEN  = <my token>
     CLOUDFLARE_ACCOUNT_ID = <my account id>
     ADMIN_TOKEN           = <generate a 40+ char random string>
     AUTH_SECRET           = <generate a 40+ char random string>
     ANTHROPIC_API_KEY     = <only if I ask to enable AI rationale>
3. Set the GitHub repo VARIABLES:
     DEPLOY_ENABLED   = true
     API_CUSTOM_DOMAIN= api.amaflip.in
     APP_API_BASE     = https://api.amaflip.in
     APP_DOMAIN       = app.amaflip.in
     SITE_DOMAIN      = amaflip.in
     SITE_DOMAIN_WWW  = www.amaflip.in
     PAGES_PROJECT    = liqo-app
     SITE_PROJECT     = liqo-site
     (optional) LLM_RATIONALE = on     ← only if ANTHROPIC_API_KEY is set
   NOTE: you do NOT need D1_DATABASE_ID — the workflow auto-creates the `liqo`
   D1 database. (Set it only if I tell you to reuse an existing database.)
4. Trigger the "Deploy LIQO to Cloudflare" workflow (workflow_dispatch on master).
5. Watch the run. On any failure, read the logs, fix the root cause, re-trigger.
   Common cases:
     • Pages project name taken globally → change PAGES_PROJECT/SITE_PROJECT to a
       unique value, re-run.
     • Token scope error on api.amaflip.in → I must add Workers Routes·Edit.
     • "could not attach <domain>" warning → attach once via the Cloudflare API
       (POST /accounts/{id}/pages/projects/{project}/domains {"name":"..."}) for
       app.amaflip.in, amaflip.in and www.amaflip.in, or tell me to click
       "Set up a domain" in each Pages project.
6. Verify (retry ~5 min — first TLS certs take a moment):
     curl -s https://api.amaflip.in/health          → {"ok":true,...}
     curl -s https://api.amaflip.in/catalog/health  → per-category row counts
     open https://amaflip.in  and  https://app.amaflip.in
     sign in on the app: admin@liqo.in / liqo → Command Centre + Leaderboard load.

GUARDRAILS
• Never print, echo, or commit secret values.
• Don't push code changes unless a fix requires it; if so, commit to master with
  a clear message and say what changed and why.
• The registrar nameserver change and providing the token are the only human
  steps — everything else is yours.
• If anything is ambiguous or a prerequisite is missing, stop and ask.

REPORT BACK
The four live URLs + status, the workflow run link, which secrets/variables you
set (names only), and anything still left to me.
```

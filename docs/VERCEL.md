# Dev preview on Vercel (frontend) — push & sync

Vercel hosts the **frontend** (the React PWA). The backend stays on Cloudflare
(Workers + D1 don't run on Vercel). The Vercel app runs in **offline/demo mode**
by default — the same recommendation engine runs client‑side against bundled
data, so every screen works — and can be pointed at the live Cloudflare API with
one env var when you want real data.

```
develop ──▶ Vercel (dev preview)         ← every push auto-deploys
master  ──▶ Cloudflare amaflip.in (prod) ← unchanged
```

## One‑time connect (≈2 min, only you can do this)
1. **vercel.com → Add New… → Project → Import Git Repository** → pick
   `Mayankx13/Hello-world`. (Authorize Vercel for the repo if asked.)
2. Configure the import:
   - **Root Directory:** `.` (repo root — `vercel.json` builds the web app)
   - **Framework Preset:** Other (vercel.json already sets build + output)
   - Build/Output are picked up from `vercel.json`
     (`npm --workspace web run build` → `web/dist`).
3. **Production Branch:** open the new project → **Settings → Git → Production
   Branch → `develop`**. (This makes the Vercel URL track the dev line; prod
   stays on Cloudflare/`master`.)
4. **Deploy.** Vercel gives you a URL like `hello-world-<hash>.vercel.app`.

## After that — push & sync (handled from Claude)
- Any push to `develop` auto‑deploys. I push, then verify the build via the
  Vercel tools (`list_deployments`, `get_deployment_build_logs`,
  `get_runtime_errors`) and report the live URL + status.
- Re‑deploy is automatic; no manual step.

## Optional — connect the Vercel app to live backend data
By default the Vercel app is offline/demo (bundled + localStorage data — fully
interactive). To use the real D1 database/auth, deploy the Cloudflare **dev**
API (`docs/DEV-ENV.md`) and then in Vercel:
- **Settings → Environment Variables →** add `VITE_API_BASE` =
  `https://api-dev.amaflip.in` → redeploy.
The app then talks to the Cloudflare dev API for live inventory, customers,
employees, offers, etc.

## Explore right now (no deploy needed)
`npm --workspace web run dev` → open the printed URL. Sign in `admin@liqo.in` /
`liqo`; try customer recall with `9876500000`. Every new screen renders against
bundled data.

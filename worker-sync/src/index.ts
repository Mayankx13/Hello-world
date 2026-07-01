/**
 * LIQO Sync Worker — refreshes the D1 inventory snapshot hourly.
 *
 * Cron Trigger (hourly):  getRawInventory() -> transform (TS port of the BUSY
 * mapper) -> replace the D1 inventory snapshot. 1-hour freshness is acceptable;
 * each row carries last_synced_at. A manual POST /sync (admin token) is also
 * exposed for ad-hoc refreshes and first-run seeding.
 */
import { transformInventory, type RawInventoryRow } from "../../src/engine/mapper";
import { replaceInventory, type D1Like } from "../../src/shared/d1";
import { loadConfig, saveConfig, saveQuestionnaire, DEFAULT_CONFIG, DEFAULT_QUESTIONNAIRE } from "../../src/shared/config";
import { getRawInventory, sourceKind, type SyncEnv } from "./source";

export interface Env extends SyncEnv {
  DB: D1Like;
  ADMIN_TOKEN?: string;
}

async function ensureConfig(env: Env) {
  // Seed config into D1 on first run so the API always has parameters.
  const existing = await env.DB.prepare("SELECT 1 AS ok FROM config WHERE key = 'engine'").first<{ ok: number }>();
  const cfg = existing ? await loadConfig(env.DB) : DEFAULT_CONFIG;
  if (!existing) await saveConfig(env.DB, cfg);
  const qExists = await env.DB.prepare("SELECT 1 AS ok FROM config WHERE key = 'questionnaire'").first<{ ok: number }>();
  if (!qExists) await saveQuestionnaire(env.DB, DEFAULT_QUESTIONNAIRE);
  return cfg;
}

/** Transform raw rows and atomically replace the D1 snapshot. */
async function applyRows(env: Env, rows: RawInventoryRow[], source: string) {
  const now = new Date().toISOString();
  const cfg = await ensureConfig(env);
  const items = transformInventory(rows, cfg, now);
  const written = await replaceInventory(env.DB, items);
  return { raw: rows.length, written, source, at: now };
}

/** Pull from the configured source (hourly cron + manual /sync). */
async function runSync(env: Env): Promise<{ raw: number; written: number; source: string; at: string }> {
  const { rows, source } = await getRawInventory(env);
  return applyRows(env, rows, source);
}

export default {
  // Hourly Cron Trigger.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
    // In push mode an on-prem connector owns the snapshot — the hourly cron must
    // NOT overwrite live stock with the bundled seed, so it idles.
    if (sourceKind(env) === "push") {
      console.log("[liqo-sync] push mode — external connector owns inventory; cron idle");
      return;
    }
    ctx.waitUntil(
      runSync(env).then(
        (r) => console.log(`[liqo-sync] ok ${r.written}/${r.raw} from ${r.source} @ ${r.at}`),
        (e) => console.error(`[liqo-sync] FAILED: ${String((e as Error)?.message ?? e)}`),
      ),
    );
  },

  // Manual trigger / health.
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      const last = await env.DB
        .prepare("SELECT COUNT(*) AS n, MAX(last_synced_at) AS at FROM inventory")
        .first<{ n: number; at: string }>()
        .catch(() => null);
      return json({ ok: true, service: "liqo-sync", source: sourceKind(env), rows: last?.n ?? 0, lastSyncedAt: last?.at ?? null });
    }
    // Pull from the configured source (bundled seed or INVENTORY_URL).
    if (url.pathname === "/sync" && req.method === "POST") {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      const r = await runSync(env);
      return json({ ok: true, ...r });
    }
    // Push from a local agent (e.g. the BUSY / SQL Server connector on the
    // store LAN). Accepts { rows: RawInventoryRow[] } or a bare JSON array.
    if (url.pathname === "/push" && req.method === "POST") {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      const body = (await req.json().catch(() => null)) as { rows?: RawInventoryRow[] } | RawInventoryRow[] | null;
      const rows = Array.isArray(body) ? body : body?.rows;
      if (!Array.isArray(rows)) {
        return json({ error: "bad_request", message: "expected { rows: [...] } or a JSON array" }, 400);
      }
      const r = await applyRows(env, rows, "push:local-agent");
      return json({ ok: true, ...r });
    }
    return json({ error: "not_found" }, 404);
  },
};

function authed(req: Request, env: Env): boolean {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

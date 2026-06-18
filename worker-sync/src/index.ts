/**
 * LIQO Sync Worker — refreshes the D1 inventory snapshot hourly.
 *
 * Cron Trigger (hourly):  getRawInventory() -> transform (TS port of the BUSY
 * mapper) -> replace the D1 inventory snapshot. 1-hour freshness is acceptable;
 * each row carries last_synced_at. A manual POST /sync (admin token) is also
 * exposed for ad-hoc refreshes and first-run seeding.
 */
import { transformInventory } from "../../src/engine/mapper";
import { replaceInventory, type D1Like } from "../../src/shared/d1";
import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../../src/shared/config";
import { getRawInventory, type SyncEnv } from "./source";

export interface Env extends SyncEnv {
  DB: D1Like;
  ADMIN_TOKEN?: string;
}

async function runSync(env: Env): Promise<{ raw: number; written: number; source: string; at: string }> {
  const now = new Date().toISOString();
  // Ensure config exists in D1 (seed on first run) so the API has parameters.
  const existing = await env.DB.prepare("SELECT 1 AS ok FROM config WHERE key = 'engine'").first<{ ok: number }>();
  const cfg = existing ? await loadConfig(env.DB) : DEFAULT_CONFIG;
  if (!existing) await saveConfig(env.DB, cfg);

  const { rows, source } = await getRawInventory(env);
  const items = transformInventory(rows, cfg, now);
  const written = await replaceInventory(env.DB, items);
  return { raw: rows.length, written, source, at: now };
}

export default {
  // Hourly Cron Trigger.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }): Promise<void> {
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
      return json({ ok: true, service: "liqo-sync", rows: last?.n ?? 0, lastSyncedAt: last?.at ?? null });
    }
    if (url.pathname === "/sync" && req.method === "POST") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: "unauthorized" }, 401);
      const r = await runSync(env);
      return json({ ok: true, ...r });
    }
    return json({ error: "not_found" }, 404);
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

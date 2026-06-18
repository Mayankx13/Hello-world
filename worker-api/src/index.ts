/**
 * LIQO API Worker — recommendation + session endpoints (JSON over HTTPS).
 *
 * Endpoints:
 *   POST /recommend                  -> {good, better, best, stretch, attach[]}
 *   GET  /stores                     -> retail stores (picker / auto-detect)
 *   GET  /catalog/health             -> per-category & per-store counts + sync time
 *   POST /session                    -> log a journey outcome
 *   GET/PUT /config   (admin token)  -> read/update engine params (no redeploy)
 *   GET  /admin/sessions/export (admin) -> sessions as JSON or CSV
 *
 * The API reads ONLY from D1 — it never calls BUSY/DBMS live.
 * (Seam for live reads later: Cloudflare Hyperdrive in front of getRawInventory.)
 */
import { recommend } from "../../src/engine/recommend";
import type { Category, EngineConfig, RecommendRequest } from "../../src/engine/types";
import { loadInventory, type D1Like } from "../../src/shared/d1";
import { loadConfig, saveConfig } from "../../src/shared/config";

export interface Env {
  DB: D1Like;
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
}

const CATEGORIES: Category[] = ["ac", "tv", "fridge", "wm"];

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") return cors(env, new Response(null, { status: 204 }));

    try {
      if (pathname === "/" || pathname === "/health") {
        return json(env, { ok: true, service: "liqo-api", time: new Date().toISOString() });
      }
      if (pathname === "/recommend" && method === "POST") return handleRecommend(req, env);
      if (pathname === "/stores" && method === "GET") return handleStores(env);
      if (pathname === "/catalog/health" && method === "GET") return handleCatalogHealth(env);
      if (pathname === "/session" && method === "POST") return handleSession(req, env);
      if (pathname === "/config" && method === "GET") return handleGetConfig(req, env);
      if (pathname === "/config" && method === "PUT") return handlePutConfig(req, env);
      if (pathname === "/admin/sessions/export" && method === "GET") return handleSessionsExport(req, env, url);

      return json(env, { error: "not_found", path: pathname }, 404);
    } catch (err) {
      return json(env, { error: "internal", message: String((err as Error)?.message ?? err) }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// POST /recommend
// ---------------------------------------------------------------------------
async function handleRecommend(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Partial<RecommendRequest>;
  const err = validateRecommend(body);
  if (err) return json(env, { error: "bad_request", message: err }, 400);

  const reqBody = body as RecommendRequest;
  const [cfg, inventory] = await Promise.all([
    loadConfig(env.DB),
    // Only this store + category is needed to score one request.
    loadInventory(env.DB, { storeId: reqBody.storeId, category: reqBody.category }),
  ]);
  const result = recommend(reqBody, inventory, cfg);
  return json(env, result);
}

function validateRecommend(b: Partial<RecommendRequest>): string | null {
  if (!b || typeof b !== "object") return "missing body";
  if (!b.storeId) return "storeId required";
  if (!b.category || !CATEGORIES.includes(b.category)) return "valid category required";
  if (!Array.isArray(b.answers)) return "answers[] required";
  if (!b.budgetBand || !["good", "better", "best"].includes(b.budgetBand)) return "budgetBand required";
  return null;
}

// ---------------------------------------------------------------------------
// GET /stores  (retail only)
// ---------------------------------------------------------------------------
async function handleStores(env: Env): Promise<Response> {
  const { results } = await env.DB
    .prepare(
      `SELECT store_id AS id, store AS name, COUNT(*) AS items, MAX(last_synced_at) AS lastSyncedAt
       FROM inventory WHERE channel = 'retail'
       GROUP BY store_id, store ORDER BY name`,
    )
    .all<{ id: string; name: string; items: number; lastSyncedAt: string }>();
  const stores = results.map((s) => ({
    id: s.id,
    name: s.name.replace(/\s*\(B2C\)\s*/i, ""),
    label: s.name,
    region: "North India",
    pilot: ["panchkula", "zirakpur"].includes(s.id),
    items: s.items,
    lastSyncedAt: s.lastSyncedAt,
  }));
  return json(env, { stores });
}

// ---------------------------------------------------------------------------
// GET /catalog/health
// ---------------------------------------------------------------------------
async function handleCatalogHealth(env: Env): Promise<Response> {
  const byCat = await env.DB
    .prepare(
      `SELECT category, COUNT(*) AS items, SUM(stock_qty) AS units, MAX(last_synced_at) AS lastSyncedAt
       FROM inventory WHERE channel = 'retail' GROUP BY category`,
    )
    .all<{ category: string; items: number; units: number; lastSyncedAt: string }>();
  const byStore = await env.DB
    .prepare(
      `SELECT store_id AS storeId, category, COUNT(*) AS items
       FROM inventory WHERE channel = 'retail' GROUP BY store_id, category`,
    )
    .all<{ storeId: string; category: string; items: number }>();
  const total = await env.DB
    .prepare("SELECT COUNT(*) AS n, MAX(last_synced_at) AS lastSyncedAt FROM inventory")
    .first<{ n: number; lastSyncedAt: string }>();

  return json(env, {
    ok: true,
    totalRows: total?.n ?? 0,
    lastSyncedAt: total?.lastSyncedAt ?? null,
    perCategory: byCat.results,
    perStore: byStore.results,
  });
}

// ---------------------------------------------------------------------------
// POST /session
// ---------------------------------------------------------------------------
async function handleSession(req: Request, env: Env): Promise<Response> {
  const s = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = String(s.sessionId ?? crypto.randomUUID());
  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO sessions
       (session_id, store_id, category, lang, answers, budget_band, stretch, exchange,
        shown_cards, chosen, attach, outcome, total, items_per_bill, ts, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      sessionId,
      str(s.storeId),
      str(s.category),
      str(s.lang),
      jstr(s.answers),
      str(s.budgetBand),
      boolNum(s.stretch),
      boolNum(s.exchange),
      jstr(s.shownCards),
      jstr(s.chosen),
      jstr(s.attach),
      str(s.outcome),
      num(s.total),
      num(s.itemsPerBill),
      str(s.ts) ?? new Date().toISOString(),
      new Date().toISOString(),
    )
    .run();
  return json(env, { ok: true, sessionId });
}

// ---------------------------------------------------------------------------
// GET/PUT /config  (admin token)
// ---------------------------------------------------------------------------
async function handleGetConfig(req: Request, env: Env): Promise<Response> {
  if (!checkAdmin(req, env)) return json(env, { error: "unauthorized" }, 401);
  const cfg = await loadConfig(env.DB);
  return json(env, cfg);
}

async function handlePutConfig(req: Request, env: Env): Promise<Response> {
  if (!checkAdmin(req, env)) return json(env, { error: "unauthorized" }, 401);
  const cfg = (await req.json().catch(() => null)) as EngineConfig | null;
  const err = validateConfig(cfg);
  if (err) return json(env, { error: "bad_request", message: err }, 400);
  cfg!.updatedAt = new Date().toISOString();
  await saveConfig(env.DB, cfg!);
  return json(env, { ok: true, version: cfg!.version, updatedAt: cfg!.updatedAt });
}

function validateConfig(c: EngineConfig | null): string | null {
  if (!c || typeof c !== "object") return "config object required";
  if (!c.priceBands || !c.rankingBlend) return "priceBands and rankingBlend required";
  for (const cat of CATEGORIES) {
    const b = c.priceBands[cat];
    if (!b || !b.good || !b.better || !b.best) return `priceBands.${cat} incomplete`;
  }
  const rb = c.rankingBlend;
  if (typeof rb.volumeWeight !== "number" || rb.volumeWeight < 0 || rb.volumeWeight > 1) return "volumeWeight 0..1";
  if (!["amount", "percent"].includes(rb.marginBasis)) return "marginBasis amount|percent";
  return null;
}

// ---------------------------------------------------------------------------
// GET /admin/sessions/export  (admin token) — ?format=csv|json
// ---------------------------------------------------------------------------
async function handleSessionsExport(req: Request, env: Env, url: URL): Promise<Response> {
  if (!checkAdmin(req, env)) return json(env, { error: "unauthorized" }, 401);
  const { results } = await env.DB
    .prepare("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5000")
    .all<Record<string, unknown>>();
  if (url.searchParams.get("format") === "csv") {
    return cors(env, new Response(toCSV(results), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=liqo-sessions.csv" },
    }));
  }
  return json(env, { count: results.length, sessions: results });
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function checkAdmin(req: Request, env: Env): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-admin-token") || "";
  return token === env.ADMIN_TOKEN;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-admin-token",
    "access-control-max-age": "86400",
  };
}
function cors(env: Env, res: Response): Response {
  const h = corsHeaders(env);
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}
function json(env: Env, body: unknown, status = 200): Response {
  return cors(env, new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  }));
}
function str(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number | null {
  return v == null || v === "" ? null : Number(v);
}
function boolNum(v: unknown): number | null {
  return v == null ? null : v ? 1 : 0;
}
function jstr(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v);
}

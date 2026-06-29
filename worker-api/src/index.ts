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
import type { Category, EngineBoost, EngineConfig, RecommendRequest, RecommendResult, RecommendationCard } from "../../src/engine/types";
import { computeLeaderboard, isBill, type SessionRecord, type RosterEntry, type LeaderboardRow } from "../../src/engine/points";
import { loadInventory, str, num, boolNum, jstr, type D1Like } from "../../src/shared/d1";
import { loadConfig, saveConfig, loadQuestionnaire, saveQuestionnaire } from "../../src/shared/config";
import { authorRationales, llmEnabled, suggestQuestions, type LlmEnv, type ExplainCard, type QuestionStat } from "./llm";
import * as dao from "./dao";
import usersFile from "../../data/users.json";
import leaderboardFile from "../../data/leaderboard.json";

export interface Env extends LlmEnv {
  DB: D1Like;
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGIN?: string;
  AUTH_SECRET?: string;
}

interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: string;
  storeId: string | null;
  title: string;
  passHash?: string;
}
const USERS = usersFile as { demoPassword: string; users: DemoUser[] };
const LEADERBOARD = leaderboardFile as { rows: LeaderboardRow[] };

/** Salesperson roster (id -> name + home store) for leaderboard rendering. */
function salesRoster(): Record<string, RosterEntry> {
  const roster: Record<string, RosterEntry> = {};
  for (const u of USERS.users) {
    if (u.role === "salesperson" && u.storeId) roster[u.id] = { name: u.name, storeId: u.storeId };
  }
  return roster;
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
      if (pathname === "/auth/login" && method === "POST") return handleLogin(req, env);
      if (pathname === "/auth/change-password" && method === "POST") return handleChangePassword(req, env);
      if (pathname === "/leaderboard" && method === "GET") return handleLeaderboard(env, url);
      if (pathname === "/inventory" && method === "GET") return handleInventory(env, url);
      if (pathname === "/recommend" && method === "POST") return handleRecommend(req, env);
      if (pathname === "/explain" && method === "POST") return handleExplain(req, env);
      if (pathname === "/stores" && method === "GET") return handleStores(env);
      if (pathname === "/catalog/health" && method === "GET") return handleCatalogHealth(env);
      if (pathname === "/session" && method === "POST") return handleSession(req, env);
      if (pathname === "/config" && method === "GET") return handleGetConfig(env);
      if (pathname === "/config" && method === "PUT") return handlePutConfig(req, env);
      if (pathname === "/questionnaire" && method === "GET") return handleGetQuestionnaire(env);
      if (pathname === "/questionnaire" && method === "PUT") return handlePutQuestionnaire(req, env);
      if (pathname === "/questions/suggest" && method === "POST") return handleSuggestQuestions(req, env);
      if (pathname === "/admin/sessions/export" && method === "GET") return handleSessionsExport(req, env, url);

      // --- customers (recall + DPDP) ---
      if (pathname === "/customers" && method === "POST") return handleUpsertCustomer(req, env);
      const custEvents = matchParam(pathname, "/customers/", "/events");
      if (custEvents && method === "POST") return handleAddCustomerEvent(req, env, custEvents);
      const custBrand = matchParam(pathname, "/customers/", "/brand");
      if (custBrand && method === "POST") return handleAddBrandPref(req, env, custBrand);
      const custPhone = matchParam(pathname, "/customers/");
      if (custPhone && method === "GET") return handleGetCustomer(req, env, custPhone);
      if (custPhone && method === "DELETE") return handleEraseCustomer(req, env, custPhone);

      // --- offers (live feed is PUBLIC; management is admin) ---
      if (pathname === "/offers" && method === "GET") return handleListLiveOffers(env, url);
      if (pathname === "/offers/all" && method === "GET") return handleListAllOffers(req, env);
      if (pathname === "/offers" && method === "POST") return handleCreateOffer(req, env);
      const offerId = matchParam(pathname, "/offers/");
      if (offerId && method === "DELETE") return handleDeleteOffer(req, env, offerId);

      // --- employees ---
      if (pathname === "/employees" && method === "GET") return handleListEmployees(req, env, url);
      if (pathname === "/employees" && method === "POST") return handleUpsertEmployee(req, env);
      const empId = matchParam(pathname, "/employees/");
      if (empId && method === "PATCH") return handleSetEmployeeStatus(req, env, empId);

      // --- attendance ---
      if (pathname === "/attendance/summary" && method === "GET") return handleAttendanceSummary(req, env, url);
      if (pathname === "/attendance" && method === "GET") return handleListAttendance(req, env, url);
      if (pathname === "/attendance" && method === "POST") return handleMarkAttendance(req, env);

      // --- leaves ---
      if (pathname === "/leaves" && method === "GET") return handleListLeaves(req, env, url);
      if (pathname === "/leaves" && method === "POST") return handleCreateLeave(req, env);
      const leaveId = matchParam(pathname, "/leaves/");
      if (leaveId && method === "PATCH") return handleDecideLeave(req, env, leaveId);

      // --- milestones + incentives ---
      if (pathname === "/milestones" && method === "GET") return handleListMilestones(req, env);
      if (pathname === "/incentives" && method === "GET") return handleListIncentives(req, env, url);
      if (pathname === "/incentives" && method === "POST") return handleAddIncentive(req, env);

      // --- feedback (POST is PUBLIC for anonymous) ---
      if (pathname === "/feedback" && method === "GET") return handleListFeedback(req, env, url);
      if (pathname === "/feedback" && method === "POST") return handleAddFeedback(req, env);

      // --- demand ---
      if (pathname === "/demand" && method === "GET") return handleListDemand(req, env, url);
      if (pathname === "/demand" && method === "POST") return handleAddDemand(req, env);

      // --- engine test harness ---
      if (pathname === "/engine/test" && method === "POST") return handleEngineTest(req, env);

      // --- analytics (views) ---
      if (pathname === "/analytics/store-daily" && method === "GET") return handleAnalyticsStoreDaily(req, env, url);
      if (pathname === "/analytics/demand" && method === "GET") return handleAnalyticsDemand(req, env, url);
      if (pathname === "/analytics/employee-month" && method === "GET") return handleAnalyticsEmployeeMonth(req, env, url);

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
  const [cfg, inventory, boosts] = await Promise.all([
    loadConfig(env.DB),
    // Only this store + category is needed to score one request.
    loadInventory(env.DB, { storeId: reqBody.storeId, category: reqBody.category }),
    // Live admin offer boosts (boost_weight>0) nudge ranking for this store.
    loadBoosts(env.DB, reqBody.storeId),
  ]);
  const result = recommend(reqBody, inventory, cfg, boosts);
  await enrichRationales(env, result, reqBody);
  return json(env, result);
}

/**
 * Phase 5: replace each card's deterministic fitLine with an LLM-authored one
 * (Haiku 4.5), built ONLY from the engine's matched fit reasons. Ranking is
 * untouched. No-op (and never throws) when the LLM is disabled or fails.
 */
async function enrichRationales(env: Env, result: RecommendResult, req: RecommendRequest): Promise<void> {
  if (!llmEnabled(env)) return;
  const tiers = ["good", "better", "best", "stretch"] as const;
  const cards = tiers.map((tier) => result[tier]).filter((c): c is RecommendationCard => Boolean(c));
  if (cards.length === 0) return;
  const lines = await authorRationales(env, {
    lang: req.lang === "hi" ? "hi" : "en",
    answers: req.answers ?? [],
    cards: cards.map((c) => toExplainCard(c, req.category)),
  });
  for (const c of cards) if (lines[c.tier]) c.fitLine = lines[c.tier];
}

function toExplainCard(c: RecommendationCard, category: Category): ExplainCard {
  return { tier: c.tier, brand: c.brand, model: c.model, category, price: c.price, fitReasons: c.fitReasons, fitLine: c.fitLine };
}

// ---------------------------------------------------------------------------
// POST /explain — author rationales for a set of cards (Phase 5 / tooling).
// Returns { rationales: { tier: line }, model, enabled }.
// ---------------------------------------------------------------------------
async function handleExplain(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { cards?: ExplainCard[]; answers?: string[]; lang?: string } | null;
  if (!body || !Array.isArray(body.cards)) {
    return json(env, { error: "bad_request", message: "cards[] required" }, 400);
  }
  const rationales = await authorRationales(env, {
    cards: body.cards,
    answers: body.answers ?? [],
    lang: body.lang === "hi" ? "hi" : "en",
  });
  return json(env, { rationales, model: env.LLM_MODEL || "claude-haiku-4-5", enabled: llmEnabled(env) });
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
// POST /auth/login — role-based sign-in (pilot-grade; demo accounts).
// TODO(auth): replace with a D1 users table + real password hashing / OTP /
// Cloudflare Access for production.
// ---------------------------------------------------------------------------
/** SHA-256 hex — the password hashing scheme for DB-backed login. */
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleLogin(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const ident = (body.email ?? "").trim();
  const password = body.password ?? "";

  // 1) Database-backed: match an ACTIVE employee by email or phone and verify
  //    the SHA-256 password hash. This is the real auth once employees are loaded.
  const emp = await dao.getEmployeeByLogin(env.DB, ident).catch(() => null);
  if (emp && emp.pass_hash && password && (await sha256hex(password)) === emp.pass_hash) {
    const user = {
      id: emp.employee_id, email: emp.email ?? emp.phone ?? emp.employee_id,
      name: emp.name, role: emp.role, storeId: emp.store_id, title: emp.title,
    };
    const token = await signToken(env, { sub: emp.employee_id, role: emp.role, storeId: emp.store_id });
    return json(env, { token, user });
  }

  // 2) Fallback: bundled demo accounts (break-glass, e.g. admin@liqo.in / liqo).
  const u = USERS.users.find((x) => x.email.toLowerCase() === ident.toLowerCase());
  if (u && (!password || password === USERS.demoPassword)) {
    const user = { id: u.id, email: u.email, name: u.name, role: u.role, storeId: u.storeId, title: u.title };
    const token = await signToken(env, { sub: u.id, role: u.role, storeId: u.storeId });
    return json(env, { token, user });
  }

  return json(env, { error: "unauthorized", message: "Invalid email or password" }, 401);
}

/** The signed-in employee's id (token `sub`), or null. */
async function currentUserId(req: Request, env: Env): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyToken(env, token);
  return payload?.sub ?? null;
}

/** POST /auth/change-password — self-service password update for DB accounts. */
async function handleChangePassword(req: Request, env: Env): Promise<Response> {
  const uid = await currentUserId(req, env);
  if (!uid) return unauthorized(env);
  const b = (await req.json().catch(() => ({}))) as { oldPassword?: string; newPassword?: string };
  const oldP = b.oldPassword ?? "";
  const newP = b.newPassword ?? "";
  if (newP.length < 4) return badRequest(env, "New password must be at least 4 characters");
  const emp = await dao.getEmployee(env.DB, uid);
  if (!emp) return badRequest(env, "Password change is only available for database accounts.");
  if (!emp.pass_hash || (await sha256hex(oldP)) !== emp.pass_hash) {
    return json(env, { error: "unauthorized", message: "Current password is incorrect" }, 401);
  }
  await dao.setEmployeePassword(env.DB, uid, await sha256hex(newP));
  return json(env, { ok: true });
}

// ---------------------------------------------------------------------------
// GET /leaderboard — gamification feed, aggregated live from logged sessions.
// Points are derived purely from journey outcomes (see engine/points.ts), so
// the board is explainable. Falls back to the seeded demo board until real
// outcomes have been logged.
// ---------------------------------------------------------------------------
async function handleLeaderboard(env: Env, url: URL): Promise<Response> {
  const storeId = url.searchParams.get("storeId");
  const { results } = await env.DB
    .prepare(
      `SELECT user_id AS userId, store_id AS storeId, outcome,
              items_per_bill AS itemsPerBill, total, COALESCE(ts, created_at) AS ts
       FROM sessions WHERE user_id IS NOT NULL AND outcome IS NOT NULL`,
    )
    .all<SessionRecord>()
    .catch(() => ({ results: [] as SessionRecord[] }));
  const hasRealBills = results.some((r) => isBill(r.outcome));
  let rows = hasRealBills
    ? computeLeaderboard(results, salesRoster(), new Date().toISOString())
    : LEADERBOARD.rows;
  if (storeId) rows = rows.filter((r) => r.storeId === storeId);
  return json(env, { rows });
}

// ---------------------------------------------------------------------------
// GET /inventory?storeId= — retail rows for the Inventory Browser.
// ---------------------------------------------------------------------------
async function handleInventory(env: Env, url: URL): Promise<Response> {
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return json(env, { error: "bad_request", message: "storeId required" }, 400);
  const items = (await loadInventory(env.DB, { storeId })).filter((i) => i.channel === "retail");
  return json(env, { items });
}

/** Sign a compact HMAC token (header-less JWT-style). Pilot-grade. */
async function signToken(env: Env, payload: Record<string, unknown>): Promise<string> {
  const secret = env.AUTH_SECRET || "liqo-pilot-dev-secret";
  const bodyB64 = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${bodyB64}.${sigB64}`;
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
      `SELECT store_id AS storeId, category, COUNT(*) AS items, SUM(stock_qty) AS units
       FROM inventory WHERE channel = 'retail' GROUP BY store_id, category`,
    )
    .all<{ storeId: string; category: string; items: number; units: number }>();
  const ageing = await env.DB
    .prepare(
      `SELECT ageing_slab AS slab, ageing_rank AS rank, COUNT(*) AS items, SUM(stock_qty) AS units
       FROM inventory WHERE channel = 'retail' GROUP BY ageing_rank, ageing_slab ORDER BY ageing_rank`,
    )
    .all<{ slab: string; rank: number; items: number; units: number }>();
  const total = await env.DB
    .prepare("SELECT COUNT(*) AS n, SUM(stock_qty) AS units, MAX(last_synced_at) AS lastSyncedAt FROM inventory WHERE channel = 'retail'")
    .first<{ n: number; units: number; lastSyncedAt: string }>();

  return json(env, {
    ok: true,
    totalRows: total?.n ?? 0,
    totalUnits: total?.units ?? 0,
    lastSyncedAt: total?.lastSyncedAt ?? null,
    perCategory: byCat.results,
    perStore: byStore.results,
    ageing: ageing.results,
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
       (session_id, user_id, store_id, category, lang, answers, budget_band, stretch, exchange,
        shown_cards, chosen, attach, outcome, total, items_per_bill, ts, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      sessionId,
      str(s.userId),
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
async function handleGetConfig(env: Env): Promise<Response> {
  // Public read — the app needs price bands / attach live.
  // TODO(prod): split a public app-config (bands, attach, emi) from the full
  // commercial config (rankingBlend, brandPreference, marginModel).
  const cfg = await loadConfig(env.DB);
  return json(env, cfg);
}

async function handlePutConfig(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return json(env, { error: "unauthorized" }, 401);
  const cfg = (await req.json().catch(() => null)) as EngineConfig | null;
  const err = validateConfig(cfg);
  if (err) return json(env, { error: "bad_request", message: err }, 400);
  cfg!.updatedAt = new Date().toISOString();
  await saveConfig(env.DB, cfg!);
  return json(env, { ok: true, version: cfg!.version, updatedAt: cfg!.updatedAt });
}

// GET /questionnaire (public) · PUT /questionnaire (admin) — live, no redeploy.
async function handleGetQuestionnaire(env: Env): Promise<Response> {
  return json(env, await loadQuestionnaire(env.DB));
}

async function handlePutQuestionnaire(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return json(env, { error: "unauthorized" }, 401);
  const q = (await req.json().catch(() => null)) as { categories?: unknown } | null;
  if (!q || typeof q !== "object" || !q.categories) {
    return json(env, { error: "bad_request", message: "questionnaire with categories required" }, 400);
  }
  await saveQuestionnaire(env.DB, q);
  return json(env, { ok: true });
}

// POST /questions/suggest (admin) — Phase D.3: aggregate session stats, ask the
// LLM to propose questionnaire improvements toward an educated purchase. Returns
// drafts for the admin to review in the editor; nothing is applied automatically.
async function handleSuggestQuestions(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return json(env, { error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { lang?: string };
  const lang = body.lang === "hi" ? "hi" : "en";
  const questionnaire = await loadQuestionnaire(env.DB);
  type SRow = { category: string; outcome: string | null; chosen: string | null; answers: string | null };
  const { results } = await env.DB
    .prepare("SELECT category, outcome, chosen, answers FROM sessions WHERE category IS NOT NULL ORDER BY created_at DESC LIMIT 500")
    .all<SRow>()
    .catch(() => ({ results: [] as SRow[] }));
  const byCat = new Map<string, { sessions: number; bought: number; drop: number; tags: Map<string, number> }>();
  for (const r of results) {
    const a = byCat.get(r.category) ?? { sessions: 0, bought: 0, drop: 0, tags: new Map<string, number>() };
    a.sessions++;
    const o = (r.outcome ?? "").replace(/_/g, "-");
    if (o === "bought-recommended" || o === "bought-different") a.bought++;
    let chosenSku = "";
    try { chosenSku = (JSON.parse(r.chosen ?? "{}") as { sku?: string }).sku ?? ""; } catch { /* ignore */ }
    if (!chosenSku) a.drop++;
    try { for (const tg of JSON.parse(r.answers ?? "[]") as string[]) a.tags.set(tg, (a.tags.get(tg) ?? 0) + 1); } catch { /* ignore */ }
    byCat.set(r.category, a);
  }
  const stats: QuestionStat[] = [...byCat.entries()].map(([category, a]) => ({
    category,
    sessions: a.sessions,
    boughtRate: a.sessions ? Number((a.bought / a.sessions).toFixed(2)) : 0,
    dropRate: a.sessions ? Number((a.drop / a.sessions).toFixed(2)) : 0,
    topTags: [...a.tags.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([tag, count]) => ({ tag, count })),
  }));
  const suggestions = await suggestQuestions(env, { questionnaire, stats, lang });
  return json(env, { suggestions, stats, enabled: llmEnabled(env) });
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
  if (!(await checkAdmin(req, env))) return json(env, { error: "unauthorized" }, 401);
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

// ===========================================================================
// Retail data endpoints (customers, offers, HR, feedback, demand, analytics).
// Read paths map snake_case DAO rows to the API as-is; writes coerce via dao's
// *Input types. Path params come from url.pathname (see matchParam).
// ===========================================================================
const STAFF_ROLES = ["manager", "salesperson"];
const MANAGER = ["manager"];

const unauthorized = (env: Env) => json(env, { error: "unauthorized" }, 401);
const badRequest = (env: Env, message: string) => json(env, { error: "bad_request", message }, 400);
const nowISO = () => new Date().toISOString();

/** Read a JSON body as a loose record (never throws; {} on empty/invalid). */
async function readBody(req: Request): Promise<Record<string, unknown>> {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

/**
 * Match a single path param between `prefix` and optional `suffix`.
 * Returns the URL-decoded segment, or null when the path doesn't fit or the
 * segment is empty / contains a "/" (so "/customers/:phone" never swallows
 * "/customers/:phone/events"). Pure string parsing — no router dependency.
 */
function matchParam(pathname: string, prefix: string, suffix = ""): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const inner = suffix ? (rest.endsWith(suffix) ? rest.slice(0, -suffix.length) : null) : rest;
  if (inner == null || inner.length === 0 || inner.includes("/")) return null;
  try {
    return decodeURIComponent(inner);
  } catch {
    return inner;
  }
}

// --- customers ---
async function handleGetCustomer(req: Request, env: Env, phone: string): Promise<Response> {
  // Recall: any logged-in staff (admin / manager / salesperson).
  if (!(await checkRole(req, env, STAFF_ROLES))) return unauthorized(env);
  const bundle = await dao.getCustomerByPhone(env.DB, phone);
  if (!bundle) return json(env, { error: "not_found", phone }, 404);
  return json(env, bundle);
}

async function handleUpsertCustomer(req: Request, env: Env): Promise<Response> {
  if (!(await checkRole(req, env, STAFF_ROLES))) return unauthorized(env);
  const b = await readBody(req);
  const phone = str(b.phone);
  if (!phone) return badRequest(env, "phone required");
  const customerId = await dao.upsertCustomer(env.DB, {
    phone,
    name: str(b.name),
    email: str(b.email),
    consent: !!b.consent,
    premiumTier: (b.premium_tier ?? b.premiumTier) as dao.CustomerInput["premiumTier"],
    preferredPayment: (b.preferred_payment ?? b.preferredPayment) as dao.CustomerInput["preferredPayment"],
    homeStoreId: str(b.home_store_id ?? b.homeStoreId),
    nowISO: nowISO(),
  });
  return json(env, { ok: true, customerId });
}

async function handleAddCustomerEvent(req: Request, env: Env, phone: string): Promise<Response> {
  if (!(await checkRole(req, env, STAFF_ROLES))) return unauthorized(env);
  const b = await readBody(req);
  if (!b.type) return badRequest(env, "type required");
  const eventId = await dao.addCustomerEvent(env.DB, {
    customerId: "c-" + phone,
    type: b.type as dao.CustomerEventInput["type"],
    category: str(b.category),
    brand: str(b.brand),
    budgetBand: str(b.budget_band ?? b.budgetBand),
    sku: str(b.sku),
    storeId: str(b.store_id ?? b.storeId),
    employeeId: str(b.employee_id ?? b.employeeId),
    sessionId: str(b.session_id ?? b.sessionId),
    amount: num(b.amount),
    meta: b.meta,
    ts: str(b.ts) ?? nowISO(),
  });
  return json(env, { ok: true, eventId });
}

async function handleAddBrandPref(req: Request, env: Env, phone: string): Promise<Response> {
  if (!(await checkRole(req, env, STAFF_ROLES))) return unauthorized(env);
  const b = await readBody(req);
  const brand = str(b.brand);
  if (!brand) return badRequest(env, "brand required");
  await dao.addBrandPref(env.DB, {
    customerId: "c-" + phone,
    brand,
    category: str(b.category),
    affinity: (b.affinity ?? "likes") as dao.BrandPrefInput["affinity"],
  });
  return json(env, { ok: true });
}

async function handleEraseCustomer(req: Request, env: Env, phone: string): Promise<Response> {
  // DPDP erase: admin or manager only.
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  await dao.eraseCustomer(env.DB, phone);
  return json(env, { ok: true, erased: phone });
}

// --- offers ---
async function handleListLiveOffers(env: Env, url: URL): Promise<Response> {
  // PUBLIC — app startup loads the live offer strip.
  const storeId = url.searchParams.get("storeId") ?? undefined;
  const offers = await dao.listLiveOffers(env.DB, { storeId, nowISO: nowISO() });
  return json(env, { offers });
}

async function handleListAllOffers(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  return json(env, { offers: await dao.listAllOffers(env.DB) });
}

async function handleCreateOffer(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  const b = await readBody(req);
  const offerId = str(b.offer_id ?? b.offerId) ?? "off-" + crypto.randomUUID().slice(0, 8);
  const title = str(b.title);
  const startsAt = str(b.starts_at ?? b.startsAt);
  const endsAt = str(b.ends_at ?? b.endsAt);
  if (!title) return badRequest(env, "title required");
  if (!startsAt || !endsAt) return badRequest(env, "starts_at and ends_at required");
  await dao.createOffer(env.DB, {
    offerId,
    title,
    description: str(b.description),
    brand: str(b.brand),
    category: str(b.category),
    sku: str(b.sku),
    storeId: str(b.store_id ?? b.storeId),
    discountPct: num(b.discount_pct ?? b.discountPct),
    offerPrice: num(b.offer_price ?? b.offerPrice),
    image: str(b.image),
    startsAt,
    endsAt,
    boostWeight: num(b.boost_weight ?? b.boostWeight) ?? 0,
    active: b.active == null ? true : !!b.active,
    createdBy: str(b.created_by ?? b.createdBy),
  });
  return json(env, { ok: true, offerId });
}

async function handleDeleteOffer(req: Request, env: Env, id: string): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  await dao.deleteOffer(env.DB, id);
  return json(env, { ok: true, deleted: id });
}

// --- employees ---
async function handleListEmployees(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const employees = await dao.listEmployees(env.DB, {
    storeId: url.searchParams.get("storeId") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
  });
  return json(env, { employees });
}

async function handleUpsertEmployee(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  const b = await readBody(req);
  const employeeId = str(b.employee_id ?? b.employeeId);
  const name = str(b.name);
  const role = b.role as dao.EmployeeInput["role"];
  if (!employeeId || !name || !role) return badRequest(env, "employee_id, name and role required");
  await dao.upsertEmployee(env.DB, {
    employeeId,
    name,
    email: str(b.email),
    phone: str(b.phone),
    role,
    storeId: str(b.store_id ?? b.storeId),
    title: str(b.title),
    status: (b.status ?? "active") as dao.EmployeeInput["status"],
    passHash: str(b.pass_hash ?? b.passHash),
    joinedAt: str(b.joined_at ?? b.joinedAt),
    nowISO: nowISO(),
  });
  return json(env, { ok: true, employeeId });
}

async function handleSetEmployeeStatus(req: Request, env: Env, id: string): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  const b = await readBody(req);
  const status = b.status;
  if (status !== "active" && status !== "inactive") return badRequest(env, "status active|inactive required");
  await dao.setEmployeeStatus(env.DB, id, status);
  return json(env, { ok: true, employeeId: id, status });
}

// --- attendance ---
async function handleListAttendance(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const attendance = await dao.listAttendance(env.DB, {
    storeId: url.searchParams.get("storeId") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
  });
  return json(env, { attendance });
}

async function handleAttendanceSummary(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const storeId = url.searchParams.get("storeId");
  const date = url.searchParams.get("date");
  if (!storeId || !date) return badRequest(env, "storeId and date required");
  return json(env, await dao.attendanceSummary(env.DB, storeId, date));
}

async function handleMarkAttendance(req: Request, env: Env): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const b = await readBody(req);
  const employeeId = str(b.employee_id ?? b.employeeId);
  const date = str(b.date);
  const status = b.status as dao.AttendanceInput["status"];
  if (!employeeId || !date || !status) return badRequest(env, "employee_id, date and status required");
  await dao.markAttendance(env.DB, {
    employeeId,
    storeId: str(b.store_id ?? b.storeId),
    date,
    status,
    checkIn: str(b.check_in ?? b.checkIn),
    checkOut: str(b.check_out ?? b.checkOut),
    note: str(b.note),
    markedBy: str(b.marked_by ?? b.markedBy),
  });
  return json(env, { ok: true });
}

// --- leaves ---
async function handleListLeaves(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const leaves = await dao.listLeaves(env.DB, {
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    storeId: url.searchParams.get("storeId") ?? undefined,
  });
  return json(env, { leaves });
}

async function handleCreateLeave(req: Request, env: Env): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const b = await readBody(req);
  const employeeId = str(b.employee_id ?? b.employeeId);
  const type = b.type as dao.LeaveInput["type"];
  const fromDate = str(b.from_date ?? b.fromDate);
  const toDate = str(b.to_date ?? b.toDate);
  if (!employeeId || !type || !fromDate || !toDate) return badRequest(env, "employee_id, type, from_date and to_date required");
  const id = await dao.createLeave(env.DB, {
    employeeId,
    type,
    fromDate,
    toDate,
    days: num(b.days) ?? undefined,
    reason: str(b.reason),
  });
  return json(env, { ok: true, id });
}

async function handleDecideLeave(req: Request, env: Env, idStr: string): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const id = Number(idStr);
  if (!Number.isFinite(id)) return badRequest(env, "numeric leave id required");
  const b = await readBody(req);
  const status = b.status;
  if (status !== "approved" && status !== "rejected" && status !== "cancelled") {
    return badRequest(env, "status approved|rejected|cancelled required");
  }
  const approverId = str(b.approver_id ?? b.approverId) ?? "";
  await dao.decideLeave(env.DB, id, status, approverId, nowISO());
  return json(env, { ok: true, id, status });
}

// --- milestones + incentives ---
async function handleListMilestones(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  return json(env, { milestones: await dao.listMilestones(env.DB) });
}

async function handleListIncentives(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  const incentives = await dao.listIncentives(env.DB, {
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
  });
  return json(env, { incentives });
}

async function handleAddIncentive(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  const b = await readBody(req);
  const employeeId = str(b.employee_id ?? b.employeeId);
  const period = str(b.period);
  if (!employeeId || !period) return badRequest(env, "employee_id and period required");
  const id = await dao.addIncentive(env.DB, {
    employeeId,
    milestoneId: str(b.milestone_id ?? b.milestoneId),
    period,
    points: num(b.points) ?? undefined,
    amountInr: num(b.amount_inr ?? b.amountInr) ?? undefined,
    reason: str(b.reason),
    status: (b.status ?? undefined) as dao.IncentiveInput["status"],
  });
  return json(env, { ok: true, id });
}

// --- feedback ---
async function handleListFeedback(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const feedback = await dao.listFeedback(env.DB, { storeId: url.searchParams.get("storeId") ?? undefined });
  return json(env, { feedback });
}

async function handleAddFeedback(req: Request, env: Env): Promise<Response> {
  // PUBLIC — allow anonymous submissions (no auth gate).
  const b = await readBody(req);
  const category = b.category as dao.FeedbackInput["category"];
  if (!category) return badRequest(env, "category required");
  const id = await dao.addFeedback(env.DB, {
    employeeId: str(b.employee_id ?? b.employeeId),
    storeId: str(b.store_id ?? b.storeId),
    category,
    rating: num(b.rating),
    message: str(b.message),
    anonymous: !!b.anonymous,
  });
  return json(env, { ok: true, id });
}

// --- demand ---
async function handleListDemand(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const demand = await dao.listDemand(env.DB, { storeId: url.searchParams.get("storeId") ?? undefined });
  return json(env, { demand });
}

async function handleAddDemand(req: Request, env: Env): Promise<Response> {
  const b = await readBody(req);
  const id = await dao.addDemandRequest(env.DB, {
    storeId: str(b.store_id ?? b.storeId),
    customerId: str(b.customer_id ?? b.customerId),
    employeeId: str(b.employee_id ?? b.employeeId),
    category: str(b.category),
    brand: str(b.brand),
    sku: str(b.sku),
    budgetBand: str(b.budget_band ?? b.budgetBand),
    note: str(b.note),
    ts: str(b.ts) ?? nowISO(),
  });
  return json(env, { ok: true, id });
}

// --- engine test harness (admin) ---
/**
 * Run the PURE engine verbosely for tuning: loads config + this store/category's
 * inventory (exactly like handleRecommend), runs recommend(), and returns the
 * result plus every eligible candidate with its _score. Read-only.
 */
async function handleEngineTest(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return unauthorized(env);
  const body = (await req.json().catch(() => ({}))) as Partial<RecommendRequest>;
  const err = validateRecommend(body);
  if (err) return badRequest(env, err);

  const reqBody = body as RecommendRequest;
  const [cfg, inventory, boosts] = await Promise.all([
    loadConfig(env.DB),
    loadInventory(env.DB, { storeId: reqBody.storeId, category: reqBody.category }),
    loadBoosts(env.DB, reqBody.storeId),
  ]);
  const result = recommend(reqBody, inventory, cfg, boosts);

  // Mirror the engine's hard gate so the caller sees the eligible set + scores.
  const band = cfg.priceBands[reqBody.category]?.[reqBody.budgetBand];
  const maxPrice = band ? (reqBody.stretch ? band[1] * (1 + cfg.stretchThreshold) : band[1]) : Infinity;
  const recommendable = cfg.transform.recommendableChannels;
  const excluded = new Set(cfg.brandExclusions[reqBody.category] ?? []);
  const cards = [result.good, result.better, result.best, result.stretch]
    .filter((c): c is RecommendationCard => Boolean(c))
    .map((c) => ({ tier: c.tier, sku: c.sku, brand: c.brand, price: c.price, _score: c._score }));
  const eligibleCount = inventory.filter(
    (it) =>
      it.category === reqBody.category &&
      it.storeId === reqBody.storeId &&
      recommendable.includes(it.channel) &&
      it.stockQty > 0 &&
      !excluded.has(it.brand) &&
      (!band || (it.price >= band[0] && it.price <= maxPrice)),
  ).length;

  return json(env, { result, meta: result.meta, eligibleCount, scores: cards, boostsApplied: boosts.length });
}

// --- analytics (views) ---
async function handleAnalyticsStoreDaily(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const rows = await dao.storeDaily(env.DB, {
    storeId: url.searchParams.get("storeId") ?? undefined,
    days: num(url.searchParams.get("days")) ?? undefined,
  });
  return json(env, { rows });
}

async function handleAnalyticsDemand(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const rows = await dao.demandByCategory(env.DB, { storeId: url.searchParams.get("storeId") ?? undefined });
  return json(env, { rows });
}

async function handleAnalyticsEmployeeMonth(req: Request, env: Env, url: URL): Promise<Response> {
  if (!(await checkRole(req, env, MANAGER))) return unauthorized(env);
  const rows = await dao.employeeMonth(env.DB, {
    month: url.searchParams.get("month") ?? undefined,
    storeId: url.searchParams.get("storeId") ?? undefined,
  });
  return json(env, { rows });
}

/** Live offer boosts for a store, mapped from DAO rows to the engine's shape. */
async function loadBoosts(db: D1Like, storeId: string): Promise<EngineBoost[]> {
  const rows = await dao.activeBoosts(db, { storeId, nowISO: nowISO() });
  return rows.map((r) => ({
    brand: r.brand ?? undefined,
    category: r.category ?? undefined,
    sku: r.sku ?? undefined,
    weight: r.weight,
  }));
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
/** Admin gate: a logged-in admin (signed token role=admin) OR the ADMIN_TOKEN secret. */
async function checkAdmin(req: Request, env: Env): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-admin-token") || "";
  if (!token) return false;
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN) return true;
  const payload = await verifyToken(env, token);
  return payload?.role === "admin";
}

/**
 * Role gate for staff endpoints: passes when the ADMIN_TOKEN secret is presented
 * OR the bearer is a valid signed token whose role is in `roles`. Admin is always
 * accepted (superset), so callers need only list the additional roles allowed.
 */
async function checkRole(req: Request, env: Env, roles: string[]): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-admin-token") || "";
  if (!token) return false;
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN) return true;
  const payload = await verifyToken(env, token);
  const role = payload?.role;
  return !!role && (role === "admin" || roles.includes(role));
}

async function verifyToken(env: Env, token: string): Promise<{ role?: string; sub?: string } | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const secret = env.AUTH_SECRET || "liqo-pilot-dev-secret";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(body));
    return ok ? (JSON.parse(atob(body)) as { role?: string; sub?: string }) : null;
  } catch {
    return null;
  }
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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

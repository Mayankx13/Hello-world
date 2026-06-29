/**
 * LIQO web API client.
 *
 * Two transports behind one interface:
 *   - REMOTE: when VITE_API_BASE is set, talks to the API Worker over HTTPS.
 *   - OFFLINE/DEMO: otherwise runs the SAME pure engine client-side against a
 *     bundled inventory sample, so the PWA is fully functional offline and in
 *     review without deploying Workers.
 *
 * The UI only imports from here — it never knows which transport is active.
 */
import { recommend, transformInventory, mergeLeaderboard, pointsToInr, POINTS_PER_INR } from "@engine";
import type {
  EngineConfig,
  InventoryItem,
  RawInventoryRow,
  RecommendRequest,
  RecommendResult,
  SessionRecord,
} from "@engine";

export type {
  RecommendRequest,
  RecommendResult,
  EngineConfig,
} from "@engine";

/** Incentive conversion (50 pts = ₹1) — re-exported so screens import from here. */
export { pointsToInr, POINTS_PER_INR };

export interface Store {
  id: string;
  name: string;
  label: string;
  region: string;
  pilot: boolean;
}

export interface SessionLog {
  sessionId: string;
  userId?: string | null; // salesperson (filled from the signed-in user if omitted)
  storeId: string;
  category: string;
  lang: string;
  answers: string[];
  budgetBand: string;
  stretch: boolean;
  exchange: boolean;
  shownCards: unknown;
  chosen: unknown;
  attach: string[];
  outcome: string | null;
  total: number;
  itemsPerBill: number;
  ts: string;
}

const API_BASE: string | undefined = import.meta.env.VITE_API_BASE;
export const IS_REMOTE = !!API_BASE;

// App-shell data is served relative to the deploy base so the app works at a
// domain root (Cloudflare Pages) AND under a subpath (e.g. GitHub Pages
// /Hello-world/). BASE_URL always has a trailing slash.
const BASE = import.meta.env.BASE_URL;

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

/** Authenticated GET — sends the Bearer token for admin/manager-gated reads. */
async function getJSONAuth<T>(path: string, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(path, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- app-shell data (live config + questionnaire are editable from admin) ----
let _stores: Promise<Store[]> | null = null;
let _inventory: Promise<InventoryItem[]> | null = null;

// Admin edits apply live with NO redeploy: offline they're held as a localStorage
// override; remote they're PUT to the API Worker (D1). Reads prefer the override,
// then the live API (remote) or the bundled default (offline).
const CFG_OVERRIDE = "liqo.config.override";
const Q_OVERRIDE = "liqo.questionnaire.override";

function readOverride<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function getConfig(): Promise<EngineConfig> {
  const ov = readOverride<EngineConfig>(CFG_OVERRIDE);
  if (ov) return ov;
  return getJSON<EngineConfig>(IS_REMOTE ? `${API_BASE}/config` : `${BASE}config.json`);
}

export async function getQuestionnaire(): Promise<Questionnaire> {
  const ov = readOverride<Questionnaire>(Q_OVERRIDE);
  if (ov) return ov;
  return getJSON<Questionnaire>(IS_REMOTE ? `${API_BASE}/questionnaire` : `${BASE}questionnaire.json`);
}

function authHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export async function saveConfigLive(cfg: EngineConfig, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    const res = await fetch(`${API_BASE}/config`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(cfg) });
    if (!res.ok) throw new Error(res.status === 401 ? "Admin access required" : `Save failed (${res.status})`);
  } else {
    localStorage.setItem(CFG_OVERRIDE, JSON.stringify(cfg));
  }
}

export async function saveQuestionnaireLive(q: Questionnaire, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    const res = await fetch(`${API_BASE}/questionnaire`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(q) });
    if (!res.ok) throw new Error(res.status === 401 ? "Admin access required" : `Save failed (${res.status})`);
  } else {
    localStorage.setItem(Q_OVERRIDE, JSON.stringify(q));
  }
}

export async function resetConfigLive(token?: string | null): Promise<void> {
  if (IS_REMOTE) await saveConfigLive(await getJSON<EngineConfig>(`${BASE}config.json`), token);
  else localStorage.removeItem(CFG_OVERRIDE);
}

export async function resetQuestionnaireLive(token?: string | null): Promise<void> {
  if (IS_REMOTE) await saveQuestionnaireLive(await getJSON<Questionnaire>(`${BASE}questionnaire.json`), token);
  else localStorage.removeItem(Q_OVERRIDE);
}

export function hasConfigOverride(): boolean { return !!readOverride(CFG_OVERRIDE); }
export function hasQuestionnaireOverride(): boolean { return !!readOverride(Q_OVERRIDE); }

// ---- LLM-suggested questionnaire improvements (D.3) ----
export interface QuestionSuggestion {
  category: string;
  action: "add" | "reword" | "improve_options";
  questionId?: string;
  prompt: { en: string; hi: string };
  options: { label: { en: string; hi: string }; tags: string[] }[];
  rationale: string;
}
/** Ask the LLM (Haiku 4.5, via the API Worker) to propose questionnaire
 *  improvements from logged interactions. Admin-only; needs the remote API. */
export async function suggestQuestions(lang: Lang, token?: string | null): Promise<{ suggestions: QuestionSuggestion[]; enabled: boolean }> {
  if (!IS_REMOTE) return { suggestions: [], enabled: false };
  const res = await fetch(`${API_BASE}/questions/suggest`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ lang }) });
  if (!res.ok) throw new Error(res.status === 401 ? "Admin access required" : `Suggest failed (${res.status})`);
  return res.json() as Promise<{ suggestions: QuestionSuggestion[]; enabled: boolean }>;
}

export function getStores(): Promise<Store[]> {
  if (_stores) return _stores;
  _stores = IS_REMOTE
    ? getJSON<{ stores: Store[] }>(`${API_BASE}/stores`).then((d) => d.stores)
    : getJSON<{ stores: Store[] }>(`${BASE}stores.json`).then((d) => d.stores);
  return _stores;
}

function getInventory(): Promise<InventoryItem[]> {
  if (_inventory) return _inventory;
  _inventory = Promise.all([getJSON<RawInventoryRow[]>(`${BASE}sample-inventory.json`), getConfig()]).then(
    ([raw, cfg]) => transformInventory(raw, cfg, new Date().toISOString()),
  );
  return _inventory;
}

/** POST /recommend (remote) or run the engine locally (offline). */
export async function postRecommend(req: RecommendRequest): Promise<RecommendResult> {
  if (IS_REMOTE) {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`/recommend -> ${res.status}`);
    return res.json() as Promise<RecommendResult>;
  }
  const [inventory, cfg] = await Promise.all([getInventory(), getConfig()]);
  return recommend(req, inventory, cfg);
}

const SESSIONS_KEY = "liqo.sessions";

/** The signed-in user id, read from the auth blob (for session attribution). */
function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem("liqo.auth");
    return raw ? (JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? null : null;
  } catch {
    return null;
  }
}

/** POST /session — best-effort; never blocks the UI. */
export async function logSession(s: SessionLog): Promise<void> {
  const withUser: SessionLog = { ...s, userId: s.userId ?? currentUserId() };
  try {
    if (IS_REMOTE) {
      await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(withUser),
      });
    } else {
      const prev = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]");
      prev.push(withUser);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(prev));
    }
  } catch {
    /* swallow — logging must never break the journey */
  }
}

/** Locally-logged journeys → session records for the offline leaderboard overlay. */
function readLocalSessions(): SessionRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? "[]") as SessionLog[];
    return raw.map((s) => ({
      userId: s.userId ?? null,
      storeId: s.storeId ?? null,
      outcome: s.outcome ?? null,
      itemsPerBill: s.itemsPerBill ?? null,
      total: s.total ?? null,
      ts: s.ts ?? null,
    }));
  } catch {
    return [];
  }
}

// ---- roles, auth & dashboards (Phase 1) ----
export type Role = "admin" | "manager" | "salesperson";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  storeId: string | null; // null = all stores (admin)
  title: string;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  storeId: string;
  weekPoints: number;
  monthPoints: number;
  bills: number;
  itemsPerBill: number;
  recoRate: number;
  streak: number;
}

interface DemoUsersFile {
  demoPassword: string;
  users: (AuthUser & { passHash?: string })[];
}

let _demoUsers: Promise<DemoUsersFile> | null = null;
export function getDemoUsers(): Promise<DemoUsersFile> {
  return (_demoUsers ??= getJSON<DemoUsersFile>(`${BASE}users.json`));
}

/** Authenticate. Offline/demo: validate against bundled users.json. Remote: POST /auth/login. */
export async function apiLogin(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  if (IS_REMOTE) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(res.status === 401 ? "Invalid email or password" : `Login failed (${res.status})`);
    return res.json() as Promise<{ token: string; user: AuthUser }>;
  }
  const { demoPassword, users } = await getDemoUsers();
  const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || (password && password !== demoPassword)) throw new Error("Invalid email or password");
  const user: AuthUser = { id: u.id, email: u.email, name: u.name, role: u.role, storeId: u.storeId, title: u.title };
  return { token: `demo:${u.id}`, user };
}

export async function getLeaderboard(opts?: { storeId?: string | null }): Promise<LeaderboardRow[]> {
  let rows: LeaderboardRow[];
  if (IS_REMOTE) {
    rows = await getJSON<{ rows: LeaderboardRow[] }>(`${API_BASE}/leaderboard`).then((d) => d.rows);
  } else {
    // Demo: seed the board from the bundled sample, then overlay the signed-in
    // salesperson's own logged journeys so their row climbs live as they sell.
    const demo = await getJSON<{ rows: LeaderboardRow[] }>(`${BASE}leaderboard-demo.json`).then((d) => d.rows);
    const local = readLocalSessions();
    rows = local.length ? (mergeLeaderboard(demo, local, new Date().toISOString()) as LeaderboardRow[]) : demo;
  }
  if (opts?.storeId) rows = rows.filter((r) => r.storeId === opts.storeId);
  return rows;
}

/** Inventory rows for the Inventory Browser (retail, one store). */
export async function getInventoryList(opts: { storeId: string }): Promise<InventoryItem[]> {
  if (IS_REMOTE) {
    const u = `${API_BASE}/inventory?storeId=${encodeURIComponent(opts.storeId)}`;
    return getJSON<{ items: InventoryItem[] }>(u).then((d) => d.items);
  }
  const inv = await getInventory();
  return inv.filter((i) => i.channel === "retail" && i.storeId === opts.storeId);
}

export type { InventoryItem } from "@engine";

// ---- catalog health (Command Centre — Phase 4) ----
export interface CategoryHealth { category: string; items: number; units: number; lastSyncedAt?: string }
export interface StoreCoverage { storeId: string; category: string; items: number; units: number }
export interface AgeingBucket { slab: string | null; rank: number; items: number; units: number }
export interface CatalogHealth {
  totalRows: number;
  totalUnits: number;
  lastSyncedAt: string | null;
  perCategory: CategoryHealth[];
  perStore: StoreCoverage[];
  ageing: AgeingBucket[];
}

/** Cross-store inventory health for the Command Centre. Remote: GET /catalog/health.
 *  Offline: aggregate the same shape from the bundled retail inventory. */
export async function getCatalogHealth(): Promise<CatalogHealth> {
  if (IS_REMOTE) return getJSON<CatalogHealth>(`${API_BASE}/catalog/health`);
  const inv = (await getInventory()).filter((i) => i.channel === "retail");
  const cat = new Map<string, CategoryHealth>();
  const store = new Map<string, StoreCoverage>();
  const age = new Map<number, AgeingBucket>();
  let totalUnits = 0;
  let lastSyncedAt: string | null = null;
  for (const i of inv) {
    totalUnits += i.stockQty;
    if (!lastSyncedAt || i.lastSyncedAt > lastSyncedAt) lastSyncedAt = i.lastSyncedAt;
    const c = cat.get(i.category) ?? { category: i.category, items: 0, units: 0 };
    c.items++; c.units += i.stockQty; cat.set(i.category, c);
    const sk = `${i.storeId}|${i.category}`;
    const s = store.get(sk) ?? { storeId: i.storeId, category: i.category, items: 0, units: 0 };
    s.items++; s.units += i.stockQty; store.set(sk, s);
    const a = age.get(i.ageingRank) ?? { slab: i.ageingSlab, rank: i.ageingRank, items: 0, units: 0 };
    a.items++; a.units += i.stockQty; age.set(i.ageingRank, a);
  }
  return {
    totalRows: inv.length,
    totalUnits,
    lastSyncedAt,
    perCategory: [...cat.values()].sort((a, b) => a.category.localeCompare(b.category)),
    perStore: [...store.values()],
    ageing: [...age.values()].sort((a, b) => a.rank - b.rank),
  };
}

// ---- questionnaire shape (mirrors data/questionnaire.json) ----
export type Lang = "en" | "hi";
export type Loc = Record<Lang, string>;
export interface QOption {
  id: string;
  label: Loc;
  sub?: Loc;
  tags: string[];
  notSure?: boolean;
}
export interface QQuestion {
  id: string;
  gate: "capacity" | "form" | "feature" | "eco" | "modifier" | "brand";
  kind: "single" | "multi";
  max?: number;
  prompt: Loc;
  hint?: Loc;
  options: QOption[];
}
export interface QCategory {
  label: Loc;
  sub: Loc;
  questions: QQuestion[];
}
export interface Questionnaire {
  version: string;
  languages: Lang[];
  default: Lang;
  categories: Record<string, QCategory>;
}

// ---- engine testing console (D.2) ----
export interface EngineScore { tier: string; sku: string; brand: string; price: number; _score: number }
export interface EngineTestResult {
  result: RecommendResult;
  meta: RecommendResult["meta"];
  eligibleCount: number;
  scores: EngineScore[];
  boostsApplied: number;
}

/** Run the engine verbosely for testing. Remote: POST /engine/test (admin).
 *  Offline: run the same pure engine locally and mirror the eligible-set maths. */
export async function engineTest(req: RecommendRequest, token?: string | null): Promise<EngineTestResult> {
  if (IS_REMOTE) {
    const res = await fetch(`${API_BASE}/engine/test`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(req) });
    if (!res.ok) throw new Error(res.status === 401 ? "Admin access required" : `Engine test failed (${res.status})`);
    return res.json() as Promise<EngineTestResult>;
  }
  const [allInv, cfg] = await Promise.all([getInventory(), getConfig()]);
  const inventory = allInv.filter((i) => i.category === req.category && i.storeId === req.storeId);
  const result = recommend(req, inventory, cfg);
  const band = cfg.priceBands[req.category]?.[req.budgetBand];
  const maxPrice = band ? (req.stretch ? band[1] * (1 + cfg.stretchThreshold) : band[1]) : Infinity;
  const recommendable = cfg.transform.recommendableChannels;
  const excluded = new Set(cfg.brandExclusions[req.category] ?? []);
  const cards = [result.good, result.better, result.best, result.stretch]
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ tier: c.tier, sku: c.sku, brand: c.brand, price: c.price, _score: c._score }));
  const eligibleCount = inventory.filter(
    (it) => recommendable.includes(it.channel) && it.stockQty > 0 && !excluded.has(it.brand) &&
      (!band || (it.price >= band[0] && it.price <= maxPrice)),
  ).length;
  return { result, meta: result.meta, eligibleCount, scores: cards, boostsApplied: 0 };
}

// ---- latest offers (Phase C) ----
export interface Offer {
  offer_id: string; title: string; description?: string | null;
  brand?: string | null; category?: string | null; sku?: string | null;
  store_id?: string | null; discount_pct?: number | null; offer_price?: number | null;
  image?: string | null; starts_at: string; ends_at: string; boost_weight: number; active: number;
}

/** Live offers for the app startup page. Remote: GET /offers. Offline: bundled sample. */
export async function getLiveOffers(opts?: { storeId?: string | null }): Promise<Offer[]> {
  if (IS_REMOTE) {
    const u = opts?.storeId ? `${API_BASE}/offers?storeId=${encodeURIComponent(opts.storeId)}` : `${API_BASE}/offers`;
    return getJSON<{ offers: Offer[] }>(u).then((d) => d.offers).catch(() => []);
  }
  return getJSON<{ offers: Offer[] }>(`${BASE}offers-demo.json`).then((d) => d.offers).catch(() => []);
}

// ---- customer recall by phone (D.1) ----
export interface CustomerTagInput {
  phone: string;
  name?: string | null;
  consent?: boolean;
  premium_tier?: "value" | "mainstream" | "premium" | "luxury" | null;
  preferred_payment?: "cash" | "card" | "emi" | "upi" | "exchange" | null;
  home_store_id?: string | null;
}
export interface CustomerEvent {
  type: "visit" | "intent" | "quote" | "recommendation" | "whatsapp" | "call" | "exchange_enquiry" | "purchase" | "service";
  category?: string | null; brand?: string | null; budget_band?: string | null; sku?: string | null;
  store_id?: string | null; employee_id?: string | null; session_id?: string | null; amount?: number | null; ts?: string;
}
export interface CustomerInfo {
  customer: { customer_id: string; phone: string; name?: string | null; premium_tier?: string | null; preferred_payment?: string | null; home_store_id?: string | null; last_seen_at?: string | null };
  prefs: { brand: string; category?: string | null; affinity: string }[];
  recentEvents: { type: string; category?: string | null; brand?: string | null; budget_band?: string | null; sku?: string | null; ts: string }[];
  purchases: { total?: number | null; ts?: string | null }[];
}

const CUST_KEY = "liqo.customers";
function readLocalCustomers(): Record<string, CustomerInfo> {
  try { return JSON.parse(localStorage.getItem(CUST_KEY) ?? "{}"); } catch { return {}; }
}
function writeLocalCustomers(m: Record<string, CustomerInfo>): void {
  try { localStorage.setItem(CUST_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

/** Recall a customer by phone. Remote: GET /customers/:phone. Offline: localStorage. */
export async function recallCustomer(phone: string, token?: string | null): Promise<CustomerInfo | null> {
  if (!/^\d{10}$/.test(phone)) return null;
  if (IS_REMOTE) {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(phone)}`, { headers: authHeaders(token) }).catch(() => null);
    if (!res || !res.ok) return null;
    const d = (await res.json().catch(() => null)) as CustomerInfo | { customer: null } | null;
    return d && (d as CustomerInfo).customer ? (d as CustomerInfo) : null;
  }
  const local = readLocalCustomers()[phone];
  if (local) return local;
  // Offline demo: a couple of known numbers so recall works out of the box.
  return getJSON<{ customers: Record<string, CustomerInfo> }>(`${BASE}customers-demo.json`)
    .then((d) => d.customers[phone] ?? null)
    .catch(() => null);
}

/** Upsert a customer (consent-gated tagging). Remote: POST /customers. Offline: localStorage. */
export async function upsertCustomer(rec: CustomerTagInput, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/customers`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(rec) }).catch(() => {});
    return;
  }
  const m = readLocalCustomers();
  const now = new Date().toISOString();
  const ex = m[rec.phone];
  m[rec.phone] = {
    customer: { customer_id: `c-${rec.phone}`, phone: rec.phone, name: rec.name ?? ex?.customer.name ?? null,
      premium_tier: rec.premium_tier ?? ex?.customer.premium_tier ?? null,
      preferred_payment: rec.preferred_payment ?? ex?.customer.preferred_payment ?? null,
      home_store_id: rec.home_store_id ?? ex?.customer.home_store_id ?? null, last_seen_at: now },
    prefs: ex?.prefs ?? [], recentEvents: ex?.recentEvents ?? [], purchases: ex?.purchases ?? [],
  };
  writeLocalCustomers(m);
}

/** Log a customer touchpoint. Remote: POST /customers/:phone/events. Offline: localStorage. */
export async function logCustomerEvent(phone: string, ev: CustomerEvent, token?: string | null): Promise<void> {
  if (!/^\d{10}$/.test(phone)) return;
  const withTs = { ...ev, ts: ev.ts ?? new Date().toISOString() };
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/customers/${encodeURIComponent(phone)}/events`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(withTs) }).catch(() => {});
    return;
  }
  const m = readLocalCustomers();
  if (!m[phone]) await upsertCustomer({ phone });
  const cur = readLocalCustomers();
  cur[phone].recentEvents = [{ type: ev.type, category: ev.category ?? null, brand: ev.brand ?? null, budget_band: ev.budget_band ?? null, sku: ev.sku ?? null, ts: withTs.ts }, ...(cur[phone].recentEvents ?? [])].slice(0, 20);
  cur[phone].customer.last_seen_at = withTs.ts;
  if (ev.brand && !cur[phone].prefs.some((p) => p.brand === ev.brand)) cur[phone].prefs.push({ brand: ev.brand, category: ev.category ?? null, affinity: "likes" });
  writeLocalCustomers(cur);
}

// ===========================================================================
// Admin frontend — People (employees, attendance, leaves), Incentives,
// Feedback and Offers management.
//
// Row types mirror the DAO row shapes verbatim (snake_case): the API maps D1
// rows to JSON as-is. Every read has a graceful OFFLINE path (bundled JSON or
// localStorage) so the demo renders without a Worker; writes persist to
// localStorage offline. None of these ever throw in offline mode.
// ===========================================================================

/** Local-only helpers for the offline demo (HR rows kept in localStorage). */
function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ---- employees (People · Employees tab) ----
export interface Employee {
  employee_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  store_id?: string | null;
  title?: string | null;
  status: "active" | "inactive";
  joined_at?: string | null;
  created_at?: string;
  updated_at?: string | null;
}
export interface EmployeeInput {
  employee_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: Role;
  store_id?: string | null;
  title?: string | null;
  status?: "active" | "inactive";
}

const EMP_KEY = "liqo.employees";

/** Offline employee roster: localStorage overlay on top of the bundled demo. */
async function localEmployees(): Promise<Employee[]> {
  const seed = await getJSON<{ employees: Employee[] }>(`${BASE}employees-demo.json`).then((d) => d.employees).catch(() => []);
  const overlay = readLocal<Record<string, Employee>>(EMP_KEY, {});
  const byId = new Map<string, Employee>(seed.map((e) => [e.employee_id, e]));
  for (const e of Object.values(overlay)) byId.set(e.employee_id, e);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listEmployees(opts?: { storeId?: string | null; role?: Role | null }, token?: string | null): Promise<Employee[]> {
  let rows: Employee[];
  if (IS_REMOTE) {
    const qs = new URLSearchParams();
    if (opts?.storeId) qs.set("storeId", opts.storeId);
    if (opts?.role) qs.set("role", opts.role);
    const u = `${API_BASE}/employees${qs.toString() ? `?${qs}` : ""}`;
    rows = await getJSONAuth<{ employees: Employee[] }>(u, token).then((d) => d.employees).catch(() => []);
  } else {
    rows = await localEmployees();
    if (opts?.storeId) rows = rows.filter((e) => e.store_id === opts.storeId);
    if (opts?.role) rows = rows.filter((e) => e.role === opts.role);
  }
  return rows;
}

/** Create/update an employee. Remote: POST /employees. Offline: localStorage. */
export async function saveEmployee(rec: EmployeeInput, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/employees`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(rec) }).catch(() => {});
    return;
  }
  const m = readLocal<Record<string, Employee>>(EMP_KEY, {});
  const prev = m[rec.employee_id];
  m[rec.employee_id] = {
    employee_id: rec.employee_id,
    name: rec.name,
    email: rec.email ?? prev?.email ?? null,
    phone: rec.phone ?? prev?.phone ?? null,
    role: rec.role,
    store_id: rec.store_id ?? prev?.store_id ?? null,
    title: rec.title ?? prev?.title ?? null,
    status: rec.status ?? prev?.status ?? "active",
    joined_at: prev?.joined_at ?? new Date().toISOString().slice(0, 10),
    created_at: prev?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  writeLocal(EMP_KEY, m);
}

/** Activate/deactivate. Remote: PATCH /employees/:id. Offline: localStorage. */
export async function setEmployeeStatus(employeeId: string, status: "active" | "inactive", token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/employees/${encodeURIComponent(employeeId)}`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ status }) }).catch(() => {});
    return;
  }
  const seed = await getJSON<{ employees: Employee[] }>(`${BASE}employees-demo.json`).then((d) => d.employees).catch(() => []);
  const m = readLocal<Record<string, Employee>>(EMP_KEY, {});
  const base = m[employeeId] ?? seed.find((e) => e.employee_id === employeeId);
  if (base) { m[employeeId] = { ...base, status, updated_at: new Date().toISOString() }; writeLocal(EMP_KEY, m); }
}

// ---- attendance (People · Attendance tab) ----
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "week_off" | "holiday";
export interface Attendance {
  id?: number;
  employee_id: string;
  store_id?: string | null;
  date: string;
  status: AttendanceStatus;
  check_in?: string | null;
  check_out?: string | null;
  note?: string | null;
  marked_by?: string | null;
  created_at?: string;
}
export interface AttendanceSummary { present: number; absent: number; half_day: number; leave: number; total: number }
export interface AttendanceInput {
  employee_id: string;
  store_id?: string | null;
  date: string;
  status: AttendanceStatus;
  note?: string | null;
  marked_by?: string | null;
}

const ATT_KEY = "liqo.attendance";
const attKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

export async function listAttendance(opts: { storeId?: string | null; date?: string | null }, token?: string | null): Promise<Attendance[]> {
  if (IS_REMOTE) {
    const qs = new URLSearchParams();
    if (opts.storeId) qs.set("storeId", opts.storeId);
    if (opts.date) qs.set("date", opts.date);
    const u = `${API_BASE}/attendance${qs.toString() ? `?${qs}` : ""}`;
    return getJSONAuth<{ attendance: Attendance[] }>(u, token).then((d) => d.attendance).catch(() => []);
  }
  const m = readLocal<Record<string, Attendance>>(ATT_KEY, {});
  return Object.values(m).filter((a) => (!opts.storeId || a.store_id === opts.storeId) && (!opts.date || a.date === opts.date));
}

export async function getAttendanceSummary(opts: { storeId: string; date: string }, token?: string | null): Promise<AttendanceSummary> {
  const empty: AttendanceSummary = { present: 0, absent: 0, half_day: 0, leave: 0, total: 0 };
  if (IS_REMOTE) {
    const u = `${API_BASE}/attendance/summary?storeId=${encodeURIComponent(opts.storeId)}&date=${encodeURIComponent(opts.date)}`;
    return getJSONAuth<AttendanceSummary>(u, token).catch(() => empty);
  }
  const rows = await listAttendance(opts);
  const sum = { ...empty, total: rows.length };
  for (const a of rows) {
    if (a.status === "present") sum.present++;
    else if (a.status === "absent") sum.absent++;
    else if (a.status === "half_day") sum.half_day++;
    else if (a.status === "leave") sum.leave++;
  }
  return sum;
}

/** Mark one day's attendance. Remote: POST /attendance. Offline: localStorage. */
export async function markAttendance(rec: AttendanceInput, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/attendance`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(rec) }).catch(() => {});
    return;
  }
  const m = readLocal<Record<string, Attendance>>(ATT_KEY, {});
  m[attKey(rec.employee_id, rec.date)] = { ...rec, created_at: new Date().toISOString() };
  writeLocal(ATT_KEY, m);
}

// ---- leaves (People · Leaves tab) ----
export type LeaveType = "casual" | "sick" | "earned" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export interface Leave {
  id: number;
  employee_id: string;
  type: LeaveType;
  from_date: string;
  to_date: string;
  days: number;
  reason?: string | null;
  status: LeaveStatus;
  approver_id?: string | null;
  decided_at?: string | null;
  created_at?: string;
}
export interface LeaveInput {
  employee_id: string;
  type: LeaveType;
  from_date: string;
  to_date: string;
  days?: number;
  reason?: string | null;
}

const LEAVE_KEY = "liqo.leaves";

export async function listLeaves(opts?: { employeeId?: string | null; status?: LeaveStatus | null; storeId?: string | null }, token?: string | null): Promise<Leave[]> {
  if (IS_REMOTE) {
    const qs = new URLSearchParams();
    if (opts?.employeeId) qs.set("employeeId", opts.employeeId);
    if (opts?.status) qs.set("status", opts.status);
    if (opts?.storeId) qs.set("storeId", opts.storeId);
    const u = `${API_BASE}/leaves${qs.toString() ? `?${qs}` : ""}`;
    return getJSONAuth<{ leaves: Leave[] }>(u, token).then((d) => d.leaves).catch(() => []);
  }
  let rows = readLocal<Leave[]>(LEAVE_KEY, []);
  if (opts?.employeeId) rows = rows.filter((l) => l.employee_id === opts.employeeId);
  if (opts?.status) rows = rows.filter((l) => l.status === opts.status);
  return rows.sort((a, b) => b.from_date.localeCompare(a.from_date));
}

/** Apply for leave. Remote: POST /leaves. Offline: localStorage. */
export async function createLeave(rec: LeaveInput, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/leaves`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(rec) }).catch(() => {});
    return;
  }
  const rows = readLocal<Leave[]>(LEAVE_KEY, []);
  const days = rec.days ?? leaveDays(rec.from_date, rec.to_date);
  rows.push({ id: Date.now(), employee_id: rec.employee_id, type: rec.type, from_date: rec.from_date, to_date: rec.to_date, days, reason: rec.reason ?? null, status: "pending", created_at: new Date().toISOString() });
  writeLocal(LEAVE_KEY, rows);
}

/** Approve/reject a leave. Remote: PATCH /leaves/:id. Offline: localStorage. */
export async function decideLeave(id: number, status: "approved" | "rejected" | "cancelled", approverId: string, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/leaves/${id}`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ status, approverId }) }).catch(() => {});
    return;
  }
  const rows = readLocal<Leave[]>(LEAVE_KEY, []);
  const i = rows.findIndex((l) => l.id === id);
  if (i >= 0) { rows[i] = { ...rows[i], status, approver_id: approverId, decided_at: new Date().toISOString() }; writeLocal(LEAVE_KEY, rows); }
}

/** Inclusive whole-day span between two YYYY-MM-DD dates (>=1). */
export function leaveDays(from: string, to: string): number {
  const a = Date.parse(from), b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.round((b - a) / 86400000) + 1;
}

// ---- milestones + incentives (Incentives screen) ----
export type MilestoneMetric = "items_per_bill" | "bills" | "reco_rate" | "revenue" | "points";
export interface Milestone {
  milestone_id: string;
  name: string;
  metric: MilestoneMetric;
  threshold: number;
  period: "weekly" | "monthly" | "once";
  reward_inr: number;
  active: number;
  created_at?: string;
}
export type IncentiveStatus = "pending" | "credited" | "settled" | "void";
export interface Incentive {
  id: number;
  employee_id: string;
  milestone_id?: string | null;
  period: string;
  points: number;
  amount_inr: number;
  reason?: string | null;
  status: IncentiveStatus;
  created_at?: string;
  settled_at?: string | null;
}
export interface IncentiveInput {
  employee_id: string;
  milestone_id?: string | null;
  period: string;
  points?: number;
  amount_inr?: number;
  reason?: string | null;
  status?: IncentiveStatus;
}

const INC_KEY = "liqo.incentives";

export async function listMilestones(token?: string | null): Promise<Milestone[]> {
  if (IS_REMOTE) {
    return getJSONAuth<{ milestones: Milestone[] }>(`${API_BASE}/milestones`, token).then((d) => d.milestones).catch(() => []);
  }
  return getJSON<{ milestones: Milestone[] }>(`${BASE}milestones-demo.json`).then((d) => d.milestones).catch(() => []);
}

export async function listIncentives(opts?: { employeeId?: string | null; period?: string | null }, token?: string | null): Promise<Incentive[]> {
  if (IS_REMOTE) {
    const qs = new URLSearchParams();
    if (opts?.employeeId) qs.set("employeeId", opts.employeeId);
    if (opts?.period) qs.set("period", opts.period);
    const u = `${API_BASE}/incentives${qs.toString() ? `?${qs}` : ""}`;
    return getJSONAuth<{ incentives: Incentive[] }>(u, token).then((d) => d.incentives).catch(() => []);
  }
  let rows = readLocal<Incentive[]>(INC_KEY, []);
  if (opts?.employeeId) rows = rows.filter((r) => r.employee_id === opts.employeeId);
  if (opts?.period) rows = rows.filter((r) => r.period === opts.period);
  return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

export async function addIncentive(rec: IncentiveInput, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/incentives`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(rec) }).catch(() => {});
    return;
  }
  const rows = readLocal<Incentive[]>(INC_KEY, []);
  rows.push({ id: Date.now(), employee_id: rec.employee_id, milestone_id: rec.milestone_id ?? null, period: rec.period, points: rec.points ?? 0, amount_inr: rec.amount_inr ?? 0, reason: rec.reason ?? null, status: rec.status ?? "credited", created_at: new Date().toISOString() });
  writeLocal(INC_KEY, rows);
}

// ---- feedback (Feedback screen) ----
export type FeedbackCategory = "store" | "management" | "product" | "customer" | "process" | "other";
export interface Feedback {
  id: number;
  employee_id?: string | null;
  store_id?: string | null;
  category: FeedbackCategory;
  rating?: number | null;
  message?: string | null;
  anonymous: number;
  status: "open" | "reviewed" | "actioned" | "closed";
  created_at?: string;
}
export interface FeedbackInput {
  employee_id?: string | null;
  store_id?: string | null;
  category: FeedbackCategory;
  rating?: number | null;
  message?: string | null;
  anonymous?: boolean;
}

const FB_KEY = "liqo.feedback";

/** Recent feedback (admin/manager). Remote: GET /feedback. Offline: localStorage. */
export async function listFeedback(opts?: { storeId?: string | null }, token?: string | null): Promise<Feedback[]> {
  if (IS_REMOTE) {
    const u = opts?.storeId ? `${API_BASE}/feedback?storeId=${encodeURIComponent(opts.storeId)}` : `${API_BASE}/feedback`;
    return getJSONAuth<{ feedback: Feedback[] }>(u, token).then((d) => d.feedback).catch(() => []);
  }
  let rows = readLocal<Feedback[]>(FB_KEY, []);
  if (opts?.storeId) rows = rows.filter((f) => f.store_id === opts.storeId);
  return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

/** Submit feedback (anonymous allowed; PUBLIC). Remote: POST /feedback. Offline: localStorage. */
export async function submitFeedback(rec: FeedbackInput, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/feedback`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(rec) }).catch(() => {});
    return;
  }
  const rows = readLocal<Feedback[]>(FB_KEY, []);
  rows.push({ id: Date.now(), employee_id: rec.anonymous ? null : rec.employee_id ?? null, store_id: rec.store_id ?? null, category: rec.category, rating: rec.rating ?? null, message: rec.message ?? null, anonymous: rec.anonymous ? 1 : 0, status: "open", created_at: new Date().toISOString() });
  writeLocal(FB_KEY, rows);
}

// ---- offers management (Offers screen — admin) ----
export interface OfferInput {
  offer_id?: string;
  title: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  sku?: string | null;
  store_id?: string | null;
  discount_pct?: number | null;
  offer_price?: number | null;
  image?: string | null;
  starts_at: string;
  ends_at: string;
  boost_weight?: number;
  active?: boolean;
  created_by?: string | null;
}

const OFFERS_KEY = "liqo.offers";

/** All offers (admin manager view). Remote: GET /offers/all. Offline: bundled + localStorage. */
export async function listAllOffers(token?: string | null): Promise<Offer[]> {
  if (IS_REMOTE) {
    return getJSONAuth<{ offers: Offer[] }>(`${API_BASE}/offers/all`, token).then((d) => d.offers).catch(() => []);
  }
  const seed = await getJSON<{ offers: Offer[] }>(`${BASE}offers-demo.json`).then((d) => d.offers).catch(() => []);
  const overlay = readLocal<Offer[]>(OFFERS_KEY, []);
  const removed = readLocal<string[]>(`${OFFERS_KEY}.removed`, []);
  const byId = new Map<string, Offer>(seed.filter((o) => !removed.includes(o.offer_id)).map((o) => [o.offer_id, o]));
  for (const o of overlay) byId.set(o.offer_id, o);
  return [...byId.values()].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}

/** Create an offer. Remote: POST /offers. Offline: localStorage. */
export async function createOffer(rec: OfferInput, token?: string | null): Promise<void> {
  const offerId = rec.offer_id ?? `off-${Math.random().toString(36).slice(2, 10)}`;
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/offers`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ ...rec, offer_id: offerId }) }).catch(() => {});
    return;
  }
  const overlay = readLocal<Offer[]>(OFFERS_KEY, []);
  overlay.push({
    offer_id: offerId, title: rec.title, description: rec.description ?? null,
    brand: rec.brand ?? null, category: rec.category ?? null, sku: rec.sku ?? null,
    store_id: rec.store_id ?? null, discount_pct: rec.discount_pct ?? null, offer_price: rec.offer_price ?? null,
    image: rec.image ?? null, starts_at: rec.starts_at, ends_at: rec.ends_at,
    boost_weight: rec.boost_weight ?? 0, active: rec.active === false ? 0 : 1,
  });
  writeLocal(OFFERS_KEY, overlay);
}

/** Delete an offer. Remote: DELETE /offers/:id. Offline: localStorage. */
export async function deleteOffer(offerId: string, token?: string | null): Promise<void> {
  if (IS_REMOTE) {
    await fetch(`${API_BASE}/offers/${encodeURIComponent(offerId)}`, { method: "DELETE", headers: authHeaders(token) }).catch(() => {});
    return;
  }
  const overlay = readLocal<Offer[]>(OFFERS_KEY, []).filter((o) => o.offer_id !== offerId);
  writeLocal(OFFERS_KEY, overlay);
  const removed = readLocal<string[]>(`${OFFERS_KEY}.removed`, []);
  if (!removed.includes(offerId)) { removed.push(offerId); writeLocal(`${OFFERS_KEY}.removed`, removed); }
}

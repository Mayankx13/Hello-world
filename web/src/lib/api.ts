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
import { recommend, transformInventory, mergeLeaderboard } from "@engine";
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

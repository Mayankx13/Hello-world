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
import { recommend, transformInventory } from "@engine";
import type {
  EngineConfig,
  InventoryItem,
  RawInventoryRow,
  RecommendRequest,
  RecommendResult,
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

// ---- bundled app-shell data (served from /public, cached by the SW) ----
let _config: Promise<EngineConfig> | null = null;
let _questionnaire: Promise<Questionnaire> | null = null;
let _stores: Promise<Store[]> | null = null;
let _inventory: Promise<InventoryItem[]> | null = null;

export function getConfig(): Promise<EngineConfig> {
  return (_config ??= getJSON<EngineConfig>(`${BASE}config.json`));
}

export function getQuestionnaire(): Promise<Questionnaire> {
  return (_questionnaire ??= getJSON<Questionnaire>(`${BASE}questionnaire.json`));
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

/** POST /session — best-effort; never blocks the UI. */
export async function logSession(s: SessionLog): Promise<void> {
  try {
    if (IS_REMOTE) {
      await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(s),
      });
    } else {
      const key = "liqo.sessions";
      const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
      prev.push(s);
      localStorage.setItem(key, JSON.stringify(prev));
    }
  } catch {
    /* swallow — logging must never break the journey */
  }
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

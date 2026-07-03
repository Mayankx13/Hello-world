/**
 * D1 <-> InventoryItem mapping, shared by the API and Sync workers.
 * Keeps the snake_case SQL columns in one place so the two workers can't drift.
 */
import type { BandName, Category, InventoryItem } from "../engine/types";

/** D1Database is provided by @cloudflare/workers-types at build time. */
export interface D1Like {
  prepare(query: string): D1PreparedLike;
  batch(stmts: D1PreparedLike[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}
export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  first<T = unknown>(col?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface InventoryRow {
  id: string;
  sku: string;
  store: string;
  store_id: string;
  channel: string;
  category: string;
  category_label: string | null;
  brand: string;
  model: string | null;
  name: string | null;
  sub_category: string | null;
  capacity_value: number | null;
  capacity_unit: string | null;
  capacity_text: string | null;
  star_rating: number | null;
  inverter: number | null;
  smart_os: string | null;
  price: number;
  mrp: number | null;
  sku_margin: number;
  margin_pct: number;
  margin_band: string | null;
  stock_qty: number;
  ageing_slab: string | null;
  ageing_rank: number;
  band: string;
  emi_eligible: number;
  exchange_eligible: number;
  image: string | null;
  tags: string;
  last_synced_at: string;
}

// ---------------------------------------------------------------------------
// Bind-value coercion helpers — shared by the worker route handlers and the DAO
// so request payloads map to SQL bind values consistently (null-preserving).
// ---------------------------------------------------------------------------
/** undefined/null -> NULL, everything else -> string. */
export function str(v: unknown): string | null {
  return v == null ? null : String(v);
}
/** undefined/null/"" -> NULL, else Number(v). */
export function num(v: unknown): number | null {
  return v == null || v === "" ? null : Number(v);
}
/** undefined/null -> NULL, else SQLite boolean 0|1. */
export function boolNum(v: unknown): number | null {
  return v == null ? null : v ? 1 : 0;
}
/** undefined/null -> NULL, else JSON.stringify(v) for TEXT JSON columns. */
export function jstr(v: unknown): string | null {
  return v == null ? null : JSON.stringify(v);
}

export function rowToItem(r: InventoryRow): InventoryItem {
  return {
    id: r.id,
    sku: r.sku,
    store: r.store,
    storeId: r.store_id,
    channel: r.channel,
    category: r.category as Category,
    categoryLabel: r.category_label ?? "",
    brand: r.brand,
    model: r.model ?? "",
    name: r.name ?? "",
    subCategory: r.sub_category,
    capacityValue: r.capacity_value,
    capacityUnit: r.capacity_unit,
    capacityText: r.capacity_text,
    starRating: r.star_rating,
    inverter: r.inverter == null ? null : r.inverter === 1,
    smartOS: r.smart_os,
    price: r.price,
    mrp: r.mrp,
    skuMargin: r.sku_margin,
    marginPct: r.margin_pct,
    marginBand: r.margin_band,
    stockQty: r.stock_qty,
    ageingSlab: r.ageing_slab,
    ageingRank: r.ageing_rank,
    band: r.band as BandName,
    emiEligible: r.emi_eligible === 1,
    exchangeEligible: r.exchange_eligible === 1,
    image: r.image,
    tags: safeJsonArray(r.tags),
    lastSyncedAt: r.last_synced_at,
  };
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const INVENTORY_COLUMNS = [
  "id", "sku", "store", "store_id", "channel", "category", "category_label",
  "brand", "model", "name", "sub_category", "capacity_value", "capacity_unit",
  "capacity_text", "star_rating", "inverter", "smart_os", "price", "mrp",
  "sku_margin", "margin_pct", "margin_band", "stock_qty", "ageing_slab",
  "ageing_rank", "band", "emi_eligible", "exchange_eligible", "image", "tags",
  "last_synced_at",
] as const;

function itemToBindings(it: InventoryItem): unknown[] {
  return [
    it.id, it.sku, it.store, it.storeId, it.channel, it.category, it.categoryLabel,
    it.brand, it.model, it.name, it.subCategory, it.capacityValue, it.capacityUnit,
    it.capacityText, it.starRating, boolNum(it.inverter), it.smartOS, it.price, it.mrp,
    it.skuMargin, it.marginPct, it.marginBand, it.stockQty, it.ageingSlab,
    it.ageingRank, it.band, boolNum(it.emiEligible), boolNum(it.exchangeEligible),
    it.image, JSON.stringify(it.tags), it.lastSyncedAt,
  ];
}

const PLACEHOLDERS = INVENTORY_COLUMNS.map(() => "?").join(", ");
const UPSERT_SQL = `INSERT OR REPLACE INTO inventory (${INVENTORY_COLUMNS.join(", ")}) VALUES (${PLACEHOLDERS})`;

/**
 * Atomically replace the inventory snapshot.
 *
 * The DELETE and every insert run inside ONE db.batch(), which D1 executes as a
 * single transaction (all-or-nothing). If any statement fails the whole thing
 * rolls back, so the catalog can never be left empty or half-populated — unlike
 * a bare `DELETE` followed by separate insert batches.
 *
 * An empty feed is treated as "nothing to apply": we do NOT wipe the live
 * snapshot, so a transient upstream failure that yields zero rows can't take the
 * whole catalog offline.
 */
export async function replaceInventory(db: D1Like, items: InventoryItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const stmts: D1PreparedLike[] = [
    db.prepare("DELETE FROM inventory"),
    ...items.map((it) => db.prepare(UPSERT_SQL).bind(...itemToBindings(it))),
  ];
  await db.batch(stmts);
  return items.length;
}

export async function loadInventory(db: D1Like, where?: { storeId?: string; category?: string }): Promise<InventoryItem[]> {
  let sql = "SELECT * FROM inventory";
  const binds: unknown[] = [];
  const clauses: string[] = [];
  if (where?.storeId) {
    clauses.push("store_id = ?");
    binds.push(where.storeId);
  }
  if (where?.category) {
    clauses.push("category = ?");
    binds.push(where.category);
  }
  if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
  const { results } = await db.prepare(sql).bind(...binds).all<InventoryRow>();
  return results.map(rowToItem);
}

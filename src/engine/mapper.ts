/**
 * LIQO inventory transform — TypeScript port of liqo_inventory_mapper.py.
 *
 * Raw BUSY/DBMS export -> clean D1 snapshot rows. Rules preserved exactly:
 *  - unit price = ValueWithGst / Qty   (feed value is a TOTAL, not per-unit)
 *  - exclude scrap/demo/dummy, zero/missing value, implausible (< Rs2000) prices
 *  - normalise star-rating typos ("5Star", "2 Satr" -> 5, 2)
 *  - strip "(F)/(DPF)" source codes from names/models
 *  - derive tags per category (tonnage/size/litres/kg bands, star->ecoN,
 *    inverter, sub-category -> front/top/semi, sd/dd/sbs, panel/hdr, ...)
 *  - assign Good/Better/Best band from the config price bands
 *  - carry skuMargin + marginPct (now in the feed; synthesised if absent)
 *  - classify channel (retail vs B2B/QC/logistics) — only retail is recommendable
 *
 * The transform is tolerant: it accepts a raw BUSY row OR an already-shaped
 * snapshot row (e.g. the seed liqo_inventory.json), re-deriving tags/band and
 * enriching margin in both cases.
 */
import type { BandName, Category, EngineConfig, InventoryItem } from "./types";

/** Loosely-typed raw row from the BUSY ERP feed / seed JSON. */
export interface RawInventoryRow {
  sku?: string;
  itemCode?: string;
  store?: string;
  channel?: string;
  category?: string;
  category_label?: string;
  categoryLabel?: string;
  brand?: string;
  model?: string;
  name?: string;
  itemName?: string;
  subCategory?: string | null;
  capacityValue?: number | null;
  capacityUnit?: string | null;
  capacityText?: string | null;
  starRating?: number | string | null;
  star?: number | string | null;
  inverter?: boolean | string | null;
  smartOS?: string | null;
  price?: number | null;
  valueWithGst?: number | null;
  ValueWithGst?: number | null;
  qty?: number | null;
  Qty?: number | null;
  mrp?: number | null;
  marginBand?: string | null;
  skuMargin?: number | null;
  marginAmount?: number | null;
  marginPct?: number | null;
  stockQty?: number | null;
  ageingSlab?: string | null;
  image?: string | null;
  emiEligible?: boolean | null;
  exchangeEligible?: boolean | null;
  tags?: string[];
}

export function slugStore(store: string): string {
  return store.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** "5Star" / "2 Satr" / "3 star" / 4 -> 1..5 or null. */
export function normalizeStar(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw >= 1 && raw <= 5 ? Math.round(raw) : null;
  const m = String(raw).match(/[1-5]/);
  return m ? Number(m[0]) : null;
}

/** Strip BUSY source codes like "(F)", "(DPF)" from a name/model. */
export function stripSourceCodes(s: string, codes: string[]): string {
  let out = s;
  for (const c of codes) out = out.split(c).join(" ");
  out = out.replace(/\((?:F|DPF|DP|NF)\)/gi, " ");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function classifyChannel(store: string, channelRaw?: string | null): string {
  if (channelRaw) return channelRaw;
  const s = store.toLowerCase();
  if (s.includes("b2b")) return "B2B";
  if (s.includes("qc")) return "QC";
  if (s.includes("bill from") || s.includes("logistic")) return "logistics";
  return "retail";
}

function parseBool(v: boolean | string | null | undefined): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (["true", "yes", "y", "1", "inverter"].includes(s)) return true;
  if (["false", "no", "n", "0", "fixed", "fix speed"].includes(s)) return false;
  return null;
}

/** Deterministic [-1, 1] from a string (FNV-1a) — keeps synth margin stable. */
function hashUnit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Reproduces the seed's category tag buckets exactly. */
export function deriveTags(row: {
  category: Category;
  capacityValue: number | null;
  subCategory: string | null;
  starRating: number | null;
  inverter: boolean | null;
}): string[] {
  const { category, capacityValue: cap, subCategory, starRating: star, inverter } = row;
  const sub = (subCategory ?? "").toLowerCase();
  const tags: string[] = [];

  if (category === "ac") {
    if (star) tags.push(`eco${star}`);
    if (inverter) tags.push("inverter");
    if (sub.includes("window")) tags.push("window");
    if (sub.includes("hot")) tags.push("hotcold");
    if (cap != null) tags.push(cap <= 1.0 ? "t10" : cap < 1.7 ? "t15" : "t20");
  } else if (category === "tv") {
    if (cap != null) tags.push(cap <= 43 ? "s43" : cap < 65 ? "s55" : "s65");
    if (sub.includes("q")) tags.push("panel"); // QLed / Mini QLed / QD-Mini / QLED Pro
    else if (sub.includes("uhd") || sub.includes("4k")) tags.push("hdr");
    else if (sub.includes("fhd") || sub.includes("hd")) tags.push("upscale");
  } else if (category === "fridge") {
    if (star) tags.push(`eco${star}`);
    if (inverter) tags.push("inverter");
    if (cap != null) tags.push(cap <= 262 ? "c250" : cap <= 372 ? "c330" : "c400");
    if (sub.includes("single")) tags.push("sd");
    else if (sub.includes("double")) tags.push("dd");
    else if (sub.includes("side")) tags.push("sbs");
    else if (sub.includes("french") || sub.includes("multi")) tags.push("sbs");
    else if (sub.includes("mini")) tags.push("sd");
  } else if (category === "wm") {
    if (star === 5) tags.push("eco5");
    else if (star) tags.push(`eco${star}`);
    if (inverter) tags.push("inverter");
    if (cap != null) tags.push(cap <= 6.5 ? "k65" : cap <= 7.5 ? "k7" : "k8");
    if (sub.includes("semi")) tags.push("semi");
    else if (sub.includes("top")) tags.push("top");
    else if (sub.includes("washer") || sub.includes("dryer")) tags.push("wd");
    else if (sub.includes("front")) tags.push("front");
  }
  return tags;
}

export function assignBand(category: Category, price: number, cfg: EngineConfig): BandName {
  const b = cfg.priceBands[category];
  if (price <= b.good[1]) return "good";
  if (price <= b.better[1]) return "better";
  return "best";
}

function computeMargin(
  sku: string,
  category: Category,
  band: BandName,
  price: number,
  raw: RawInventoryRow,
  cfg: EngineConfig,
): { skuMargin: number; marginPct: number } {
  const feedAmount = raw.skuMargin ?? raw.marginAmount ?? null;
  const feedPct = raw.marginPct ?? null;
  if (feedAmount != null && feedAmount > 0) {
    return { skuMargin: Math.round(feedAmount), marginPct: round4(feedAmount / price) };
  }
  if (feedPct != null && feedPct > 0) {
    const amt = Math.round(price * feedPct);
    return { skuMargin: amt, marginPct: round4(feedPct) };
  }
  // Synthesise deterministically when the feed omits margin (e.g. the seed).
  const m = cfg.marginModel;
  const base = m.basePctByCategory[category] * (m.bandMultiplier[band] ?? 1);
  const pct = clamp(base * (1 + hashUnit(sku + category) * m.jitterPct), 0.02, 0.45);
  const amt = Math.round(price * pct);
  return { skuMargin: amt, marginPct: round4(amt / price) };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function deriveCategory(row: RawInventoryRow): Category | null {
  const raw = (row.category ?? "").trim().toLowerCase();
  if (["ac", "tv", "fridge", "wm"].includes(raw)) return raw as Category;
  const label = (row.category_label ?? row.categoryLabel ?? row.name ?? "").toLowerCase();
  // Match "ac"/"tv" only as whole words — a bare substring test misfires on
  // ordinary product names ("black" contains "ac", "outlet" contains "tv"…).
  if (/air.?condition/.test(label) || /\bac\b/.test(label)) return "ac";
  if (/\btv\b/.test(label) || label.includes("television")) return "tv";
  if (label.includes("refriger") || label.includes("fridge")) return "fridge";
  if (label.includes("wash")) return "wm";
  return null;
}

/** Transform one raw row -> snapshot row, or null if it must be excluded. */
export function transformRow(
  raw: RawInventoryRow,
  cfg: EngineConfig,
  now: string,
): InventoryItem | null {
  const tc = cfg.transform;
  const store = (raw.store ?? "").trim();
  const sku = (raw.sku ?? raw.itemCode ?? "").trim();
  if (!store || !sku) return null;

  const rawName = stripSourceCodes(raw.name ?? raw.itemName ?? "", tc.stripSourceCodes);
  const model = stripSourceCodes(raw.model ?? "", tc.stripSourceCodes);
  const haystack = `${rawName} ${model}`.toLowerCase();
  if (tc.excludeNameTokens.some((t) => haystack.includes(t))) return null;

  const category = deriveCategory(raw);
  if (!category) return null;

  // unit price = ValueWithGst / Qty (TOTAL -> per unit); else explicit price.
  const total = raw.valueWithGst ?? raw.ValueWithGst ?? null;
  const qty = raw.qty ?? raw.Qty ?? null;
  let price: number;
  if (total != null && qty != null && qty > 0) price = total / qty;
  else if (raw.price != null) price = raw.price;
  else return null;
  price = Math.round(price);
  if (!Number.isFinite(price) || price < tc.minPlausibleUnitPrice) return null;

  const starRating = normalizeStar(raw.starRating ?? raw.star);
  const inverter = parseBool(raw.inverter);
  const capacityValue = raw.capacityValue ?? null;

  const tags = (raw.tags && raw.tags.length
    ? raw.tags
    : deriveTags({ category, capacityValue, subCategory: raw.subCategory ?? null, starRating, inverter }));

  const band = assignBand(category, price, cfg);
  const { skuMargin, marginPct } = computeMargin(sku, category, band, price, raw, cfg);
  const channel = classifyChannel(store, raw.channel);
  const ageingSlab = raw.ageingSlab ?? null;
  const ageingRank = (ageingSlab && cfg.ageingModel.slabRank[ageingSlab]) || 1;

  return {
    id: `${sku}|${store}`,
    sku,
    store,
    storeId: slugStore(store),
    channel,
    category,
    categoryLabel: raw.category_label ?? raw.categoryLabel ?? defaultLabel(category),
    brand: (raw.brand ?? "").trim() || "Generic",
    model,
    name: rawName || `${raw.brand ?? ""} ${model}`.trim(),
    subCategory: raw.subCategory ?? null,
    capacityValue,
    capacityUnit: raw.capacityUnit ?? null,
    capacityText: raw.capacityText ?? null,
    starRating,
    inverter,
    smartOS: raw.smartOS ?? null,
    price,
    mrp: raw.mrp ?? null,
    skuMargin,
    marginPct,
    marginBand: raw.marginBand ?? null,
    stockQty: raw.stockQty ?? Number(qty ?? 0) ?? 0,
    ageingSlab,
    ageingRank,
    band,
    emiEligible: raw.emiEligible ?? price >= cfg.emi.minPriceForEmi,
    exchangeEligible: raw.exchangeEligible ?? true,
    image: raw.image ?? null,
    tags,
    lastSyncedAt: now,
  };
}

function defaultLabel(c: Category): string {
  return { ac: "Air Conditioner", tv: "LED TV", fridge: "Refrigerator", wm: "Washing Machine" }[c];
}

/**
 * Transform a full feed. Aggregates duplicate (sku, store) stock lots:
 * stock is summed, and the OLDEST ageing slab is kept (push older stock first).
 */
export function transformInventory(
  raws: RawInventoryRow[],
  cfg: EngineConfig,
  now: string,
): InventoryItem[] {
  const byKey = new Map<string, InventoryItem>();
  for (const raw of raws) {
    const item = transformRow(raw, cfg, now);
    if (!item) continue;
    const existing = byKey.get(item.id);
    if (!existing) {
      byKey.set(item.id, item);
    } else {
      existing.stockQty += item.stockQty;
      if (item.ageingRank > existing.ageingRank) {
        existing.ageingRank = item.ageingRank;
        existing.ageingSlab = item.ageingSlab;
      }
    }
  }
  return [...byKey.values()];
}

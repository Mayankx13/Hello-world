/**
 * Inventory stage — turns data/import/raw/inventory_raw.json into
 * data/import/03_inventory.sql using the REAL engine transform
 * (transformInventory + DEFAULT_CONFIG), so the loaded snapshot is byte-for-byte
 * what the Sync Worker would have written. Run via vite-node:
 *
 *   node_modules/.bin/esbuild tools/etl/inventory_sql.ts --bundle --platform=node \
 *     --format=esm --outfile=.tmp.mjs && node .tmp.mjs    (run from repo root)
 *
 * Mirrors INVENTORY_COLUMNS / itemToBindings in src/shared/d1.ts. Emits an
 * atomic snapshot replace (DELETE then chunked INSERT OR REPLACE).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformInventory, type RawInventoryRow } from "../../src/engine";
import { DEFAULT_CONFIG } from "../../src/shared/config";

// Resolve relative to the working dir (run.sh cd's to repo root) so this works
// regardless of where esbuild emits the bundle.
const outDir = resolve(process.cwd(), process.env.ETL_OUT || "data/import");

const txt = (v: unknown): string => (v == null ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");
const int = (v: unknown): string => (v == null || v === "" ? "NULL" : String(Math.round(Number(v))));
const real = (v: unknown): string => (v == null || v === "" ? "NULL" : String(Number(v)));
const bit = (v: unknown): string => (v == null ? "NULL" : v ? "1" : "0");

const COLUMNS = [
  "id", "sku", "store", "store_id", "channel", "category", "category_label",
  "brand", "model", "name", "sub_category", "capacity_value", "capacity_unit",
  "capacity_text", "star_rating", "inverter", "smart_os", "price", "mrp",
  "sku_margin", "margin_pct", "margin_band", "stock_qty", "ageing_slab",
  "ageing_rank", "band", "emi_eligible", "exchange_eligible", "image", "tags",
  "last_synced_at",
];

function valuesFor(it: ReturnType<typeof transformInventory>[number]): string {
  return [
    txt(it.id), txt(it.sku), txt(it.store), txt(it.storeId), txt(it.channel),
    txt(it.category), txt(it.categoryLabel), txt(it.brand), txt(it.model), txt(it.name),
    txt(it.subCategory), real(it.capacityValue), txt(it.capacityUnit), txt(it.capacityText),
    int(it.starRating), bit(it.inverter), txt(it.smartOS), int(it.price), int(it.mrp),
    int(it.skuMargin), real(it.marginPct), txt(it.marginBand), int(it.stockQty),
    txt(it.ageingSlab), int(it.ageingRank), txt(it.band), bit(it.emiEligible),
    bit(it.exchangeEligible), txt(it.image), txt(JSON.stringify(it.tags)), txt(it.lastSyncedAt),
  ].join(",");
}

const raws = JSON.parse(readFileSync(resolve(outDir, "raw/inventory_raw.json"), "utf8")) as RawInventoryRow[];
const now = new Date().toISOString();
const items = transformInventory(raws, DEFAULT_CONFIG, now);

const head = `INSERT OR REPLACE INTO inventory (${COLUMNS.join(",")}) VALUES`;
const lines: string[] = ["PRAGMA foreign_keys = ON;", "-- engine snapshot (AC/TV/Fridge/WM); commercial pricing — do not commit", "DELETE FROM inventory;"];
for (let i = 0; i < items.length; i += 100) {
  const chunk = items.slice(i, i + 100);
  lines.push(head + "\n" + chunk.map((it) => `(${valuesFor(it)})`).join(",\n") + ";");
}
writeFileSync(resolve(outDir, "03_inventory.sql"), lines.join("\n") + "\n");

const byCat: Record<string, number> = {};
for (const it of items) byCat[it.category] = (byCat[it.category] ?? 0) + 1;
console.log(JSON.stringify({ raw_rows: raws.length, inventory_rows: items.length, by_category: byCat }, null, 2));

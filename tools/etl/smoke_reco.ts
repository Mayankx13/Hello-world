/**
 * Recommendation smoke test on the REAL imported Liqo stock.
 * Proves the engine produces Good/Better/Best/Stretch picks against the
 * transformed inventory (data/import/raw/inventory_raw.json). Run:
 *
 *   ETL_OUT=data/import node <esbuild-bundle-of-this>
 * (tools/etl/test.sh wires the bundle up.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformInventory, recommend, type RawInventoryRow, type RecommendRequest } from "../../src/engine";
import { DEFAULT_CONFIG } from "../../src/shared/config";

const outDir = resolve(process.cwd(), process.env.ETL_OUT || "data/import");
const raws = JSON.parse(readFileSync(resolve(outDir, "raw/inventory_raw.json"), "utf8")) as RawInventoryRow[];
const items = transformInventory(raws, DEFAULT_CONFIG, new Date().toISOString());

const cases: RecommendRequest[] = [
  { storeId: "zirakpur", category: "tv", answers: ["s55", "hdr"], budgetBand: "better", stretch: true, exchange: false },
  { storeId: "zirakpur", category: "ac", answers: ["t15", "inverter", "eco5"], budgetBand: "better", stretch: false, exchange: true },
  { storeId: "panchkula", category: "fridge", answers: ["dd", "c330"], budgetBand: "good", stretch: true, exchange: false },
  { storeId: "kharar", category: "wm", answers: ["front", "k7"], budgetBand: "better", stretch: false, exchange: false },
];

const pick = (x: { brand: string; model: string; name: string; price: number } | null): string =>
  x ? `${x.brand} ${x.model || x.name} — ₹${x.price.toLocaleString("en-IN")}` : "—";

for (const c of cases) {
  const r = recommend(c, items, DEFAULT_CONFIG);
  console.log(`\n${c.storeId}/${c.category} [${c.answers.join(",")}] · eligible=${r.meta.eligibleCount}`);
  console.log("  good   :", pick(r.good));
  console.log("  better :", pick(r.better));
  console.log("  best   :", pick(r.best));
  console.log("  stretch:", pick(r.stretch));
  if (r.better) console.log("  why    :", r.better.fitLine);
}

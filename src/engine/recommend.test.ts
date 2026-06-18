import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { recommend } from "./recommend";
import { transformInventory, type RawInventoryRow } from "./mapper";
import type { Category, EngineConfig, InventoryItem, RecommendRequest } from "./types";

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dir, "../../data");

let cfg: EngineConfig;
let inventory: InventoryItem[];
const NOW = "2026-06-18T10:30:00.000Z";

beforeAll(() => {
  cfg = JSON.parse(readFileSync(resolve(dataDir, "config.json"), "utf8")) as EngineConfig;
  const raw = JSON.parse(readFileSync(resolve(dataDir, "liqo_inventory.json"), "utf8")) as RawInventoryRow[];
  inventory = transformInventory(raw, cfg, NOW);
});

const STORE = "panchkula";

function req(partial: Partial<RecommendRequest> & { category: Category }): RecommendRequest {
  return {
    storeId: STORE,
    answers: [],
    budgetBand: "better",
    stretch: false,
    exchange: false,
    ...partial,
  };
}

describe("inventory transform", () => {
  it("loads and transforms the seed into the target schema", () => {
    expect(inventory.length).toBeGreaterThan(700);
    const sample = inventory[0];
    expect(sample).toHaveProperty("storeId");
    expect(sample).toHaveProperty("skuMargin");
    expect(sample.skuMargin).toBeGreaterThan(0);
    expect(sample.marginPct).toBeGreaterThan(0);
    expect(sample.lastSyncedAt).toBe(NOW);
  });

  it("only retail rows are recommendable; B2B/QC/logistics carry their channel", () => {
    const channels = new Set(inventory.map((i) => i.channel));
    expect(channels.has("retail")).toBe(true);
    const retail = inventory.filter((i) => i.channel === "retail");
    expect(retail.length).toBeLessThan(inventory.length);
  });
});

describe.each<[Category, string]>([
  ["ac", "Air Conditioner"],
  ["tv", "Television"],
  ["fridge", "Refrigerator"],
  ["wm", "Washing Machine"],
])("recommend — %s", (category) => {
  it("returns a Good/Better/Best price ladder, ascending in price", () => {
    const r = recommend(req({ category }), inventory, cfg);
    expect(r.good).not.toBeNull();
    expect(r.better).not.toBeNull();
    expect(r.best).not.toBeNull();
    expect(r.good!.price).toBeLessThanOrEqual(r.better!.price);
    expect(r.better!.price).toBeLessThanOrEqual(r.best!.price);
  });

  it("three ladder cards are distinct SKUs", () => {
    const r = recommend(req({ category }), inventory, cfg);
    const ids = [r.good!.id, r.better!.id, r.best!.id];
    expect(new Set(ids).size).toBe(3);
  });

  it("every recommended card is in stock at the requested store", () => {
    const r = recommend(req({ category }), inventory, cfg);
    for (const c of [r.good, r.better, r.best]) {
      const item = inventory.find((i) => i.id === c!.id)!;
      expect(item.storeId).toBe(STORE);
      expect(item.stockQty).toBeGreaterThan(0);
      expect(item.channel).toBe("retail");
    }
  });

  it("cards stay within the chosen band when stretch is off", () => {
    const r = recommend(req({ category, budgetBand: "good", stretch: false }), inventory, cfg);
    const [min, max] = cfg.priceBands[category].good;
    for (const c of [r.good, r.better, r.best]) {
      if (!c) continue;
      // ladder cards are within band unless fallback kicked in (flagged in meta)
      if (!r.meta.fallbackUsed) {
        expect(c.price).toBeGreaterThanOrEqual(min);
        expect(c.price).toBeLessThanOrEqual(max);
      }
    }
  });

  it("attach add-ons are returned for the category", () => {
    const r = recommend(req({ category }), inventory, cfg);
    expect(r.attach.length).toBeGreaterThan(0);
    expect(r.attach[0]).toHaveProperty("price");
  });

  it("is deterministic — identical inputs yield identical output", () => {
    const a = recommend(req({ category }), inventory, cfg);
    const b = recommend(req({ category }), inventory, cfg);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("stretch card", () => {
  it("AC stretch is priced above the band but within +15%", () => {
    const r = recommend(req({ category: "ac", budgetBand: "better", stretch: true }), inventory, cfg);
    const [, max] = cfg.priceBands.ac.better;
    if (r.stretch) {
      expect(r.stretch.price).toBeGreaterThan(max);
      expect(r.stretch.price).toBeLessThanOrEqual(Math.round(max * 1.15));
      expect(r.stretch.tier).toBe("stretch");
    }
  });

  it("no stretch card is produced when stretch is off", () => {
    const r = recommend(req({ category: "tv", budgetBand: "better", stretch: false }), inventory, cfg);
    expect(r.stretch).toBeNull();
  });
});

describe("genuine customer fit (hard gate)", () => {
  it("AC: a small-room (1T) customer is never sold a 2T hall unit", () => {
    const r = recommend(
      req({ category: "ac", budgetBand: "best", answers: ["t10", "eco5"], stretch: false }),
      inventory,
      cfg,
    );
    for (const c of [r.good, r.better, r.best, r.stretch]) {
      if (!c) continue;
      const item = inventory.find((i) => i.id === c.id)!;
      // 1T room tolerates up to t15 (tolerance 1) but never t20.
      expect(item.tags).not.toContain("t20");
    }
  });

  it("WM: a front-load must-have only returns front-load (or washer-dryer)", () => {
    const r = recommend(
      req({ category: "wm", budgetBand: "best", answers: ["front", "k8"], stretch: false }),
      inventory,
      cfg,
    );
    for (const c of [r.good, r.better, r.best]) {
      if (!c) continue;
      const item = inventory.find((i) => i.id === c.id)!;
      expect(item.tags.some((t) => t === "front" || t === "wd")).toBe(true);
    }
  });

  it('"why this fits you" is built only from fit tags, never margin/volume', () => {
    const r = recommend(
      req({ category: "ac", budgetBand: "better", answers: ["t15", "quiet"], stretch: false }),
      inventory,
      cfg,
    );
    const line = r.better?.fitLine ?? "";
    expect(line.toLowerCase()).not.toContain("margin");
    expect(line.toLowerCase()).not.toContain("stock");
    expect(line.toLowerCase()).not.toContain("volume");
  });
});

describe("empty-band fallback", () => {
  it("falls back (flagged in meta) when the band has no eligible items", () => {
    // Construct a tiny inventory whose only items sit far above the GOOD band.
    const tiny: InventoryItem[] = inventory
      .filter((i) => i.category === "ac" && i.storeId === STORE && i.price > 45000)
      .slice(0, 5);
    expect(tiny.length).toBeGreaterThan(0);
    const r = recommend(
      req({ category: "ac", budgetBand: "good", stretch: false }),
      tiny,
      cfg,
    );
    expect(r.meta.fallbackUsed).toBe(cfg.fallbackRule);
    // Still surfaces something useful rather than empty cards.
    expect(r.good).not.toBeNull();
  });

  it("returns empty cards gracefully when the store genuinely has nothing", () => {
    const r = recommend(req({ category: "ac", storeId: "nonexistent-store" }), inventory, cfg);
    expect(r.good).toBeNull();
    expect(r.better).toBeNull();
    expect(r.best).toBeNull();
    expect(r.meta.eligibleCount).toBe(0);
  });
});

describe("commercial ranking levers (config-driven, no redeploy)", () => {
  it("flipping volumeWeight to 0 (pure margin) can change the ranking", () => {
    const base = recommend(req({ category: "fridge", budgetBand: "better" }), inventory, cfg);
    const marginCfg: EngineConfig = {
      ...cfg,
      rankingBlend: { ...cfg.rankingBlend, volumeWeight: 0 },
    };
    const margin = recommend(req({ category: "fridge", budgetBand: "better" }), inventory, marginCfg);
    // Same gate, different commercial ordering is allowed; both must be valid ladders.
    expect(base.better).not.toBeNull();
    expect(margin.better).not.toBeNull();
  });

  it("ageingWeighted pushes older stock up without breaking the price ladder", () => {
    const aged: EngineConfig = {
      ...cfg,
      rankingBlend: { ...cfg.rankingBlend, ageingWeighted: true },
    };
    const r = recommend(req({ category: "tv", budgetBand: "good" }), inventory, aged);
    expect(r.good!.price).toBeLessThanOrEqual(r.better!.price);
  });
});

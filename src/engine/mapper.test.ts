import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  deriveTags,
  normalizeStar,
  stripSourceCodes,
  classifyChannel,
  assignBand,
  transformRow,
  transformInventory,
  type RawInventoryRow,
} from "./mapper";
import type { EngineConfig } from "./types";

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dir, "../../data");
let cfg: EngineConfig;
const NOW = "2026-06-18T10:30:00.000Z";

beforeAll(() => {
  cfg = JSON.parse(readFileSync(resolve(dataDir, "config.json"), "utf8")) as EngineConfig;
});

describe("star-rating normalisation", () => {
  it("fixes typos: 5Star, 2 Satr -> 5, 2", () => {
    expect(normalizeStar("5Star")).toBe(5);
    expect(normalizeStar("2 Satr")).toBe(2);
    expect(normalizeStar("3 star")).toBe(3);
    expect(normalizeStar(4)).toBe(4);
    expect(normalizeStar("NA")).toBeNull();
    expect(normalizeStar(null)).toBeNull();
  });
});

describe("source-code stripping", () => {
  it("removes (F) and (DPF) codes", () => {
    expect(stripSourceCodes("Voltas 1.5T (F)", cfg.transform.stripSourceCodes)).toBe("Voltas 1.5T");
    expect(stripSourceCodes("LG OLED (DPF) B-series", cfg.transform.stripSourceCodes)).toBe("LG OLED B-series");
  });
});

describe("channel classification", () => {
  it("classifies stores by name when channel is absent", () => {
    expect(classifyChannel("Ramgarh (B2B)")).toBe("B2B");
    expect(classifyChannel("Ramgarh (None QC)")).toBe("QC");
    expect(classifyChannel("Bill From Ship From")).toBe("logistics");
    expect(classifyChannel("Panchkula")).toBe("retail");
  });
});

describe("tag derivation reproduces the seed buckets", () => {
  it("AC tonnage / eco / inverter", () => {
    expect(deriveTags({ category: "ac", capacityValue: 1.0, subCategory: "Split AC", starRating: 3, inverter: true }))
      .toEqual(expect.arrayContaining(["t10", "eco3", "inverter"]));
    expect(deriveTags({ category: "ac", capacityValue: 1.5, subCategory: "Split AC", starRating: 5, inverter: true }))
      .toEqual(expect.arrayContaining(["t15", "eco5"]));
    expect(deriveTags({ category: "ac", capacityValue: 2.0, subCategory: "Window AC", starRating: 2, inverter: false }))
      .toEqual(expect.arrayContaining(["t20", "window"]));
  });
  it("TV size + panel/hdr/upscale", () => {
    expect(deriveTags({ category: "tv", capacityValue: 32, subCategory: "HD Ready", starRating: null, inverter: null }))
      .toEqual(expect.arrayContaining(["s43", "upscale"]));
    expect(deriveTags({ category: "tv", capacityValue: 55, subCategory: "QLed", starRating: null, inverter: null }))
      .toEqual(expect.arrayContaining(["s55", "panel"]));
    expect(deriveTags({ category: "tv", capacityValue: 65, subCategory: "4K UHD", starRating: null, inverter: null }))
      .toEqual(expect.arrayContaining(["s65", "hdr"]));
  });
  it("Fridge litres + form", () => {
    expect(deriveTags({ category: "fridge", capacityValue: 236, subCategory: "Single Door", starRating: 4, inverter: null }))
      .toEqual(expect.arrayContaining(["c250", "sd", "eco4"]));
    expect(deriveTags({ category: "fridge", capacityValue: 330, subCategory: "Double Door", starRating: 3, inverter: true }))
      .toEqual(expect.arrayContaining(["c330", "dd", "inverter"]));
    expect(deriveTags({ category: "fridge", capacityValue: 465, subCategory: "Side by Side", starRating: 2, inverter: null }))
      .toEqual(expect.arrayContaining(["c400", "sbs"]));
  });
  it("WM kg + form", () => {
    expect(deriveTags({ category: "wm", capacityValue: 6.0, subCategory: "Semi-Automatic", starRating: 5, inverter: null }))
      .toEqual(expect.arrayContaining(["k65", "semi", "eco5"]));
    expect(deriveTags({ category: "wm", capacityValue: 7.0, subCategory: "Top Loading", starRating: 5, inverter: null }))
      .toEqual(expect.arrayContaining(["k7", "top"]));
    expect(deriveTags({ category: "wm", capacityValue: 8.0, subCategory: "Front loading", starRating: 5, inverter: true }))
      .toEqual(expect.arrayContaining(["k8", "front", "inverter"]));
  });
});

describe("price + exclusion rules", () => {
  it("computes unit price from ValueWithGst / Qty (TOTAL -> per unit)", () => {
    const row: RawInventoryRow = {
      sku: "ac-x", store: "Panchkula", category: "ac", brand: "Voltas", model: "X",
      name: "Voltas 1.5T 3 Star Split AC", subCategory: "Split AC",
      capacityValue: 1.5, starRating: "3 star", inverter: "Inverter",
      valueWithGst: 90000, qty: 3, ageingSlab: "0 - 30 Days",
    };
    const item = transformRow(row, cfg, NOW)!;
    expect(item.price).toBe(30000); // 90000 / 3
    expect(item.stockQty).toBe(3);
    expect(item.starRating).toBe(3);
    expect(item.inverter).toBe(true);
  });

  it("excludes scrap/demo/dummy items", () => {
    const row: RawInventoryRow = {
      sku: "ac-scrap", store: "Panchkula", category: "ac", brand: "Voltas",
      name: "Voltas DEMO unit scrap", price: 25000,
    };
    expect(transformRow(row, cfg, NOW)).toBeNull();
  });

  it("excludes implausible (< Rs2000) unit prices", () => {
    const row: RawInventoryRow = {
      sku: "ac-cheap", store: "Panchkula", category: "ac", brand: "Voltas",
      name: "Voltas part", price: 1500,
    };
    expect(transformRow(row, cfg, NOW)).toBeNull();
  });

  it("assigns Good/Better/Best from config price bands", () => {
    expect(assignBand("ac", 25000, cfg)).toBe("good");
    expect(assignBand("ac", 33000, cfg)).toBe("better");
    expect(assignBand("ac", 50000, cfg)).toBe("best");
  });

  it("synthesises a positive margin when the feed omits it", () => {
    const row: RawInventoryRow = {
      sku: "tv-y", store: "Zirakpur", category: "tv", brand: "TCL", model: "Y",
      name: "TCL 55 QLED", subCategory: "QLed", capacityValue: 55, price: 40000,
    };
    const item = transformRow(row, cfg, NOW)!;
    expect(item.skuMargin).toBeGreaterThan(0);
    expect(item.marginPct).toBeGreaterThan(0);
    expect(item.marginPct).toBeLessThan(0.45);
  });

  it("aggregates duplicate (sku, store) lots and keeps the oldest ageing", () => {
    const rows: RawInventoryRow[] = [
      { sku: "wm-a", store: "Kharar", category: "wm", brand: "IFB", model: "A", name: "IFB 7kg Front", subCategory: "Front loading", capacityValue: 7, price: 28000, stockQty: 2, ageingSlab: "0 - 30 Days" },
      { sku: "wm-a", store: "Kharar", category: "wm", brand: "IFB", model: "A", name: "IFB 7kg Front", subCategory: "Front loading", capacityValue: 7, price: 28000, stockQty: 3, ageingSlab: "121 - 150 Days" },
    ];
    const out = transformInventory(rows, cfg, NOW);
    expect(out.length).toBe(1);
    expect(out[0].stockQty).toBe(5);
    expect(out[0].ageingSlab).toBe("121 - 150 Days");
  });
});

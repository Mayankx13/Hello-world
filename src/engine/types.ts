/**
 * LIQO recommendation engine — shared types (framework-free).
 *
 * These types are the contract between the API Worker, the Sync Worker and the
 * pure engine in `recommend.ts`. Nothing here imports a runtime; everything is
 * plain data so the engine stays deterministic and unit-testable.
 */

export type Category = "ac" | "tv" | "fridge" | "wm";
export type BandName = "good" | "better" | "best";
export type MarginBasis = "amount" | "percent";
export type FallbackRule = "nearestPrice" | "adjacentBand" | "relaxFit";

/** A single inventory row as stored in D1 (post-transform snapshot). */
export interface InventoryItem {
  id: string;                 // stable key: `${sku}|${store}`
  sku: string;
  store: string;
  storeId: string;
  channel: string;            // retail | B2B | QC | logistics
  category: Category;
  categoryLabel: string;
  brand: string;
  model: string;
  name: string;
  subCategory: string | null;
  capacityValue: number | null;
  capacityUnit: string | null;
  capacityText: string | null;
  starRating: number | null;
  inverter: boolean | null;
  smartOS: string | null;
  price: number;              // unit price (Rs), GST-inclusive
  mrp: number | null;
  skuMargin: number;          // unit margin in Rs
  marginPct: number;          // unit margin as fraction of price (0..1)
  marginBand: string | null;
  stockQty: number;
  ageingSlab: string | null;
  ageingRank: number;         // 1 (newest) .. 6 (oldest)
  band: BandName;
  emiEligible: boolean;
  exchangeEligible: boolean;
  image: string | null;
  tags: string[];
  lastSyncedAt: string;       // ISO timestamp
}

/** Per-category [min,max) price band tuple. */
export type PriceBandTuple = [number, number];
export interface CategoryBands {
  good: PriceBandTuple;
  better: PriceBandTuple;
  best: PriceBandTuple;
}

export interface RankingBlend {
  /** alpha 0..1 — weight on available units (volume) vs margin. */
  volumeWeight: number;
  /** "amount" = unit margin in Rs; "percent" = margin %. */
  marginBasis: MarginBasis;
  /** 0..1 — optional weight letting fit tilt ranking (0 = commercials only). */
  fitWeight: number;
  /** weight volume by stock age (push older stock first). */
  ageingWeighted: boolean;
}

export interface AttachItem {
  id: string;
  name: string;
  sub: string;
  price: number;
  target?: number;
  crossCategory?: boolean;
}

export interface EngineConfig {
  version: string;
  updatedAt: string;
  categories: Category[];
  priceBands: Record<Category, CategoryBands>;
  anchorBand: Record<Category, BandName>;
  brandPreference: Record<Category, string[]>;
  brandExclusions: Record<Category, string[]>;
  brandPreferenceWeight: number;
  stretchThreshold: number;        // e.g. 0.15
  stretchEnabledDefault: boolean;
  fallbackRule: FallbackRule;
  rankingBlend: RankingBlend;
  ageingModel: { slope: number; slabRank: Record<string, number> };
  fit: Record<Category, FitConfig>;
  marginModel: MarginModel;
  transform: TransformConfig;
  emi: { months: number; minPriceForEmi: number; noCost: boolean };
  attach: Record<Category, AttachItem[]>;
}

export interface FitConfig {
  capacityTag: string;
  upTolerance: number;
  downTolerance: number;
  highHeatBump?: number;
  sizeUpBump?: number;
}

export interface MarginModel {
  basePctByCategory: Record<Category, number>;
  bandMultiplier: Record<BandName, number>;
  jitterPct: number;
}

export interface TransformConfig {
  minPlausibleUnitPrice: number;
  excludeNameTokens: string[];
  stripSourceCodes: string[];
  recommendableChannels: string[];
}

/** Inbound request to the pure engine (mirrors POST /recommend body). */
export interface RecommendRequest {
  storeId: string;
  category: Category;
  /** flat list of selected option tags from the questionnaire. */
  answers: string[];
  /** selected budget band tier. */
  budgetBand: BandName;
  stretch: boolean;
  exchange: boolean;
  /** optional language for the generated "why this fits you" line. */
  lang?: "en" | "hi";
}

export type Tier = "good" | "better" | "best" | "stretch";

export interface RecommendationCard {
  tier: Tier;
  id: string;
  sku: string;
  brand: string;
  model: string;
  name: string;
  price: number;
  emiPerMonth: number;
  emiMonths: number;
  band: BandName;
  /** human "why this fits you" reasons — ONLY from matched fit tags. */
  fitReasons: string[];
  fitLine: string;
  pros: string[];
  con: string;
  stockQty: number;
  inStockAsOf: string;        // HH:MM derived from lastSyncedAt
  exchangeEligible: boolean;
  emiEligible: boolean;
  /** internal: commercial score (never shown to customer; for logs/tuning). */
  _score: number;
}

export interface RecommendResult {
  good: RecommendationCard | null;
  better: RecommendationCard | null;
  best: RecommendationCard | null;
  stretch: RecommendationCard | null;
  attach: AttachItem[];
  /** diagnostics for tuning/logging (not for customer display). */
  meta: {
    eligibleCount: number;
    fallbackUsed: FallbackRule | null;
    requiredCapacityClass: number | null;
    requiredForms: string[];
    bandRange: PriceBandTuple;
    syncedAt: string | null;
  };
}

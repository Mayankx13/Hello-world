/**
 * LIQO recommendation engine — PURE · DETERMINISTIC · PARAMETERIZED.
 *
 * recommend(request, inventory, config) -> cards. No I/O, no framework, no
 * Date.now(), no ML. Two stages:
 *   1. ELIGIBILITY (hard gate): stock + price band + brand + genuine fit.
 *   2. COMMERCIAL RANKING of the eligible set, normalised per request.
 * Then ASSEMBLE a Good/Better/Best price ladder + one stretch card.
 *
 * The commercial blend ORDERS results; it is never shown or explained. The
 * "why this fits you" line is generated ONLY from matched fit tags.
 *
 * TODO(stock): real-time final stock check against POS before billing.
 * TODO(offers): live EMI / exchange valuation API (currently config-derived).
 * TODO(ml): learn rankingBlend weights from logged session outcomes.
 */
import type {
  EngineConfig,
  InventoryItem,
  PriceBandTuple,
  RecommendationCard,
  RecommendRequest,
  RecommendResult,
  Tier,
} from "./types";
import {
  brandOf,
  CAPACITY_ORDINAL,
  FORM_SATISFIES,
  FORM_TAGS,
  fitPhrase,
  isBrandTag,
} from "./tags";

interface ParsedAnswers {
  capacityClass: number | null;
  forms: string[];
  preferredBrands: string[];
  softTags: string[]; // features + eco (drive fit line & optional fitWeight)
  highheat: boolean;
  sizeup: boolean;
  big: boolean;
}

interface ScoredItem {
  item: InventoryItem;
  commercialScore: number;
  normFit: number;
  finalScore: number;
  matchedFitTags: string[];
}

/** Split the flat answer-tag list into structured gates + soft preferences. */
function parseAnswers(req: RecommendRequest): ParsedAnswers {
  const cat = req.category;
  const capMap = CAPACITY_ORDINAL[cat] ?? {};
  const formSet = new Set(FORM_TAGS[cat] ?? []);
  let capacityClass: number | null = null;
  const forms: string[] = [];
  const preferredBrands: string[] = [];
  const softTags: string[] = [];
  let highheat = false;
  let sizeup = false;
  let big = false;

  for (const tag of req.answers) {
    if (isBrandTag(tag)) {
      preferredBrands.push(brandOf(tag));
    } else if (tag in capMap) {
      capacityClass = Math.max(capacityClass ?? 0, capMap[tag]);
    } else if (formSet.has(tag)) {
      if (!forms.includes(tag)) forms.push(tag);
    } else if (tag === "highheat") {
      highheat = true;
    } else if (tag === "sizeup") {
      sizeup = true;
      softTags.push(tag);
    } else if (tag === "big") {
      big = true;
    } else if (tag) {
      // eco* and soft feature tags both drive fit; keep them.
      softTags.push(tag);
    }
  }
  if (big) capacityClass = Math.max(capacityClass ?? 0, capMap.t20 ?? 3);
  return { capacityClass, forms, preferredBrands, softTags, highheat, sizeup, big };
}

/**
 * Required capacity FLOOR (minimum suitable class). Heat/size corrections never
 * raise this floor — that would exclude the correctly-sized unit. They widen
 * the UPPER bound in fitGate instead, so a hotter room also sees a bigger
 * option without losing the right size.
 */
function requiredCapacity(parsed: ParsedAnswers): number | null {
  return parsed.capacityClass;
}

function itemCapacityClass(item: InventoryItem): number | null {
  const map = CAPACITY_ORDINAL[item.category] ?? {};
  for (const t of item.tags) if (t in map) return map[t];
  return null;
}

/** Capacity + form fit gates. Returns matched fit tags (empty array still = pass). */
function fitGate(
  item: InventoryItem,
  parsed: ParsedAnswers,
  reqCap: number | null,
  cfg: EngineConfig,
): { pass: boolean; matched: string[] } {
  const cat = item.category;
  const fitCfg = cfg.fit[cat];
  const matched: string[] = [];

  // Capacity / size gate.
  if (reqCap != null) {
    const ic = itemCapacityClass(item);
    if (ic == null) return { pass: false, matched };
    // Heat (AC) and "bigger screen" (TV) widen only the upper bound.
    const up =
      (fitCfg.upTolerance ?? 0) +
      (parsed.sizeup ? fitCfg.sizeUpBump ?? 0 : 0) +
      (parsed.highheat ? fitCfg.highHeatBump ?? 0 : 0);
    const down = fitCfg.downTolerance ?? 0;
    if (ic < reqCap - down || ic > reqCap + up) return { pass: false, matched };
    const capTag = Object.entries(CAPACITY_ORDINAL[cat]).find(([, v]) => v === ic)?.[0];
    if (capTag) matched.push(capTag);
  }

  // Form gate (hard if the customer explicitly chose one).
  if (parsed.forms.length > 0) {
    const accepted = new Set<string>();
    for (const f of parsed.forms) for (const a of FORM_SATISFIES[f] ?? [f]) accepted.add(a);
    const hit = item.tags.find((t) => accepted.has(t));
    if (!hit) return { pass: false, matched };
    matched.push(hit);
  }

  return { pass: true, matched };
}

/** Soft fit tags matched (eco + features), for the fit line and fitWeight. */
function softMatches(item: InventoryItem, parsed: ParsedAnswers): string[] {
  const want = new Set(parsed.softTags);
  return item.tags.filter((t) => want.has(t));
}

function marginValue(item: InventoryItem, basis: "amount" | "percent"): number {
  return basis === "percent" ? item.marginPct : item.skuMargin;
}

function brandRank(item: InventoryItem, parsed: ParsedAnswers, cfg: EngineConfig): number {
  // Tie-breaker: customer-preferred brand first, then CEO priority order.
  if (parsed.preferredBrands.includes(item.brand)) return -1;
  const order = cfg.brandPreference[item.category] ?? [];
  const idx = order.indexOf(item.brand);
  return idx === -1 ? order.length + 1 : idx;
}

/** Stable deterministic comparator: score desc, then brand priority, price, sku. */
function makeComparator(parsed: ParsedAnswers, cfg: EngineConfig) {
  return (a: ScoredItem, b: ScoredItem): number => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    const br = brandRank(a.item, parsed, cfg) - brandRank(b.item, parsed, cfg);
    if (br !== 0) return br;
    if (a.item.price !== b.item.price) return a.item.price - b.item.price;
    return a.item.sku < b.item.sku ? -1 : a.item.sku > b.item.sku ? 1 : 0;
  };
}

/** Commercial ranking, normalised WITHIN the candidate set (per request). */
function scoreSet(
  candidates: { item: InventoryItem; matched: string[] }[],
  parsed: ParsedAnswers,
  cfg: EngineConfig,
): ScoredItem[] {
  const blend = cfg.rankingBlend;
  const slope = cfg.ageingModel.slope;

  const weightedVol = (it: InventoryItem) =>
    blend.ageingWeighted ? it.stockQty * (1 + slope * (it.ageingRank - 1)) : it.stockQty;

  const maxVol = Math.max(1, ...candidates.map((c) => weightedVol(c.item)));
  const maxMargin = Math.max(
    1e-9,
    ...candidates.map((c) => marginValue(c.item, blend.marginBasis)),
  );

  return candidates.map(({ item, matched }) => {
    const normVolume = weightedVol(item) / maxVol;
    const normMargin = marginValue(item, blend.marginBasis) / maxMargin;
    const commercialScore = blend.volumeWeight * normVolume + (1 - blend.volumeWeight) * normMargin;

    const soft = softMatches(item, parsed);
    const matchedFitTags = dedupe([...matched, ...soft]);
    const wanted =
      (parsed.capacityClass != null ? 1 : 0) +
      (parsed.forms.length > 0 ? 1 : 0) +
      parsed.softTags.length;
    const got = matched.length + soft.length;
    const normFit = wanted > 0 ? Math.min(1, got / wanted) : 0;

    let finalScore = commercialScore;
    if (blend.fitWeight > 0) finalScore = blend.fitWeight * normFit + (1 - blend.fitWeight) * commercialScore;
    if (cfg.brandPreferenceWeight > 0 && parsed.preferredBrands.includes(item.brand)) {
      finalScore += cfg.brandPreferenceWeight;
    }
    return { item, commercialScore, normFit, finalScore, matchedFitTags };
  });
}

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Pick three across the price ladder: low / mid / high tercile, best-ranked each. */
function assembleLadder(scored: ScoredItem[], cmp: (a: ScoredItem, b: ScoredItem) => number): ScoredItem[] {
  if (scored.length === 0) return [];
  const byPrice = [...scored].sort((a, b) => a.item.price - b.item.price);
  if (byPrice.length <= 3) return byPrice; // already a ladder
  const n = byPrice.length;
  const cut1 = Math.floor(n / 3);
  const cut2 = Math.floor((2 * n) / 3);
  const tiers = [byPrice.slice(0, cut1), byPrice.slice(cut1, cut2), byPrice.slice(cut2)];
  const chosen: ScoredItem[] = [];
  const used = new Set<string>();
  for (const tier of tiers) {
    const best = [...tier].sort(cmp).find((s) => !used.has(s.item.id));
    if (best) {
      chosen.push(best);
      used.add(best.item.id);
    }
  }
  // Backfill if a tercile was empty/duplicated, keeping distinct SKUs.
  if (chosen.length < 3) {
    for (const s of [...byPrice].sort(cmp)) {
      if (chosen.length >= 3) break;
      if (!used.has(s.item.id)) {
        chosen.push(s);
        used.add(s.item.id);
      }
    }
  }
  return chosen.sort((a, b) => a.item.price - b.item.price);
}

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "—";
}

function buildFitLine(matched: string[], lang: "en" | "hi"): { reasons: string[]; line: string } {
  const reasons = dedupe(matched.map((t) => fitPhrase(t, lang)).filter((x): x is string => !!x)).slice(0, 3);
  const prefix = lang === "hi" ? "आपके लिए क्यों सही: " : "Why this fits you: ";
  const fallback = lang === "hi" ? "आपके बजट में बढ़िया ऑल-राउंड मैच" : "a strong all-round match in your budget";
  return { reasons, line: prefix + (reasons.length ? reasons.join(" · ") : fallback) };
}

function buildCard(
  s: ScoredItem,
  tier: Tier,
  cfg: EngineConfig,
  exchange: boolean,
  lang: "en" | "hi",
): RecommendationCard {
  const it = s.item;
  const emiPerMonth = Math.round(it.price / cfg.emi.months / 10) * 10;
  const { reasons, line } = buildFitLine(s.matchedFitTags, lang);
  const { pros, con } = prosCons(it, lang);
  return {
    tier,
    id: it.id,
    sku: it.sku,
    brand: it.brand,
    model: it.model,
    name: it.name,
    price: it.price,
    emiPerMonth,
    emiMonths: cfg.emi.months,
    band: it.band,
    fitReasons: reasons,
    fitLine: line,
    pros,
    con,
    stockQty: it.stockQty,
    inStockAsOf: hhmm(it.lastSyncedAt),
    exchangeEligible: exchange && it.exchangeEligible,
    emiEligible: it.emiEligible && it.price >= cfg.emi.minPriceForEmi,
    _score: round4(s.finalScore),
  };
}

/** Lightweight, honest pros/cons derived from structural attributes (not margin). */
function prosCons(it: InventoryItem, lang: "en" | "hi"): { pros: string[]; con: string } {
  const en = lang === "en";
  const pros: string[] = [];
  if (it.starRating && it.starRating >= 5) pros.push(en ? "Top energy rating — lowest running cost" : "टॉप एनर्जी रेटिंग — सबसे कम खर्च");
  else if (it.starRating && it.starRating >= 4) pros.push(en ? "Efficient for daily use" : "रोज़ाना के लिए किफ़ायती");
  if (it.inverter) pros.push(en ? "Inverter — quieter and steadier" : "इन्वर्टर — शांत और स्थिर");
  if (it.capacityText) pros.push(en ? `${it.capacityText} — sized for your need` : `${it.capacityText} — आपकी ज़रूरत के अनुसार`);
  if (it.tags.includes("panel")) pros.push(en ? "Premium QLED-grade picture" : "प्रीमियम क्यूएलईडी पिक्चर");
  if (it.tags.includes("front")) pros.push(en ? "Front-load — superior wash & water saving" : "फ्रंट-लोड — बेहतर धुलाई व पानी की बचत");
  if (it.smartOS && it.smartOS !== "NA") pros.push(en ? `${it.smartOS} smart apps built in` : `${it.smartOS} स्मार्ट ऐप्स`);
  while (pros.length < 2) pros.push(en ? "Reliable brand with wide service network" : "भरोसेमंद ब्रांड, व्यापक सर्विस नेटवर्क");

  let con = en ? "Confirm final stock & installation slot at billing" : "बिलिंग पर स्टॉक व इंस्टॉलेशन की पुष्टि करें";
  if (it.starRating && it.starRating <= 3 && (it.category === "ac")) con = en ? "Lower star — higher bills on long daily use" : "कम स्टार — लंबे उपयोग पर ज़्यादा बिल";
  else if (it.subCategory === "Semi-Automatic") con = en ? "Manual tub transfer between wash & spin" : "धुलाई व स्पिन के बीच मैनुअल बदलाव";
  else if (it.subCategory === "Single Door") con = en ? "Smaller freezer; manual defrost" : "छोटा फ्रीज़र; मैनुअल डिफ्रॉस्ट";
  return { pros: pros.slice(0, 2), con };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Main entry point. Pure: same inputs always yield the same cards.
 */
export function recommend(
  req: RecommendRequest,
  inventory: InventoryItem[],
  cfg: EngineConfig,
): RecommendResult {
  const lang = req.lang ?? "en";
  const parsed = parseAnswers(req);
  const reqCap = requiredCapacity(parsed);
  const band: PriceBandTuple = cfg.priceBands[req.category][req.budgetBand];
  const [bandMin, bandMax] = band;
  const stretchEnabled = req.stretch;
  const maxPrice = stretchEnabled ? bandMax * (1 + cfg.stretchThreshold) : bandMax;

  // ---- Stage 1: eligibility (hard gates), then capture fit matches. ----
  const recommendable = cfg.transform.recommendableChannels;
  const excluded = new Set(cfg.brandExclusions[req.category] ?? []);
  const gated: { item: InventoryItem; matched: string[] }[] = [];
  for (const it of inventory) {
    if (it.category !== req.category) continue;
    if (it.storeId !== req.storeId) continue;
    if (!recommendable.includes(it.channel)) continue;
    if (it.stockQty <= 0) continue;
    if (excluded.has(it.brand)) continue;
    if (it.price < bandMin || it.price > maxPrice) continue;
    const fit = fitGate(it, parsed, reqCap, cfg);
    if (!fit.pass) continue;
    gated.push({ item: it, matched: fit.matched });
  }

  let fallbackUsed: RecommendResult["meta"]["fallbackUsed"] = null;
  let candidates = gated;

  // ---- Fallback when the band can't fill a ladder. ----
  const inBandCount = (xs: typeof gated) =>
    xs.filter((c) => c.item.price >= bandMin && c.item.price <= bandMax).length;
  if (inBandCount(candidates) < 3) {
    candidates = applyFallback(req, inventory, parsed, reqCap, cfg, candidates, band);
    if (candidates !== gated) fallbackUsed = cfg.fallbackRule;
  }

  // ---- Stage 2: commercial ranking, normalised within candidate set. ----
  const scored = scoreSet(candidates, parsed, cfg);
  const cmp = makeComparator(parsed, cfg);
  const syncedAt = inventory.find((i) => i.category === req.category)?.lastSyncedAt ?? null;

  // ---- Stage 3: assemble ladder + stretch. ----
  const inBand = scored.filter((s) => s.item.price >= bandMin && s.item.price <= bandMax);
  // Stretch zone = just above the band, up to bandMax x (1 + stretchThreshold).
  const stretchZone = scored.filter((s) => s.item.price > bandMax && s.item.price <= maxPrice);

  // The ladder prefers in-band items. Only when the band can't fill three do we
  // reach into the fallback candidates (nearest-priced), keeping the stretch
  // zone reserved for the stretch slot.
  let ladderPool = inBand;
  if (inBand.length < 3) {
    const stretchIds = new Set(stretchZone.map((s) => s.item.id));
    ladderPool = scored.filter((s) => !stretchIds.has(s.item.id));
  }
  const ladder = assembleLadder(ladderPool, cmp);
  const usedIds = new Set(ladder.map((s) => s.item.id));

  const tiers: Tier[] = ["good", "better", "best"];
  const cards: Record<Tier, RecommendationCard | null> = {
    good: null,
    better: null,
    best: null,
    stretch: null,
  };
  ladder.forEach((s, i) => {
    if (i < 3) cards[tiers[i]] = buildCard(s, tiers[i], cfg, req.exchange, lang);
  });

  if (stretchEnabled) {
    const stretchPick = [...stretchZone].sort(cmp).find((s) => !usedIds.has(s.item.id));
    if (stretchPick) cards.stretch = buildCard(stretchPick, "stretch", cfg, req.exchange, lang);
  }

  return {
    good: cards.good,
    better: cards.better,
    best: cards.best,
    stretch: cards.stretch,
    attach: cfg.attach[req.category] ?? [],
    meta: {
      eligibleCount: gated.length,
      fallbackUsed,
      requiredCapacityClass: reqCap,
      requiredForms: parsed.forms,
      bandRange: band,
      syncedAt,
    },
  };
}

/** Fallback strategies when the chosen band is empty/thin. */
function applyFallback(
  req: RecommendRequest,
  inventory: InventoryItem[],
  parsed: ParsedAnswers,
  reqCap: number | null,
  cfg: EngineConfig,
  current: { item: InventoryItem; matched: string[] }[],
  band: PriceBandTuple,
): { item: InventoryItem; matched: string[] }[] {
  const [bandMin, bandMax] = band;
  const recommendable = cfg.transform.recommendableChannels;
  const excluded = new Set(cfg.brandExclusions[req.category] ?? []);

  const passesNonPrice = (it: InventoryItem, relaxForm: boolean, relaxCap: boolean) => {
    if (it.category !== req.category) return null;
    if (it.storeId !== req.storeId) return null;
    if (!recommendable.includes(it.channel)) return null;
    if (it.stockQty <= 0) return null;
    if (excluded.has(it.brand)) return null;
    const p2 = relaxCap ? { ...parsed, capacityClass: null } : parsed;
    const p3 = relaxForm ? { ...p2, forms: [] } : p2;
    const fit = fitGate(it, p3, relaxCap ? null : reqCap, cfg);
    return fit.pass ? fit.matched : null;
  };

  if (cfg.fallbackRule === "relaxFit") {
    // Keep band, drop form first then capacity tolerance.
    for (const [rf, rc] of [[true, false], [true, true]] as const) {
      const out: { item: InventoryItem; matched: string[] }[] = [];
      for (const it of inventory) {
        if (it.price < bandMin || it.price > bandMax) continue;
        const m = passesNonPrice(it, rf, rc);
        if (m) out.push({ item: it, matched: m });
      }
      if (out.filter((c) => c.item.price >= bandMin && c.item.price <= bandMax).length >= 3) return out;
    }
  }

  // nearestPrice (default) and adjacentBand: keep fit, widen price toward neighbours.
  const out: { item: InventoryItem; matched: string[] }[] = [...current];
  const seen = new Set(out.map((c) => c.item.id));
  const pool: { item: InventoryItem; matched: string[]; dist: number }[] = [];
  for (const it of inventory) {
    if (seen.has(it.id)) continue;
    const m = passesNonPrice(it, false, false);
    if (!m) continue;
    const dist = it.price < bandMin ? bandMin - it.price : it.price > bandMax ? it.price - bandMax : 0;
    pool.push({ item: it, matched: m, dist });
  }
  pool.sort((a, b) => a.dist - b.dist || a.item.price - b.item.price);
  for (const p of pool) {
    if (out.length >= 6) break;
    out.push({ item: p.item, matched: p.matched });
  }
  return out;
}

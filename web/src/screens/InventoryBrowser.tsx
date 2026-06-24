/**
 * InventoryBrowser — per-store retail inventory browser.
 *
 * Loads rows for one store via getInventoryList, then offers client-side
 * Category / Brand / Sub category / Ageing slab / price filters, a case-
 * insensitive search, and a sort dropdown. All derivation is memoised.
 *
 * Only depends on react + ../lib/api + ../lib/format (and inventory.css).
 */
import "./inventory.css";
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { getInventoryList } from "../lib/api";
import type { InventoryItem, Lang } from "../lib/api";
import { rupees } from "../lib/format";

export interface InventoryBrowserProps {
  storeId: string;
  storeLabel: string; // e.g. "Zirakpur, Punjab"
  lang: Lang;
}

/* ----- category options (fixed set, mapped from item.category) ----- */
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "ac", label: "Air Conditioner" },
  { value: "tv", label: "Television" },
  { value: "fridge", label: "Refrigerator" },
  { value: "wm", label: "Washing Machine" },
];

/* ----- sort options ----- */
type SortKey =
  | "value_desc"
  | "value_asc"
  | "price_desc"
  | "price_asc"
  | "ageing_old"
  | "ageing_new";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "value_desc", label: "Stock value: high→low" },
  { value: "value_asc", label: "Stock value: low→high" },
  { value: "price_desc", label: "Price: high→low" },
  { value: "price_asc", label: "Price: low→high" },
  { value: "ageing_old", label: "Ageing: oldest first" },
  { value: "ageing_new", label: "Ageing: newest first" },
];

/* ----- ageing slab → rank (older = higher). Unknown sorts last/0. ----- */
const AGEING_RANK: Record<string, number> = {
  "0 - 30 Days": 1,
  "31 - 60 Days": 2,
  "61 - 90 Days": 3,
  "91 - 120 Days": 4,
  "121 - 150 Days": 5,
  ">= 151 Days": 6,
};

/* ----- ageing slab → pill {label, className} ----- */
function ageingBadge(slab: string | null): { label: string; cls: string } {
  switch (slab) {
    case "0 - 30 Days":
      return { label: "Fresh", cls: "fresh" };
    case "31 - 60 Days":
      return { label: "31–60d", cls: "a31" };
    case "61 - 90 Days":
      return { label: "61–90d", cls: "a61" };
    case "91 - 120 Days":
      return { label: "91–120d", cls: "a91" };
    case "121 - 150 Days":
      return { label: "121–150d", cls: "a121" };
    case ">= 151 Days":
      return { label: "150d+", cls: "aged" };
    default:
      return { label: "—", cls: "none" };
  }
}

/** Abbreviate a rupee amount: ≥1cr → ₹X.XXCr, ≥1L → ₹X.XXL, else full. */
function stockValueParts(n: number): { value: string; unit: string } {
  if (n >= 10_000_000) return { value: "₹" + (n / 10_000_000).toFixed(2), unit: "Cr" };
  if (n >= 100_000) return { value: "₹" + (n / 100_000).toFixed(2), unit: "L" };
  return { value: rupees(n), unit: "" };
}

/** Unique, sorted, non-empty option values from a field. */
function uniqueSorted(rows: InventoryItem[], pick: (i: InventoryItem) => string | null): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = pick(r);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default function InventoryBrowser(props: InventoryBrowserProps): JSX.Element {
  const { storeId, storeLabel, lang } = props;

  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [category, setCategory] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [subCategory, setSubCategory] = useState<string>("all");
  const [ageing, setAgeing] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("value_desc");

  // load on mount and when store changes
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getInventoryList({ storeId })
      .then((items) => {
        if (!alive) return;
        setRows(items);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(lang === "hi" ? "इन्वेंट्री लोड नहीं हो सकी।" : "Could not load inventory.");
        setRows([]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [storeId, lang]);

  function resetFilters(): void {
    setCategory("all");
    setBrand("all");
    setSubCategory("all");
    setAgeing("all");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
  }

  // dynamic option lists derived from loaded rows
  const brandOptions = useMemo(() => uniqueSorted(rows, (i) => i.brand), [rows]);
  const subCategoryOptions = useMemo(() => uniqueSorted(rows, (i) => i.subCategory), [rows]);
  const ageingOptions = useMemo(() => {
    const present = uniqueSorted(rows, (i) => i.ageingSlab);
    // order by rank rather than alphabetical
    return present.sort((a, b) => (AGEING_RANK[a] ?? 99) - (AGEING_RANK[b] ?? 99));
  }, [rows]);

  // filtered + sorted view
  const view = useMemo(() => {
    const min = minPrice.trim() === "" ? null : Number(minPrice);
    const max = maxPrice.trim() === "" ? null : Number(maxPrice);
    const q = search.trim().toLowerCase();

    let out = rows.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (brand !== "all" && i.brand !== brand) return false;
      if (subCategory !== "all" && i.subCategory !== subCategory) return false;
      if (ageing !== "all" && i.ageingSlab !== ageing) return false;
      if (min !== null && !Number.isNaN(min) && i.price < min) return false;
      if (max !== null && !Number.isNaN(max) && i.price > max) return false;
      if (q) {
        const hay = `${i.name} ${i.brand} ${i.model} ${i.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const valueOf = (i: InventoryItem): number => i.price * i.stockQty;
    const ageOf = (i: InventoryItem): number => (i.ageingSlab ? AGEING_RANK[i.ageingSlab] ?? 0 : 0);

    out = [...out].sort((a, b) => {
      switch (sort) {
        case "value_desc":
          return valueOf(b) - valueOf(a);
        case "value_asc":
          return valueOf(a) - valueOf(b);
        case "price_desc":
          return b.price - a.price;
        case "price_asc":
          return a.price - b.price;
        case "ageing_old":
          return ageOf(b) - ageOf(a);
        case "ageing_new":
          return ageOf(a) - ageOf(b);
        default:
          return 0;
      }
    });
    return out;
  }, [rows, category, brand, subCategory, ageing, minPrice, maxPrice, search, sort]);

  const skuCount = view.length;
  const subtitle = `${storeLabel} · ${skuCount} ${skuCount === 1 ? "SKU" : "SKUs"}`;

  return (
    <div className="inv">
      <div className="inv-head">
        <div>
          <h2>Inventory Browser</h2>
          <div className="inv-sub">{subtitle}</div>
        </div>
        <div className="inv-sort">
          <label htmlFor="inv-sort-select">Sort by</label>
          <select
            id="inv-sort-select"
            className="inv-select"
            aria-label="Sort inventory"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="inv-search">
        <span className="inv-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          className="inv-input"
          type="search"
          inputMode="search"
          placeholder={lang === "hi" ? "उत्पाद, ब्रांड, मॉडल, SKU खोजें" : "Search product, brand, model, SKU"}
          aria-label="Search inventory"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="inv-body">
        {/* ---------- filters ---------- */}
        <aside className="inv-filters" aria-label="Filters">
          <div className="inv-filters-title">Filters</div>

          <div className="inv-field">
            <label htmlFor="f-category">Category</label>
            <select
              id="f-category"
              className="inv-select"
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-field">
            <label htmlFor="f-brand">Brand</label>
            <select
              id="f-brand"
              className="inv-select"
              aria-label="Filter by brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option value="all">All brands</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-field">
            <label htmlFor="f-sub">Sub category</label>
            <select
              id="f-sub"
              className="inv-select"
              aria-label="Filter by sub category"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
            >
              <option value="all">All sub categories</option>
              {subCategoryOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-field">
            <label htmlFor="f-ageing">Ageing slab</label>
            <select
              id="f-ageing"
              className="inv-select"
              aria-label="Filter by ageing slab"
              value={ageing}
              onChange={(e) => setAgeing(e.target.value)}
            >
              <option value="all">All ageing</option>
              {ageingOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-field">
            <label>Price range (₹)</label>
            <div className="inv-price-row">
              <input
                className="inv-input"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Min"
                aria-label="Minimum price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                className="inv-input"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Max"
                aria-label="Maximum price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <button type="button" className="inv-reset" aria-label="Reset all filters" onClick={resetFilters}>
            Reset filters
          </button>
        </aside>

        {/* ---------- table / states ---------- */}
        {loading ? (
          <div className="loading">{lang === "hi" ? "लोड हो रहा है…" : "Loading inventory…"}</div>
        ) : error ? (
          <div className="empty">{error}</div>
        ) : view.length === 0 ? (
          <div className="empty">
            {rows.length === 0
              ? lang === "hi"
                ? "इस स्टोर के लिए कोई इन्वेंट्री नहीं मिली।"
                : "No inventory found for this store."
              : lang === "hi"
                ? "इन फ़िल्टर से कोई मिलान नहीं। फ़िल्टर रीसेट करें।"
                : "No items match these filters. Try resetting."}
          </div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Brand</th>
                  <th scope="col">Capacity</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col" className="num">
                    Stock value
                  </th>
                  <th scope="col" className="num">
                    Stock
                  </th>
                  <th scope="col">Ageing</th>
                </tr>
              </thead>
              <tbody>
                {view.map((i) => {
                  const sv = stockValueParts(i.price * i.stockQty);
                  const age = ageingBadge(i.ageingSlab);
                  return (
                    <tr key={i.id}>
                      <td>
                        <div className="inv-prod-name" title={i.model || i.name}>
                          {i.model || i.name}
                        </div>
                        <div className="inv-prod-meta">
                          {i.categoryLabel} · {i.sku}
                        </div>
                      </td>
                      <td>{i.brand}</td>
                      <td>{i.capacityText ?? "—"}</td>
                      <td className="num inv-price">{rupees(i.price)}</td>
                      <td className="num">
                        <span className="inv-stockval">
                          {sv.value}
                          {sv.unit ? <span className="unit">{sv.unit}</span> : null}
                        </span>
                      </td>
                      <td className="num inv-stockqty">{i.stockQty}</td>
                      <td>
                        <span className={`inv-age ${age.cls}`}>{age.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

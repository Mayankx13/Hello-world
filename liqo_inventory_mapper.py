"""
LIQO inventory mapper — REFERENCE implementation.

This is the source-of-truth transform that `src/engine/mapper.ts` ports to
TypeScript for the Sync Worker. Both implementations must stay rule-for-rule
identical. Raw BUSY/DBMS export -> clean snapshot rows for D1.

Rules preserved:
  * unit price = ValueWithGst / Qty       (feed value is a TOTAL, not per-unit)
  * exclude scrap/demo/dummy, zero/missing value, implausible (< Rs2000) prices
  * normalise star-rating typos ("5Star", "2 Satr" -> 5, 2)
  * strip "(F)/(DPF)" source codes from names/models
  * derive tags per category (tonnage/size/litres/kg bands, star->ecoN,
    inverter, sub-category -> front/top/semi, sd/dd/sbs, panel/hdr, ...)
  * assign Good/Better/Best band from the config price bands
  * carry skuMargin + marginPct        (now in the feed; synthesised if absent)
  * classify channel (retail vs B2B/QC/logistics); only 'retail' is recommendable

Usage:
    python liqo_inventory_mapper.py raw_feed.json config.json > snapshot.json
"""
from __future__ import annotations
import json
import re
import sys
from typing import Any, Optional


# --------------------------------------------------------------------------- #
# Field cleaning
# --------------------------------------------------------------------------- #
def slug_store(store: str) -> str:
    return re.sub(r"-+$", "", re.sub(r"^-+", "", re.sub(r"[^a-z0-9]+", "-", store.lower())))


def normalize_star(raw: Any) -> Optional[int]:
    """'5Star' / '2 Satr' / '3 star' / 4 -> 1..5 or None."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        v = int(round(raw))
        return v if 1 <= v <= 5 else None
    m = re.search(r"[1-5]", str(raw))
    return int(m.group(0)) if m else None


def strip_source_codes(s: str, codes: list[str]) -> str:
    for c in codes:
        s = s.replace(c, " ")
    s = re.sub(r"\((?:F|DPF|DP|NF)\)", " ", s, flags=re.IGNORECASE)
    return re.sub(r"\s{2,}", " ", s).strip()


def classify_channel(store: str, channel_raw: Optional[str]) -> str:
    if channel_raw:
        return channel_raw
    s = store.lower()
    if "b2b" in s:
        return "B2B"
    if "qc" in s:
        return "QC"
    if "bill from" in s or "logistic" in s:
        return "logistics"
    return "retail"


def parse_bool(v: Any) -> Optional[bool]:
    if v is None or v == "":
        return None
    if isinstance(v, bool):
        return v
    s = str(v).lower()
    if s in ("true", "yes", "y", "1", "inverter"):
        return True
    if s in ("false", "no", "n", "0", "fixed", "fix speed"):
        return False
    return None


def hash_unit(s: str) -> float:
    """Deterministic [-1, 1] from a string (FNV-1a)."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return (h / 0xFFFFFFFF) * 2 - 1


# --------------------------------------------------------------------------- #
# Tag derivation — reproduces the seed buckets exactly
# --------------------------------------------------------------------------- #
def derive_tags(category: str, cap: Optional[float], sub: Optional[str],
                star: Optional[int], inverter: Optional[bool]) -> list[str]:
    sub = (sub or "").lower()
    tags: list[str] = []
    if category == "ac":
        if star:
            tags.append(f"eco{star}")
        if inverter:
            tags.append("inverter")
        if "window" in sub:
            tags.append("window")
        if "hot" in sub:
            tags.append("hotcold")
        if cap is not None:
            tags.append("t10" if cap <= 1.0 else "t15" if cap < 1.7 else "t20")
    elif category == "tv":
        if cap is not None:
            tags.append("s43" if cap <= 43 else "s55" if cap < 65 else "s65")
        if "q" in sub:
            tags.append("panel")
        elif "uhd" in sub or "4k" in sub:
            tags.append("hdr")
        elif "fhd" in sub or "hd" in sub:
            tags.append("upscale")
    elif category == "fridge":
        if star:
            tags.append(f"eco{star}")
        if inverter:
            tags.append("inverter")
        if cap is not None:
            tags.append("c250" if cap <= 262 else "c330" if cap <= 372 else "c400")
        if "single" in sub:
            tags.append("sd")
        elif "double" in sub:
            tags.append("dd")
        elif "side" in sub:
            tags.append("sbs")
        elif "french" in sub or "multi" in sub:
            tags.append("sbs")
        elif "mini" in sub:
            tags.append("sd")
    elif category == "wm":
        if star == 5:
            tags.append("eco5")
        elif star:
            tags.append(f"eco{star}")
        if inverter:
            tags.append("inverter")
        if cap is not None:
            tags.append("k65" if cap <= 6.5 else "k7" if cap <= 7.5 else "k8")
        if "semi" in sub:
            tags.append("semi")
        elif "top" in sub:
            tags.append("top")
        elif "washer" in sub or "dryer" in sub:
            tags.append("wd")
        elif "front" in sub:
            tags.append("front")
    return tags


def assign_band(category: str, price: int, cfg: dict) -> str:
    b = cfg["priceBands"][category]
    if price <= b["good"][1]:
        return "good"
    if price <= b["better"][1]:
        return "better"
    return "best"


def compute_margin(sku: str, category: str, band: str, price: int,
                   raw: dict, cfg: dict) -> tuple[int, float]:
    feed_amount = raw.get("skuMargin") or raw.get("marginAmount")
    feed_pct = raw.get("marginPct")
    if feed_amount and feed_amount > 0:
        return int(round(feed_amount)), round(feed_amount / price, 4)
    if feed_pct and feed_pct > 0:
        return int(round(price * feed_pct)), round(feed_pct, 4)
    m = cfg["marginModel"]
    base = m["basePctByCategory"][category] * m["bandMultiplier"].get(band, 1)
    pct = min(0.45, max(0.02, base * (1 + hash_unit(sku + category) * m["jitterPct"])))
    amt = int(round(price * pct))
    return amt, round(amt / price, 4)


CATEGORY_LABELS = {"ac": "Air Conditioner", "tv": "LED TV",
                   "fridge": "Refrigerator", "wm": "Washing Machine"}


def derive_category(raw: dict) -> Optional[str]:
    c = (raw.get("category") or "").lower()
    if c in ("ac", "tv", "fridge", "wm"):
        return c
    label = (raw.get("category_label") or raw.get("name") or "").lower()
    if "air condition" in label:
        return "ac"
    if "tv" in label or "television" in label:
        return "tv"
    if "refriger" in label or "fridge" in label:
        return "fridge"
    if "wash" in label:
        return "wm"
    return None


def transform_row(raw: dict, cfg: dict, now: str) -> Optional[dict]:
    tc = cfg["transform"]
    store = (raw.get("store") or "").strip()
    sku = (raw.get("sku") or raw.get("itemCode") or "").strip()
    if not store or not sku:
        return None

    name = strip_source_codes(raw.get("name") or raw.get("itemName") or "", tc["stripSourceCodes"])
    model = strip_source_codes(raw.get("model") or "", tc["stripSourceCodes"])
    haystack = f"{name} {model}".lower()
    if any(tok in haystack for tok in tc["excludeNameTokens"]):
        return None

    category = derive_category(raw)
    if not category:
        return None

    total = raw.get("valueWithGst") if raw.get("valueWithGst") is not None else raw.get("ValueWithGst")
    qty = raw.get("qty") if raw.get("qty") is not None else raw.get("Qty")
    if total is not None and qty:
        price = total / qty
    elif raw.get("price") is not None:
        price = raw["price"]
    else:
        return None
    price = int(round(price))
    if price < tc["minPlausibleUnitPrice"]:
        return None

    star = normalize_star(raw.get("starRating", raw.get("star")))
    inverter = parse_bool(raw.get("inverter"))
    cap = raw.get("capacityValue")

    tags = raw["tags"] if raw.get("tags") else derive_tags(category, cap, raw.get("subCategory"), star, inverter)
    band = assign_band(category, price, cfg)
    sku_margin, margin_pct = compute_margin(sku, category, band, price, raw, cfg)
    channel = classify_channel(store, raw.get("channel"))
    ageing_slab = raw.get("ageingSlab")
    ageing_rank = cfg["ageingModel"]["slabRank"].get(ageing_slab, 1) if ageing_slab else 1

    return {
        "id": f"{sku}|{store}",
        "sku": sku, "store": store, "storeId": slug_store(store), "channel": channel,
        "category": category, "categoryLabel": raw.get("category_label") or CATEGORY_LABELS[category],
        "brand": (raw.get("brand") or "").strip() or "Generic", "model": model,
        "name": name or f"{raw.get('brand', '')} {model}".strip(),
        "subCategory": raw.get("subCategory"),
        "capacityValue": cap, "capacityUnit": raw.get("capacityUnit"), "capacityText": raw.get("capacityText"),
        "starRating": star, "inverter": inverter, "smartOS": raw.get("smartOS"),
        "price": price, "mrp": raw.get("mrp"),
        "skuMargin": sku_margin, "marginPct": margin_pct, "marginBand": raw.get("marginBand"),
        "stockQty": int(raw.get("stockQty") or qty or 0),
        "ageingSlab": ageing_slab, "ageingRank": ageing_rank, "band": band,
        "emiEligible": raw.get("emiEligible") if raw.get("emiEligible") is not None else price >= cfg["emi"]["minPriceForEmi"],
        "exchangeEligible": raw.get("exchangeEligible") if raw.get("exchangeEligible") is not None else True,
        "image": raw.get("image"), "tags": tags, "lastSyncedAt": now,
    }


def transform_inventory(raws: list[dict], cfg: dict, now: str) -> list[dict]:
    """Aggregate duplicate (sku, store) lots: sum stock, keep the oldest ageing."""
    by_key: dict[str, dict] = {}
    for raw in raws:
        item = transform_row(raw, cfg, now)
        if not item:
            continue
        ex = by_key.get(item["id"])
        if not ex:
            by_key[item["id"]] = item
        else:
            ex["stockQty"] += item["stockQty"]
            if item["ageingRank"] > ex["ageingRank"]:
                ex["ageingRank"] = item["ageingRank"]
                ex["ageingSlab"] = item["ageingSlab"]
    return list(by_key.values())


if __name__ == "__main__":
    import datetime
    raw_path = sys.argv[1] if len(sys.argv) > 1 else "data/liqo_inventory.json"
    cfg_path = sys.argv[2] if len(sys.argv) > 2 else "data/config.json"
    with open(raw_path) as f:
        raws = json.load(f)
    with open(cfg_path) as f:
        cfg = json.load(f)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    out = transform_inventory(raws, cfg, now)
    sys.stderr.write(f"transformed {len(out)} rows from {len(raws)} raw\n")
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)

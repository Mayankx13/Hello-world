#!/usr/bin/env python3
"""BUSY → LIQO attribution importer.

Reads a BUSY daily sales export (xlsx/csv), finds DM-attributed bills, and
posts them to the Worker's POST /api/attribution/import (batch upsert on
bill_no). Run it daily after the BUSY export lands:

    python3 import_busy_bills.py exports/sales-2026-07-06.xlsx \
        --api-base https://<worker-url> --store "LIQO Zirakpur"

    (or set LIQO_API_BASE / LIQO_DASH_API_KEY in the environment)

Matching rules, in priority order:
  1. code  — the bill narration mentions the DM code (LIQO-DM, LIQODM,
             LIQO DM — case-insensitive). Strongest signal; the lead link is
             attached too when the bill phone matches a captured lead.
  2. phone — the bill's party/phone matches a lead phone on the last 10
             digits (Indian mobile).
Bills matching neither rule are counted but NOT posted.

DB-agnostic by design: bills come from a *source* function that yields
normalized rows. Today that is the file export reader; when the BUSY
Cloudflare Tunnel bridge ships, add a SQL source next to it — the fiscal-year
database name is a required parameter of that source (BUSY creates one
database per fiscal year, e.g. BUSY_2627; NEVER hardcode it).

Requires: pandas, requests (pip install pandas requests openpyxl).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass

import pandas as pd
import requests

MENTION_CODE_RE = re.compile(r"LIQO[\s\-_]?DM", re.IGNORECASE)
BATCH_SIZE = 200

# Header labels as they appear in BUSY exports, lowercased → canonical name.
# Matching is fuzzy (substring) because BUSY headers vary between versions.
COLUMN_HINTS = {
    "bill_no": ("bill no", "bill.no", "billno", "vch no", "voucher no", "bill"),
    "bill_date": ("date",),
    "phone": ("party/phone", "phone", "party", "mobile"),
    "narration": ("narration", "remarks", "notes"),
    "bill_amount": ("amount", "value", "total"),
    "items_count": ("item count", "items", "qty", "quantity"),
}


@dataclass
class Bill:
    bill_no: str
    bill_date: str | None
    phone: str | None       # normalized: last 10 digits
    narration: str
    bill_amount: float | None
    items_count: int | None


# --------------------------------------------------------------------------
# Source 1: BUSY file export (xlsx/csv).
# --------------------------------------------------------------------------

def load_bills_from_export(path: str) -> list[Bill]:
    """Read a BUSY sales export, tolerating decorative header rows.

    BUSY exports typically carry a company-name banner and filter echo above
    the real table (data often starts around row 8), so the header row is
    auto-detected: the first row containing a cell that says 'Bill'.
    """
    raw = (
        pd.read_csv(path, header=None, dtype=str)
        if path.lower().endswith(".csv")
        else pd.read_excel(path, header=None, dtype=str)
    )

    header_idx = None
    for i, row in raw.iterrows():
        if any("bill" in str(v).lower() for v in row.tolist() if pd.notna(v)):
            header_idx = i
            break
    if header_idx is None:
        raise SystemExit("error: could not find a header row containing 'Bill' — is this a BUSY sales export?")

    headers = [str(v).strip() if pd.notna(v) else "" for v in raw.iloc[header_idx]]
    df = raw.iloc[header_idx + 1 :].reset_index(drop=True)
    df.columns = headers

    cols = _map_columns(headers)
    missing = [c for c in ("bill_no",) if c not in cols]
    if missing:
        raise SystemExit(f"error: export is missing required column(s): {missing} (headers seen: {headers})")

    bills: list[Bill] = []
    for _, row in df.iterrows():
        bill_no = _cell(row, cols.get("bill_no"))
        if not bill_no:  # blank separator rows
            continue
        if re.fullmatch(r"(grand\s+)?total", bill_no, re.IGNORECASE):  # footer rows
            continue
        bills.append(
            Bill(
                bill_no=bill_no,
                bill_date=_parse_date(_cell(row, cols.get("bill_date"))),
                phone=normalize_phone(_cell(row, cols.get("phone"))),
                narration=_cell(row, cols.get("narration")) or "",
                bill_amount=_parse_number(_cell(row, cols.get("bill_amount"))),
                items_count=_parse_int(_cell(row, cols.get("items_count"))),
            )
        )
    return bills


# --------------------------------------------------------------------------
# Source 2 (future): direct SQL pull over the BUSY Cloudflare Tunnel bridge.
# --------------------------------------------------------------------------

def load_bills_from_sql(fiscal_year_db: str, since: str | None = None) -> list[Bill]:
    """Placeholder for the direct MS-SQL pull once the tunnel bridge ships.

    `fiscal_year_db` is the BUSY per-fiscal-year database name (e.g.
    'BUSY_2627') and MUST come from configuration — BUSY rolls a new database
    every April, so a hardcoded name silently reads stale data.
    The implementation should return the same list[Bill] shape so everything
    downstream (matching, posting, summary) is untouched.
    """
    raise NotImplementedError(
        f"SQL source not wired yet (would read {fiscal_year_db!r}"
        f"{f' since {since}' if since else ''}) — use the file export for now."
    )


# --------------------------------------------------------------------------
# Normalizers.
# --------------------------------------------------------------------------

def normalize_phone(value: str | None) -> str | None:
    """'+91 98765-43210' / 'Rohit / 9876543210' → '9876543210'."""
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits[-10:] if len(digits) >= 10 else None


def _cell(row: pd.Series, col: str | None) -> str | None:
    if col is None or col not in row.index:
        return None
    v = row[col]
    if pd.isna(v):
        return None
    s = str(v).strip()
    return s or None


def _map_columns(headers: list[str]) -> dict[str, str]:
    mapped: dict[str, str] = {}
    for canonical, hints in COLUMN_HINTS.items():
        for h in headers:
            hl = h.lower().strip()
            if hl and any(hint in hl for hint in hints):
                mapped[canonical] = h
                break
    return mapped


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    ts = pd.to_datetime(value, dayfirst=True, errors="coerce")  # BUSY uses dd-mm-yyyy
    return None if pd.isna(ts) else ts.strftime("%Y-%m-%d")


def _parse_number(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value.replace(",", "").replace("₹", "").strip())
    except ValueError:
        return None


def _parse_int(value: str | None) -> int | None:
    n = _parse_number(value)
    return None if n is None else int(n)


# --------------------------------------------------------------------------
# Matching + posting.
# --------------------------------------------------------------------------

def fetch_lead_phones(api_base: str, api_key: str) -> dict[str, int]:
    """phone(last-10) → lead id, from the Worker API."""
    r = requests.get(f"{api_base}/api/leads", headers={"X-Api-Key": api_key}, timeout=30)
    r.raise_for_status()
    phones: dict[str, int] = {}
    for lead in r.json()["leads"]:
        p = normalize_phone(lead.get("phone"))
        if p and p not in phones:  # first (newest) lead wins on shared phones
            phones[p] = lead["id"]
    return phones


def match_bills(bills: list[Bill], lead_phones: dict[str, int], store: str | None) -> tuple[list[dict], dict]:
    matches: list[dict] = []
    stats = {"scanned": len(bills), "code": 0, "phone": 0, "unmatched": 0}

    for b in bills:
        code = MENTION_CODE_RE.search(b.narration)
        lead_id = lead_phones.get(b.phone) if b.phone else None
        if code:
            method = "code"
            stats["code"] += 1
        elif lead_id is not None:
            method = "phone"
            stats["phone"] += 1
        else:
            stats["unmatched"] += 1
            continue
        matches.append(
            {
                "bill_no": b.bill_no,
                "bill_date": b.bill_date,
                "store": store,
                "phone": b.phone,
                "mention_code": code.group(0).upper() if code else None,
                "bill_amount": b.bill_amount,
                "items_count": b.items_count,
                "matched_lead_id": lead_id,
                "match_method": method,
            }
        )
    return matches, stats


def post_matches(api_base: str, api_key: str, matches: list[dict]) -> int:
    posted = 0
    for i in range(0, len(matches), BATCH_SIZE):
        batch = matches[i : i + BATCH_SIZE]
        r = requests.post(
            f"{api_base}/api/attribution/import",
            json={"rows": batch},
            headers={"X-Api-Key": api_key},
            timeout=60,
        )
        if r.status_code != 200:
            raise SystemExit(f"error: import batch failed (HTTP {r.status_code}): {r.text[:300]}")
        posted += r.json().get("upserted", len(batch))
    return posted


# --------------------------------------------------------------------------
# CLI.
# --------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description="Import DM-attributed bills from a BUSY sales export.")
    ap.add_argument("export_file", help="BUSY daily sales export (.xlsx or .csv)")
    ap.add_argument("--api-base", default=os.environ.get("LIQO_API_BASE"), help="Worker base URL (or env LIQO_API_BASE)")
    ap.add_argument("--api-key", default=os.environ.get("LIQO_DASH_API_KEY"), help="dashboard API key (or env LIQO_DASH_API_KEY)")
    ap.add_argument("--store", default=None, help="material centre this export belongs to, e.g. 'LIQO Zirakpur'")
    ap.add_argument(
        "--fy-db",
        default=None,
        help="BUSY fiscal-year database name (future SQL source only, e.g. BUSY_2627); ignored for file imports",
    )
    ap.add_argument("--dry-run", action="store_true", help="match and print the summary but POST nothing")
    args = ap.parse_args()

    if not args.api_base or not args.api_key:
        ap.error("--api-base and --api-key are required (or set LIQO_API_BASE / LIQO_DASH_API_KEY)")
    api_base = args.api_base.rstrip("/")

    bills = load_bills_from_export(args.export_file)
    lead_phones = fetch_lead_phones(api_base, args.api_key)
    matches, stats = match_bills(bills, lead_phones, args.store)

    posted = 0
    if matches and not args.dry_run:
        posted = post_matches(api_base, args.api_key, matches)

    print("── BUSY import reconciliation ────────────────────")
    print(f"  bills scanned        {stats['scanned']}")
    print(f"  code matches         {stats['code']}   (narration mentions LIQO-DM)")
    print(f"  phone matches        {stats['phone']}   (lead phone, last-10)")
    print(f"  unmatched            {stats['unmatched']}   (not posted)")
    print(f"  posted to API        {posted}{'   [dry run — nothing posted]' if args.dry_run else ''}")
    print("──────────────────────────────────────────────────")


if __name__ == "__main__":
    main()

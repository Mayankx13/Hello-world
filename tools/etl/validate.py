#!/usr/bin/env python3
"""
Validate generated import SQL against the real schema BEFORE it touches D1.

Loads schema.sql into an in-memory SQLite, applies the import files in FK order
with foreign_keys=ON, runs PRAGMA foreign_key_check, and prints row counts +
a couple of analytics-view spot checks. Non-zero exit on any FK violation.

    python3 tools/etl/validate.py --out data/import
"""
import argparse, os, sqlite3, sys

ORDER = ["01_stores.sql", "02_employees.sql", "03_inventory.sql", "04_customers.sql", "05_sales.sql"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", dest="outdir", default="data/import")
    ap.add_argument("--schema", default="schema.sql")
    args = ap.parse_args()

    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(open(args.schema).read())

    for f in ORDER:
        path = os.path.join(args.outdir, f)
        if not os.path.exists(path):
            print(f"!! missing {f}")
            continue
        try:
            con.executescript("PRAGMA foreign_keys=ON;\n" + open(path).read())
        except sqlite3.Error as e:
            print(f"!! {f}: {e}")
            sys.exit(1)

    bad = con.execute("PRAGMA foreign_key_check").fetchall()
    if bad:
        print("!! FK violations:", bad[:20])
        sys.exit(1)

    print("OK — schema + imports applied, no FK violations\n")
    print("row counts")
    for t in ("stores", "employees", "inventory", "customers", "customer_brand_prefs",
              "sales", "sale_items", "customer_events"):
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  {t:22s} {n}")

    print("\ninventory by category")
    for cat, n, lo, hi in con.execute(
        "SELECT category, COUNT(*), MIN(price), MAX(price) FROM inventory GROUP BY category ORDER BY 2 DESC"):
        print(f"  {cat:8s} {n:5d}  ₹{lo}–₹{hi}")

    print("\ninventory by store (retail)")
    for st, n in con.execute(
        "SELECT store_id, COUNT(*) FROM inventory WHERE channel='retail' GROUP BY store_id ORDER BY 2 DESC"):
        print(f"  {st:20s} {n}")

    print("\nv_store_daily (top 5 by revenue)")
    for row in con.execute("SELECT store_id, day, bills, revenue FROM v_store_daily ORDER BY revenue DESC LIMIT 5"):
        print("  ", row)

    print("\nv_customer_360 (top 5 by lifetime value)")
    for row in con.execute(
        "SELECT name, premium_tier, purchases, lifetime_value, brands FROM v_customer_360 ORDER BY lifetime_value DESC LIMIT 5"):
        print("  ", row)

    con.close()

if __name__ == "__main__":
    main()

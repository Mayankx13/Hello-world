#!/usr/bin/env python3
"""
Split the generated import SQL into Cloudflare-D1-console-pasteable chunks.

The D1 dashboard console caps how much SQL you can paste at once. This splits the
big files at statement boundaries into ~100 KB pieces, numbered so you paste them
in order. Small files (stores, employees) are copied whole.

    python3 tools/etl/chunk_for_console.py --out data/import
Output: data/import/console/<NN>_<name>_<part>.sql
"""
import argparse, os, glob

TARGET = 100_000  # bytes per chunk (safe under the console limit)
ORDER = ["01_stores", "02_employees", "03_inventory", "04_customers", "05_sales"]

def statements(sql: str):
    # Generated SQL ends every statement with ";\n"; values never contain ";\n",
    # so this is a safe split. Re-attach the ";" we split on.
    parts = sql.split(";\n")
    out = []
    for p in parts:
        s = p.strip()
        if not s or s.startswith("PRAGMA"):
            continue
        # drop standalone comment-only fragments
        body = "\n".join(l for l in s.splitlines() if not l.strip().startswith("--")).strip()
        if not body:
            continue
        out.append(body + ";")
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/import")
    args = ap.parse_args()
    cdir = os.path.join(args.out, "console")
    os.makedirs(cdir, exist_ok=True)
    for f in glob.glob(os.path.join(cdir, "*.sql")):
        os.remove(f)

    manifest = []
    for name in ORDER:
        path = os.path.join(args.out, name + ".sql")
        if not os.path.exists(path):
            continue
        stmts = statements(open(path).read())
        # pack into ~TARGET-byte chunks at statement boundaries
        chunks, cur, size = [], [], 0
        for s in stmts:
            if cur and size + len(s) > TARGET:
                chunks.append(cur); cur, size = [], 0
            cur.append(s); size += len(s) + 1
        if cur:
            chunks.append(cur)
        for i, ch in enumerate(chunks, 1):
            part = f"{name}_p{i:02d}of{len(chunks):02d}.sql" if len(chunks) > 1 else f"{name}.sql"
            header = "PRAGMA foreign_keys = ON;\n"
            open(os.path.join(cdir, part), "w").write(header + "\n".join(ch) + "\n")
            manifest.append((part, len(ch)))
    print(f"{len(manifest)} chunk file(s) in {cdir}")
    for p, n in manifest:
        print(f"  {p}  ({n} statements)")

if __name__ == "__main__":
    main()

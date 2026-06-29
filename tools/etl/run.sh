#!/usr/bin/env bash
# LIQO Excel → D1 import: parse → engine-inventory → validate.
# Output lands in data/import/ (gitignored — contains PII + dealer pricing).
#
#   tools/etl/run.sh <uploads_dir> [out_dir]
#
set -euo pipefail
cd "$(dirname "$0")/../.."

IN="${1:?usage: run.sh <uploads_dir> [out_dir]}"
OUT="${2:-data/import}"

echo "▶ parse.py"
python3 tools/etl/parse.py --in "$IN" --out "$OUT"

echo "▶ inventory_sql.ts (engine transform)"
ETL_TMP="$(mktemp -d)"
node_modules/.bin/esbuild tools/etl/inventory_sql.ts --bundle --platform=node \
  --format=esm --outfile="$ETL_TMP/inv.mjs" --log-level=warning
ETL_OUT="$OUT" node "$ETL_TMP/inv.mjs"
rm -rf "$ETL_TMP"

echo "▶ validate.py"
python3 tools/etl/validate.py --out "$OUT"

echo
echo "✓ import SQL ready in $OUT/ — load into your PRIVATE D1 (NOT committed):"
echo "    wrangler d1 execute liqo --remote --file=./$OUT/01_stores.sql --yes"
echo "    wrangler d1 execute liqo --remote --file=./$OUT/02_employees.sql --yes"
echo "    wrangler d1 execute liqo --remote --file=./$OUT/03_inventory.sql --yes"
echo "    wrangler d1 execute liqo --remote --file=./$OUT/04_customers.sql --yes"
echo "    wrangler d1 execute liqo --remote --file=./$OUT/05_sales.sql --yes"

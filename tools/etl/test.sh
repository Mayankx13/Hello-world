#!/usr/bin/env bash
# Recommendation smoke test on the imported stock (after run.sh).
#   tools/etl/test.sh [out_dir]
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-data/import}"
T="$(mktemp -d)"
node_modules/.bin/esbuild tools/etl/smoke_reco.ts --bundle --platform=node \
  --format=esm --outfile="$T/s.mjs" --log-level=warning
ETL_OUT="$OUT" node "$T/s.mjs"
rm -rf "$T"

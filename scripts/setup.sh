#!/usr/bin/env bash
# Life OS — macOS/Linux setup. Run from repo root.
set -euo pipefail

echo "==> Creating venv (.venv)"
[ -d .venv ] || python3 -m venv .venv

# shellcheck disable=SC1091
. .venv/bin/activate

echo "==> Installing project (editable, with dev extras)"
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"

echo "==> Checking age binary"
if ! command -v age >/dev/null 2>&1; then
    echo "age not on PATH."
    echo "  macOS:  brew install age"
    echo "  Linux:  apt install age  /  dnf install age"
fi

echo "==> Running preflight"
python scripts/preflight.py || true

cat <<'EOF'

Next steps:
  journal config set-key      # store Anthropic key in macOS Keychain / libsecret
  journal config init-age     # create age identity (private bucket)
  journal evening             # first entry
  status                      # dashboard
EOF

#!/usr/bin/env bash
# Live verification for the deployed liqo-ig-concierge Worker.
#
# Runs the exact Meta webhook checks against production: the GET verification
# handshake (the one Meta runs when you save the webhook) and the dual-secret
# POST signature check. Secrets are read from the environment if already
# exported, otherwise prompted for with HIDDEN input (read -s). They are never
# printed, echoed, logged, or written to disk.
#
# Usage:
#   ./verify_deploy.sh [WORKER_URL]
#     WORKER_URL defaults to the deployed origin below.
#   Optionally pre-export to skip the prompts:
#     export META_VERIFY_TOKEN=... META_APP_SECRET=... IG_APP_SECRET=...
#
# Requires: curl, python3.
set -euo pipefail

URL="${1:-https://liqo-concierge.sbinfraprojects.workers.dev}"
CHALLENGE="liqo_test_123"
BODY='{"object":"instagram","entry":[{"id":"17841400000000000","messaging":[{"sender":{"id":"123"},"message":{"mid":"m_verify","text":"hi"}}]}]}'

pass=0; fail=0
ok(){ echo "  PASS  $1"; pass=$((pass+1)); }
no(){ echo "  FAIL  $1"; fail=$((fail+1)); }

# Read a secret from env ($1) or prompt hidden; echoes the value on stdout only
# (captured into a local var by the caller), never to the terminal.
get_secret(){
  local name="$1" val="${!1:-}"
  if [ -z "$val" ]; then
    read -rs -p "  paste ${name} (hidden, not echoed): " val >&2; echo >&2
  fi
  printf '%s' "$val"
}

# HMAC-SHA256(body) with the secret passed via env (NOT argv, so it never shows
# in `ps`). Prints "sha256=<hex>".
hmac(){
  SECRET="$1" python3 -c 'import hmac,hashlib,os,sys; print("sha256="+hmac.new(os.environ["SECRET"].encode(), sys.stdin.buffer.read(), hashlib.sha256).hexdigest())'
}

echo "Verifying ${URL}"
VTOKEN="$(get_secret META_VERIFY_TOKEN)"
MSECRET="$(get_secret META_APP_SECRET)"
ISECRET="$(get_secret IG_APP_SECRET)"

# --- Task 2: GET verification handshake ---
got="$(curl -s -G "${URL}/webhook" \
  --data-urlencode "hub.mode=subscribe" \
  --data-urlencode "hub.verify_token=${VTOKEN}" \
  --data-urlencode "hub.challenge=${CHALLENGE}")"
[ "$got" = "$CHALLENGE" ] && ok "GET handshake: correct token echoes challenge" \
                          || no "GET handshake: expected '${CHALLENGE}', got '${got}'"

code="$(curl -s -o /dev/null -w '%{http_code}' -G "${URL}/webhook" \
  --data-urlencode "hub.mode=subscribe" \
  --data-urlencode "hub.verify_token=WRONG" \
  --data-urlencode "hub.challenge=x")"
[ "$code" = "403" ] && ok "GET handshake: wrong token -> 403" || no "GET handshake: wrong token -> ${code}"

# --- Task 3: POST dual-secret signature ---
sig="$(printf '%s' "$BODY" | hmac "$MSECRET")"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${URL}/webhook" \
  -H 'content-type: application/json' -H "x-hub-signature-256: ${sig}" -d "$BODY")"
[ "$code" = "200" ] && ok "POST signed with META_APP_SECRET -> 200" || no "POST META_APP_SECRET -> ${code}"

sig="$(printf '%s' "$BODY" | hmac "$ISECRET")"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${URL}/webhook" \
  -H 'content-type: application/json' -H "x-hub-signature-256: ${sig}" -d "$BODY")"
[ "$code" = "200" ] && ok "POST signed with IG_APP_SECRET -> 200" || no "POST IG_APP_SECRET -> ${code}"

code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${URL}/webhook" \
  -H 'content-type: application/json' \
  -H "x-hub-signature-256: sha256=$(printf 'a%.0s' $(seq 64))" -d "$BODY")"
[ "$code" = "401" ] && ok "POST bad signature -> 401" || no "POST bad signature -> ${code}"

echo
echo "${pass} passed, ${fail} failed"
[ "$fail" = "0" ]

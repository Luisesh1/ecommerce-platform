#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")

  if [ "$HTTP_CODE" = "$expected" ]; then
    echo "  OK ${name} -> ${HTTP_CODE}"
  else
    echo "  FAIL ${name} -> ${HTTP_CODE} (expected ${expected})"
    FAIL=1
  fi
}

echo "=== Smoke Test ==="
echo "API: ${API_URL}"
echo "WEB: ${WEB_URL}"
echo ""

echo "--- API Checks ---"
check "API Health"          "${API_URL}/api/health"
check "API Public Config"   "${API_URL}/api/public/config"
check "API Docs"            "${API_URL}/api/docs"

echo ""
echo "--- Web Checks ---"
check "Web Home"            "${WEB_URL}/"
check "Web Products"        "${WEB_URL}/productos"

echo ""
if [ $FAIL -eq 0 ]; then
  echo "=== All checks passed ==="
  exit 0
else
  echo "=== SMOKE TEST FAILED ==="
  exit 1
fi

#!/usr/bin/env bash
# Accessibility gate for the public profiles site (spec §6.11, §6.5).
#
# Builds the real Worker, serves it with `wrangler dev` against a fixture API,
# then runs Lighthouse CI (accessibility category >= 0.95) and axe (no serious
# or critical violations) over the home page, pricing and every one of the
# 4 layouts x 5 palettes.
#
#   pnpm --filter @unclutterdesk/profiles test:a11y
#
# CI runs this as-is (.github/workflows/ci.yml).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$APP/../.." && pwd)"
cd "$APP"

PORT="${A11Y_PORT:-4398}"
API_PORT="${A11Y_API_PORT:-4399}"
BASE="http://127.0.0.1:$PORT"
LOGS="${A11Y_LOG_DIR:-$HERE/.logs}"
mkdir -p "$LOGS"

PIDS=()
cleanup() {
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do kill "$pid" 2>/dev/null || true; done
  # wrangler starts workerd as a child; make sure nothing keeps the ports.
  pkill -f "workerd serve" 2>/dev/null || true
}
trap cleanup EXIT

# Lighthouse CI needs a Chrome/Chromium binary. On CI the root @playwright/test
# install provides one; locally, the same cache is used. Find it.
if [ -z "${CHROME_PATH:-}" ]; then
  PW_CHROME=""
  for dir in "${HOME}/Library/Caches/ms-playwright" "${ROOT}/node_modules/.cache/ms-playwright"; do
    if [ -d "$dir" ]; then
      PW_CHROME="$(find "$dir" \( -path '*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' -o -path '*/chrome-linux64/chrome' \) 2>/dev/null | head -1)" || true
      if [ -n "$PW_CHROME" ]; then break; fi
    fi
  done
  if [ -n "$PW_CHROME" ]; then
    export CHROME_PATH="$PW_CHROME"
  fi
fi

wait_for() { # url, name
  for _ in $(seq 1 90); do
    if curl -s --noproxy '*' -o /dev/null "$1"; then return 0; fi
    sleep 1
  done
  echo "$2 did not come up at $1; last log lines:" >&2
  tail -40 "$LOGS/$2.log" >&2 || true
  exit 1
}

echo "── fixture API"
A11Y_API_PORT="$API_PORT" node "$HERE/fixture-api.mjs" > "$LOGS/fixture-api.log" 2>&1 &
PIDS+=($!)

echo "── build"
pnpm build > "$LOGS/build.log" 2>&1 || { tail -40 "$LOGS/build.log" >&2; exit 1; }

echo "── profiles Worker (wrangler dev)"
WRANGLER_SEND_METRICS=false CI=true pnpm exec wrangler dev --local --ip 127.0.0.1 --port "$PORT" \
  --var "API_URL:http://127.0.0.1:$API_PORT" \
  --var "PROFILE_PUBLIC_URL:$BASE" \
  > "$LOGS/profiles.log" 2>&1 &
PIDS+=($!)

wait_for "$BASE/" profiles

echo "── Lighthouse CI (accessibility >= 0.95)"
A11Y_BASE_URL="$BASE" A11Y_LH_OUTPUT="$LOGS/lighthouseci" \
  node "$HERE/lhci-config.mjs" "$LOGS/lighthouserc.json"
A11Y_LH_OUTPUT="$LOGS/lighthouseci" \
  pnpm exec lhci autorun --config "$LOGS/lighthouserc.json"

echo "── axe (no serious or critical violations)"
A11Y_PORT="$PORT" pnpm --dir "$ROOT" exec playwright test -c "$HERE/playwright.config.mjs"

echo "── accessibility checks passed"
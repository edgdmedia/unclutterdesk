#!/usr/bin/env bash
# End-to-end test of the client API proxy on a practice custom domain
# (spec §6.16): Postgres + API (production mode) + built app + tenant router
# under `wrangler dev`, with a fake custom domain mapped to localhost. A client
# signs in through the app, books, and CSRF is enforced, all through /api.
#
# Needs a Postgres server you can create a database on:
#
#   E2E_DATABASE_URL=postgresql://postgres@localhost:5432/e2e \
#     e2e/custom-domain/run.sh
#
# The database named in E2E_DATABASE_URL is dropped and recreated. CI runs
# this as-is (.github/workflows/e2e-custom-domain.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${E2E_DATABASE_URL:?Set E2E_DATABASE_URL to a Postgres database this script may drop and recreate}"
export E2E_HOST="${E2E_HOST:-chente.test}"
API_PORT="${E2E_API_PORT:-3050}"
APP_PORT="${E2E_APP_PORT:-4173}"
export E2E_ROUTER_PORT="${E2E_ROUTER_PORT:-8787}"
rand() { node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"; }
ROUTER_SECRET="$(rand)"
# The test client's password: made fresh each run, never stored in the repo.
export E2E_CLIENT_PASSWORD="${E2E_CLIENT_PASSWORD:-Aa1!$(rand)}"
LOGS="${E2E_LOG_DIR:-$ROOT/e2e/custom-domain/.logs}"
mkdir -p "$LOGS"

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  # wrangler starts workerd as a child; make sure nothing keeps the ports.
  pkill -f "workerd serve" 2>/dev/null || true
}
trap cleanup EXIT

wait_for() { # url, name
  for _ in $(seq 1 90); do
    if curl -sk --noproxy '*' -o /dev/null "$1"; then return 0; fi
    sleep 1
  done
  echo "$2 did not come up at $1; last log lines:" >&2
  tail -40 "$LOGS/$2.log" >&2 || true
  exit 1
}

echo "── database"
export DATABASE_URL="$E2E_DATABASE_URL"
DB_NAME="$(node -e "console.log(new URL(process.argv[1]).pathname.slice(1))" "$DATABASE_URL")"
ADMIN_URL="$(node -e "const u=new URL(process.argv[1]); u.pathname='/postgres'; console.log(u.toString())" "$DATABASE_URL")"
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\"" -c "CREATE DATABASE \"$DB_NAME\""
pnpm exec prisma migrate deploy --schema prisma/schema.prisma > "$LOGS/migrate.log"
node e2e/custom-domain/fixtures.mjs

echo "── API (production mode)"
NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter @unclutterdesk/api exec nest build > "$LOGS/api-build.log" 2>&1
(
  cd apps/api
  NODE_ENV=production PORT="$API_PORT" \
  JWT_SECRET="$(rand)" REFRESH_SECRET="$(rand)" FIELD_ENCRYPTION_KEY="$(rand)$(rand)" \
  ROUTER_PROXY_SECRET="$ROUTER_SECRET" \
  exec node dist/src/main.js
) > "$LOGS/api.log" 2>&1 &
PIDS+=($!)

echo "── app"
(cd apps/app && VITE_API_URL="http://127.0.0.1:$API_PORT" NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite build) > "$LOGS/app-build.log" 2>&1
(cd apps/app && exec pnpm exec vite preview --host 127.0.0.1 --port "$APP_PORT" --strictPort) > "$LOGS/app.log" 2>&1 &
PIDS+=($!)

echo "── tenant router (wrangler dev, https)"
(
  cd apps/tenant-router
  WRANGLER_SEND_METRICS=false CI=true exec pnpm exec wrangler dev --local --ip 127.0.0.1 --port "$E2E_ROUTER_PORT" \
    --local-protocol https --local-upstream "$E2E_HOST" \
    --var APEX_HOST:unclutterdesk.com \
    --var "ORIGIN_HOST:127.0.0.1:$APP_PORT" --var ORIGIN_PROTOCOL:http: \
    --var "API_BASE:http://127.0.0.1:$API_PORT" \
    --var "ROUTER_PROXY_SECRET:$ROUTER_SECRET"
) > "$LOGS/router.log" 2>&1 &
PIDS+=($!)

wait_for "http://127.0.0.1:$API_PORT/health" api
wait_for "http://127.0.0.1:$APP_PORT/" app
wait_for "https://127.0.0.1:$E2E_ROUTER_PORT/" router

echo "── playwright"
pnpm exec playwright test -c e2e/custom-domain/playwright.config.ts

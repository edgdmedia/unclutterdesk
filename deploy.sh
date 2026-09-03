#!/bin/bash
# Fail on error, on unset variables, and on any failing stage of a pipeline.
# Without pipefail a failing pg_dump piped into gzip would report success.
set -euo pipefail

TARGET_DIR="$(cd "$(dirname "$0")" && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/unclutterdesk}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

echo "🚀 Starting Unclutter Desk Production Deployment at $TARGET_DIR..."

cd $TARGET_DIR

# Copy apps/api/.env to root .env if root .env does not exist
if [ -f "apps/api/.env" ] && [ ! -f ".env" ]; then
    cp apps/api/.env .env
fi

# DATABASE_URL is needed by pg_dump below. Read it out of .env without sourcing
# the whole file, so that quoting or spaces in other secrets cannot break the
# deploy (or leak into the environment of every later command).
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
    DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL=' .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL is not set. Refusing to deploy."
    exit 1
fi

# Prisma accepts connection-string parameters that libpq does not, and pg_dump
# fails outright on them ("invalid URI query parameter: schema"). Strip the
# Prisma-only ones and pass any schema through as a proper pg_dump flag.
libpq_url() {
    local url="$1" base query kept kv
    base="${url%%\?*}"
    query="${url#*\?}"
    [ "$query" = "$url" ] && query=""
    kept=""
    local IFS='&'
    for kv in $query; do
        case "${kv%%=*}" in
            schema|connection_limit|pool_timeout|pgbouncer|socket_timeout|statement_cache_size|sslidentity|sslpassword) ;;
            "") ;;
            *) kept="${kept:+$kept&}$kv" ;;
        esac
    done
    printf '%s%s' "$base" "${kept:+?$kept}"
}

pg_schema_of() {
    case "$1" in
        *[?\&]schema=*) local rest="${1##*schema=}"; printf '%s' "${rest%%&*}" ;;
    esac
}

PG_URL="$(libpq_url "$DATABASE_URL")"
PG_SCHEMA="$(pg_schema_of "$DATABASE_URL")"

# 1. Pull latest changes from git
echo "📥 Pulling latest git updates..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing pnpm monorepo dependencies..."
pnpm install --frozen-lockfile

# 3. Generate Prisma Client
echo "⚙️ Generating Prisma Client..."
npx prisma generate

# 4. Build NestJS Backend API
echo "🔨 Building NestJS API..."
pnpm --filter @unclutterdesk/api run build

# 5. Back up the database BEFORE touching the schema.
# This holds real clinical records, so a deploy that cannot produce a restore
# point does not proceed.
echo "💾 Backing up database..."
if ! command -v pg_dump >/dev/null 2>&1; then
    echo "❌ pg_dump not found. Install postgresql-client — refusing to run migrations without a backup."
    exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).dump"

# Custom format (-Fc) so single tables can be restored with pg_restore.
if ! pg_dump --format=custom --no-owner --no-acl \
        ${PG_SCHEMA:+--schema="$PG_SCHEMA"} \
        --file="$BACKUP_FILE" "$PG_URL"; then
    echo "❌ Database backup failed. Aborting before any schema change."
    rm -f "$BACKUP_FILE"
    exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
    echo "❌ Backup file is empty. Aborting before any schema change."
    rm -f "$BACKUP_FILE"
    exit 1
fi
echo "   ✓ Backup written: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'pre-deploy-*.dump' -type f -mtime "+$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true

# 6. Apply migrations.
# `migrate deploy` only applies committed migration files and never drops data
# to resolve drift — unlike `db push`, which this used to run on every deploy.
echo "🗄️ Applying database migrations..."
npx prisma migrate deploy

# Only seed if explicitly requested via SEED_DB=true
if [ "${SEED_DB:-}" = "true" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

# 7. Reload PM2 process
echo "🔄 Reloading PM2 process..."
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

echo "✅ Unclutter Desk API Deployed Successfully on app.unclutterdesk.com!"

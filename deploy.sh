#!/bin/bash
set -e

TARGET_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Unclutter Desk Production Deployment at $TARGET_DIR..."

cd $TARGET_DIR

# Copy apps/api/.env to root .env if root .env does not exist
if [ -f "apps/api/.env" ] && [ ! -f ".env" ]; then
    cp apps/api/.env .env
fi

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

# 5. Sync Prisma schema
echo "🗄️ Syncing Prisma schema..."
npx prisma db push

# Only seed if explicitly requested via SEED_DB=true
if [ "$SEED_DB" = "true" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

# 6. Reload PM2 process
echo "🔄 Reloading PM2 process..."
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

echo "✅ Unclutter Desk API Deployed Successfully on app.unclutterdesk.com!"

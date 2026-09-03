# VPS preparation — run before merging `dev` to `main`

Everything here happens on the production server, with `main` still checked out.
None of it deploys anything.

**Why first:** merging fires all four deploy workflows at once. The app, landing
and worker deploys will succeed; the API deploy will fail at
`prisma migrate deploy` because the database has not been baselined. That leaves
the new frontend talking to the old API — the billing page would call
`/v1/billing/subscribe` expecting a Paystack checkout URL and get the old
free tier-flip response instead.

The failure itself is safe (`set -e` stops before `pm2 reload`, so the running
API is untouched), but the mismatch is not obvious, so avoid it.

---

## 0. Connect

```bash
ssh <PROD_SSH_USER>@<PROD_SSH_HOST>
cd /home/unclutterdesk/app
```

`<PROD_SSH_USER>` and `<PROD_SSH_HOST>` are the GitHub secrets used by
`.github/workflows/deploy-api.yml`.

## 1. Fetch the scripts and migrations — but not the schema

```bash
git fetch origin dev
git checkout origin/dev -- scripts/ prisma/migrations/
```

`scripts/` for the checks below; `prisma/migrations/` because step 5 marks
`0_init` as applied and cannot do that if the migration folder is missing.

**Do not check out `dev`'s `prisma/schema.prisma`.** The drift check compares
the live database against whatever schema is in the working tree. It must be
`main`'s, which is what `0_init` was generated from — `dev`'s schema contains
columns the database does not have yet, and would report drift that is not
drift.

## 2. See what is missing

```bash
node scripts/preflight.mjs
```

Read-only. Everything below is a fix for something it reports, so if it says a
step is already done, skip it.

Pay attention to two lines in particular:

- **Migration state.** It distinguishes "not baselined", "0_init still pending"
  and "baselined, N pending". The first two are blocking: applying `0_init` to a
  database that already has the tables fails on `CREATE TABLE`.
- **Paystack key mode.** A `sk_test_` key on production means live plan codes
  will not resolve *and* real client payments would run in test mode, so no
  money moves.

## 3. Install `pg_dump` if it is missing

`deploy.sh` now aborts rather than change a schema without a backup.

```bash
sudo apt-get update && sudo apt-get install -y postgresql-client
pg_dump --version
```

## 4. Environment variables

**There may be two env files, and only one takes effect.**
`apps/api/src/env.ts` loads the repo root `.env` first, then `apps/api/.env`,
and dotenv never overwrites a value it has already set — so the root file wins.
`deploy.sh` copies `apps/api/.env` to the root *only when the root file is
absent*, so once both exist they drift apart silently and editing the wrong one
changes nothing.

Check which is which before editing (secrets truncated):

```bash
cd /home/unclutterdesk/app
for f in .env apps/api/.env; do
  echo "=== $f ==="
  if [ -f "$f" ]; then
    grep -E '^[[:space:]]*(PAYSTACK_SECRET_KEY|PAYSTACK_PLAN_|NODE_ENV|DATABASE_URL)=' "$f" \
      | sed -E 's/(KEY=|URL=)(.{10}).*/\1\2…/'
  else
    echo "  (absent)"
  fi
done
```

`preflight.mjs` reports which file it loaded and fails if the two disagree.

Edit `/home/unclutterdesk/app/.env` — the one that wins.

```bash
# Paystack subscription plans (live-mode codes)
PAYSTACK_PLAN_STARTER=PLN_an5ij398kgugwr4
PAYSTACK_PLAN_PRO=PLN_f4ncmm3xmcy7b90
PAYSTACK_PLAN_CLINIC=PLN_leght05vpcu41ad

# Only needed if an origin outside *.unclutterdesk.com calls the API
# CORS_ORIGINS=https://example.com

NODE_ENV=production
```

Delete the `STRIPE_*` lines — the integration is gone.

If `apps/api/.env` also exists, keep it consistent: `deploy.sh` copies it to the
root `.env` when the root one is absent.

Then confirm the plan codes point at the right tiers. Codes are opaque, so one
in the wrong variable looks valid and simply bills the wrong amount:

```bash
node scripts/create-paystack-plans.mjs --verify
```

Expected: three ✓ lines at ₦5,000, ₦15,000 and ₦45,000, monthly.

## 5. Baseline the database

Currently the deploy runs `prisma db push`, which resolves any difference by
altering or dropping whatever is in the way. It becomes `prisma migrate deploy`,
which only applies committed migration files — but that fails against an
existing database until the initial migration is recorded as already applied.

```bash
export DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL=' .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"

# Prisma accepts ?schema=public; libpq does not, and pg_dump/psql fail on it
# with "invalid URI query parameter", leaving a zero-byte file. Strip it for
# the Postgres tools only — Prisma keeps using DATABASE_URL as-is.
export PG_URL="${DATABASE_URL%%\?*}"

# a. Confirm the live schema matches main's schema.prisma
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected: `-- This is an empty migration.`**

If it prints real SQL, **stop and send it to me.** Baselining a drifted database
records a history that lies about the live state, and every later migration
builds on that lie.

```bash
# b. Back up first
mkdir -p "$HOME/backups/unclutterdesk"
pg_dump --format=custom --no-owner --no-acl \
  --file="$HOME/backups/unclutterdesk/pre-baseline-$(date +%Y%m%d-%H%M%S).dump" \
  "$PG_URL"

# Confirm it is not empty — a failed dump still leaves a 0-byte file behind
ls -lh "$HOME/backups/unclutterdesk/"

# c. Record the baseline — writes one row, runs no DDL
npx prisma migrate resolve --applied 0_init

# d. Check
npx prisma migrate status
```

After (d) expect **two migrations pending** — `tenant_closure` and
`paystack_subscriptions`. Leave them. `deploy.sh` applies them on the first
deploy, after taking its own backup.

## 6. Confirm the Stripe columns are empty

The `paystack_subscriptions` migration drops three columns. They should be
unused, but the DROPs are irreversible, so check:

```bash
psql "$PG_URL" -c 'SELECT count(*) FROM "Tenant" WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL;'
psql "$PG_URL" -c 'SELECT count(*) FROM "BankSubaccount" WHERE "stripeAccountId" IS NOT NULL;'
```

Both must be `0`. If either is not, stop — there is billing state to migrate.

## 7. nginx — already correct, verify only

The API sets `trust proxy`, which needs nginx to forward the real client
address. `/etc/nginx/conf.d/api-unclutterdesk.com.conf` already does, inside the
`location` block, so **no change is required**. Confirm with:

```bash
sudo grep -E "proxy_set_header (Host|X-Real-IP|X-Forwarded-)" \
  /etc/nginx/conf.d/api-unclutterdesk.com.conf
```

Expect `Host`, `X-Real-IP`, `X-Forwarded-For $proxy_add_x_forwarded_for` and
`X-Forwarded-Proto`. All four must be in the same block as `proxy_pass`: nginx
replaces inherited `proxy_set_header` directives rather than merging them, so a
`location` with any of its own ignores every server-level one — silently, and
with a passing `nginx -t`.

Buffering needs no change either. `/v1/notifications/stream` sets
`X-Accel-Buffering: no` on the response, which nginx honours per-response, so
`proxy_buffering off` is unnecessary.

One thing to revisit at Phase 3: once Cloudflare proxies the API there are two
hops rather than one, and `trust proxy: 1` would read Cloudflare's address.
`docs/CLOUDFLARE_SETUP.md` §2 covers the `real_ip_header CF-Connecting-IP`
change that goes with it.

## 8. Re-check

```bash
node scripts/preflight.mjs
```

Expect **0 blocking**. Migration state will report pending migrations and drift
will be advisory — both correct once the baseline exists.

---

## Then merge

Open the PR, let CI run (typecheck plus 168 tests, which every deploy job
depends on), and merge. Watch `deploy-api`: it should back up, apply the two
migrations, and reload PM2.

`deploy-tenant-router` will fail until the Cloudflare API token has
**Workers Scripts: Edit** — that is Phase 2 and does not block the API.

Smoke test:

```bash
curl -s https://api.unclutterdesk.com/health
```

Expect `{"status":"ok","database":"up",...}`.
